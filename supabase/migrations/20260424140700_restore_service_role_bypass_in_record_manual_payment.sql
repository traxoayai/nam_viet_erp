-- Restore service_role bypass cho record_manual_payment_received
-- ============================================================================
-- BUG: Migration 140000 (fix collision PT code) copy body từ 230300 (gốc),
-- nhưng 250200 đã thêm logic bypass auth cho service_role. 140000 override
-- → lost bypass → integration tests fail với "Chưa đăng nhập".
--
-- Fix: re-apply full body của 250200 version, CHỈ thay inline code-gen
-- bằng _gen_finance_tx_code('PT'). Giữ nguyên:
--   - service_role bypass (auth.role() = 'service_role')
--   - Role check cho non-service caller (admin/sales_admin/warehouse_admin/finance_admin)
--   - pg_advisory_xact_lock order-pay (idempotent guard)
--   - FOR UPDATE OF o (row lock)
--   - Tolerance 100đ (không phải 1)
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.record_manual_payment_received(
  p_order_id uuid,
  p_amount numeric DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_partner_type TEXT;
  v_partner_id TEXT;
  v_partner_name TEXT;
  v_fund_id BIGINT;
  v_amount numeric;
  v_trans_code TEXT;
  v_actor_email TEXT;
  v_has_role BOOLEAN;
  v_is_service_role BOOLEAN;
BEGIN
  v_is_service_role := (auth.role() = 'service_role');

  -- Auth check: chỉ bắt buộc cho non-service caller
  IF NOT v_is_service_role AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Chưa đăng nhập';
  END IF;

  -- Role check: service_role bypass (trust boundary)
  IF NOT v_is_service_role THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('admin', 'sales_admin', 'warehouse_admin', 'finance_admin')
    ) INTO v_has_role;

    IF NOT v_has_role THEN
      RAISE EXCEPTION 'Không có quyền ghi nhận thanh toán. Cần role admin/sales_admin/warehouse_admin/finance_admin.';
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT email INTO v_actor_email FROM auth.users WHERE id = auth.uid();
  ELSE
    v_actor_email := 'service_role';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('order-pay-' || p_order_id::text, 0)
  );

  SELECT o.id, o.code, o.final_amount, o.paid_amount, o.payment_status, o.status,
         o.customer_id, o.customer_b2c_id,
         cb.name AS b2b_name, cc.name AS b2c_name
  INTO v_order
  FROM public.orders o
  LEFT JOIN public.customers_b2b cb ON o.customer_id = cb.id
  LEFT JOIN public.customers cc ON o.customer_b2c_id = cc.id
  WHERE o.id = p_order_id
  FOR UPDATE OF o;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy đơn hàng';
  END IF;
  IF v_order.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'Đơn đã hủy, không thể ghi nhận thanh toán';
  END IF;
  IF v_order.payment_status = 'paid' THEN
    RAISE EXCEPTION 'Đơn đã thanh toán đủ';
  END IF;

  v_amount := COALESCE(
    p_amount,
    GREATEST(v_order.final_amount - COALESCE(v_order.paid_amount, 0), 0)
  );
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Số tiền phải > 0';
  END IF;

  IF v_amount > (v_order.final_amount - COALESCE(v_order.paid_amount, 0)) + 100 THEN
    RAISE EXCEPTION 'Số tiền vượt quá số nợ còn lại của đơn (% đ)',
      to_char(v_order.final_amount - COALESCE(v_order.paid_amount, 0), 'FM999,999,999');
  END IF;

  SELECT id INTO v_fund_id
  FROM public.fund_accounts WHERE type = 'bank' LIMIT 1;
  IF v_fund_id IS NULL THEN v_fund_id := 1; END IF;

  IF v_order.customer_id IS NOT NULL THEN
    v_partner_type := 'customer_b2b';
    v_partner_id := v_order.customer_id::TEXT;
    v_partner_name := v_order.b2b_name;
  ELSE
    v_partner_type := 'customer';
    v_partner_id := v_order.customer_b2c_id::TEXT;
    v_partner_name := v_order.b2c_name;
  END IF;

  -- Dùng helper sequence-based để tránh collision
  v_trans_code := public._gen_finance_tx_code('PT');

  INSERT INTO public.finance_transactions (
    code, amount, flow, business_type, fund_account_id,
    partner_type, partner_id, partner_name_cache,
    ref_type, ref_id, description, status
  ) VALUES (
    v_trans_code, v_amount, 'in', 'trade', v_fund_id,
    v_partner_type, v_partner_id, COALESCE(v_partner_name, 'Khách lẻ'),
    'order', v_order.code,
    'Xác nhận thủ công bởi ' || v_actor_email ||
      CASE WHEN p_note IS NULL OR btrim(p_note) = '' THEN '' ELSE '. Ghi chú: ' || p_note END,
    'completed'
  );

  RETURN jsonb_build_object(
    'success', true,
    'trans_code', v_trans_code,
    'amount', v_amount,
    'order_code', v_order.code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_manual_payment_received(uuid, numeric, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
