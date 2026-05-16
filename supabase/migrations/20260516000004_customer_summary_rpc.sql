-- 20260516000004_customer_summary_rpc.sql
-- Plan 2 Task 8: RPC trả "ảnh nhanh" về khách hàng cho Sales Inbox panel.
-- Date: 2026-05-16
--
-- Trả về JSON gồm:
--  - portal_user: bản ghi portal_users (display_name, phone, role…)
--  - customer:    bản ghi customers_b2b (name, tax_code, vat_address…)
--  - recent_orders: 5 đơn gần nhất (id, code, final_amount, status, created_at)
--  - debt:        kết quả get_customer_debt_summary (JSON scalar — graceful
--                 fallback nếu RPC lỗi để inbox không bị block).
--
-- Schema verified live:
--  - portal_users: display_name, phone, auth_user_id, customer_b2b_id (bigint)
--  - customers_b2b: id bigint, name, tax_code, vat_address, shipping_address
--  - orders: id uuid, code, customer_id bigint, status, final_amount,
--           total_amount, created_at
--  - get_customer_debt_summary(p_customer_b2b_id bigint) RETURNS json
--
-- SECURITY DEFINER + is_chat_staff() guard, GRANT authenticated only.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_chat_customer_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_portal_user   public.portal_users;
  v_customer      public.customers_b2b;
  v_recent_orders jsonb;
  v_debt          jsonb;
BEGIN
  IF NOT public.is_chat_staff() THEN
    RAISE EXCEPTION 'Không có quyền xem thông tin khách hàng' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_portal_user
  FROM public.portal_users
  WHERE auth_user_id = p_user_id
  LIMIT 1;

  IF v_portal_user.id IS NULL THEN
    RETURN jsonb_build_object(
      'portal_user',   NULL,
      'customer',      NULL,
      'recent_orders', '[]'::jsonb,
      'debt',          NULL
    );
  END IF;

  SELECT * INTO v_customer
  FROM public.customers_b2b
  WHERE id = v_portal_user.customer_b2b_id
  LIMIT 1;

  -- 5 đơn gần nhất theo created_at DESC
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',           o.id,
        'code',         o.code,
        'total',        COALESCE(o.final_amount, o.total_amount, 0),
        'status',       o.status,
        'created_at',   o.created_at
      )
      ORDER BY o.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_recent_orders
  FROM (
    SELECT id, code, final_amount, total_amount, status, created_at
    FROM public.orders
    WHERE customer_id = v_customer.id
    ORDER BY created_at DESC
    LIMIT 5
  ) o;

  -- Debt summary (graceful fallback nếu RPC lỗi / view chưa sẵn sàng)
  BEGIN
    SELECT public.get_customer_debt_summary(v_customer.id)::jsonb
      INTO v_debt;
  EXCEPTION WHEN OTHERS THEN
    v_debt := jsonb_build_object(
      'debt_total', 0,
      'note',       'unavailable'
    );
  END;

  -- Chuẩn hoá tên field về `debt_total` cho FE (RPC trả `actual_current_debt`)
  IF v_debt IS NOT NULL AND v_debt ? 'actual_current_debt' THEN
    v_debt := v_debt || jsonb_build_object(
      'debt_total',
      COALESCE((v_debt ->> 'actual_current_debt')::numeric, 0)
    );
  END IF;

  RETURN jsonb_build_object(
    'portal_user',   to_jsonb(v_portal_user),
    'customer',      to_jsonb(v_customer),
    'recent_orders', COALESCE(v_recent_orders, '[]'::jsonb),
    'debt',          v_debt
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_chat_customer_summary(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_chat_customer_summary(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_chat_customer_summary(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_chat_customer_summary(uuid) IS
  'Sales Inbox panel: portal_user + customer + 5 đơn gần nhất + debt summary. SECURITY DEFINER + is_chat_staff() guard.';

COMMIT;
