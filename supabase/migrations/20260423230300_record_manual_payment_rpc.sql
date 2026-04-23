-- RPC record_manual_payment_received: NV xác nhận thủ công đã nhận tiền
-- ============================================================================
-- WHY: Khi bank webhook fail hoặc memo không match, NV cần 1-click confirm.
--      Full FinanceFormModal (7+ fields) quá nặng cho use-case này.
-- DESIGN: RPC wrap INSERT finance_transactions (status='completed',
--         ref_id=order.code) → trigger auto_allocate_payment_to_orders fire
--         → orders.paid_amount/status update → trigger notify_payment_received
--         → noti + email.
-- PARAMS:
--   p_order_id — UUID đơn cần xác nhận
--   p_amount   — NULL = toàn bộ outstanding
--   p_note     — ghi chú bổ sung (optional)
-- Date: 2026-04-23
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Chưa đăng nhập';
  END IF;

  -- Lấy email NV để log description
  SELECT email INTO v_actor_email
  FROM auth.users WHERE id = auth.uid();

  SELECT o.id, o.code, o.final_amount, o.paid_amount, o.payment_status, o.status,
         o.customer_id, o.customer_b2c_id,
         cb.name AS b2b_name, cc.name AS b2c_name
  INTO v_order
  FROM public.orders o
  LEFT JOIN public.customers_b2b cb ON o.customer_id = cb.id
  LEFT JOIN public.customers cc ON o.customer_b2c_id = cc.id
  WHERE o.id = p_order_id;

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

  -- Không cho overpay
  IF v_amount > (v_order.final_amount - COALESCE(v_order.paid_amount, 0)) + 1 THEN
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

  v_trans_code := 'PT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' ||
                  LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  INSERT INTO public.finance_transactions (
    code, amount, flow, business_type, fund_account_id,
    partner_type, partner_id, partner_name_cache,
    ref_type, ref_id, description, status
  ) VALUES (
    v_trans_code, v_amount, 'in', 'trade', v_fund_id,
    v_partner_type, v_partner_id, COALESCE(v_partner_name, 'Khách lẻ'),
    'order', v_order.code,
    'Xác nhận thủ công bởi NV ' || COALESCE(v_actor_email, auth.uid()::text) ||
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
  TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
