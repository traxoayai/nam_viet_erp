-- Migration: Thêm auth_user_id vào registration_requests + RPCs cho portal users
-- Date: 2026-04-14

BEGIN;

-- 1. Thêm column auth_user_id vào registration_requests
ALTER TABLE public.registration_requests
ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. RPC: get_portal_users_list — danh sách portal users cho trang quản lý ERP
CREATE OR REPLACE FUNCTION public.get_portal_users_list(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  auth_user_id uuid,
  customer_b2b_id bigint,
  display_name text,
  email text,
  phone text,
  role text,
  status text,
  last_login_at timestamptz,
  created_at timestamptz,
  customer_name text,
  customer_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pu.id,
    pu.auth_user_id,
    pu.customer_b2b_id,
    pu.display_name,
    pu.email,
    pu.phone,
    pu.role,
    pu.status,
    pu.last_login_at,
    pu.created_at,
    cb.name AS customer_name,
    cb.customer_code
  FROM portal_users pu
  LEFT JOIN customers_b2b cb ON cb.id = pu.customer_b2b_id
  WHERE
    (p_status IS NULL OR pu.status = p_status)
    AND (
      p_search IS NULL
      OR pu.display_name ILIKE '%' || p_search || '%'
      OR pu.email ILIKE '%' || p_search || '%'
      OR cb.name ILIKE '%' || p_search || '%'
      OR cb.customer_code ILIKE '%' || p_search || '%'
    )
  ORDER BY pu.created_at DESC;
END;
$$;

-- 3. RPC: create_portal_user_from_erp — tạo portal user từ ERP
CREATE OR REPLACE FUNCTION public.create_portal_user_from_erp(
  p_customer_b2b_id bigint,
  p_auth_user_id uuid,
  p_email text,
  p_display_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_role text DEFAULT 'owner'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_portal_user_id uuid;
BEGIN
  -- Validate customer exists
  IF NOT EXISTS (SELECT 1 FROM customers_b2b WHERE id = p_customer_b2b_id AND status = 'active') THEN
    RAISE EXCEPTION 'Khách hàng B2B không tồn tại hoặc đã ngưng hoạt động.';
  END IF;

  -- Check duplicate auth_user_id
  IF EXISTS (SELECT 1 FROM portal_users WHERE auth_user_id = p_auth_user_id) THEN
    RAISE EXCEPTION 'Auth user này đã có portal account.';
  END IF;

  -- Check duplicate email
  IF EXISTS (SELECT 1 FROM portal_users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email này đã có portal account.';
  END IF;

  INSERT INTO portal_users (
    auth_user_id, customer_b2b_id, display_name, email, phone, role, status
  ) VALUES (
    p_auth_user_id, p_customer_b2b_id,
    COALESCE(p_display_name, p_email),
    p_email, p_phone, p_role, 'active'
  ) RETURNING id INTO v_portal_user_id;

  RETURN v_portal_user_id;
END;
$$;

-- 4. RPC: toggle_portal_user_status — activate/deactivate portal user
CREATE OR REPLACE FUNCTION public.toggle_portal_user_status(
  p_portal_user_id uuid,
  p_new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_new_status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'Status không hợp lệ. Chỉ chấp nhận active hoặc inactive.';
  END IF;

  UPDATE portal_users
  SET status = p_new_status, updated_at = now()
  WHERE id = p_portal_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portal user không tồn tại.';
  END IF;
END;
$$;

COMMIT;
