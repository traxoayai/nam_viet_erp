-- =============================================================================
-- Migration: get_portal_users_list thêm cột is_banned
-- Date: 2026-04-20
-- Để trang /portal/users hiển thị đúng trạng thái BAN (banned_until > now())
-- thay vì chỉ dựa vào portal_users.status.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.get_portal_users_list(text, text);

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
  customer_code text,
  is_banned boolean
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
    cb.customer_code,
    COALESCE(au.banned_until > now(), false) AS is_banned
  FROM portal_users pu
  LEFT JOIN customers_b2b cb ON cb.id = pu.customer_b2b_id
  LEFT JOIN auth.users au ON au.id = pu.auth_user_id
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

COMMIT;
