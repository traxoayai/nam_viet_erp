-- Fix collision finance_transactions.code do RANDOM 4 digits
-- ============================================================================
-- STATUS 2026-04-24: User approved deploy. Tác động: 1 RPC
-- (record_manual_payment_received) thay code-gen sang sequence-based
-- nhưng không đổi contract với caller.
-- ============================================================================
-- PROBLEM: 7 RPCs generate `'PT-' || YYMMDD || '-' || LPAD(RANDOM*10000, 4)`
--          → collision 1/10000 per call. Khi parallel test / parallel NV click
--          → UNIQUE constraint violated.
-- FIX: Thay bằng helper `public._gen_finance_tx_code(prefix)` dùng nextval
--      sequence + suffix random → gần như không collision (1 / 10B/day).
-- SCOPE: record_manual_payment_received, process_incoming_bank_transfer,
--        _insert_order_payment_tx, create_finance_transaction,
--        create_sales_order, record_b2b_debt_payment, submit_cash_remittance
-- Date: 2026-04-24
-- ============================================================================

BEGIN;

-- Sequence dùng chung — tăng đơn điệu, cycle = không quan trọng vì kết hợp
-- với YYMMDD prefix và suffix random → unique đủ.
CREATE SEQUENCE IF NOT EXISTS public.finance_tx_code_seq;

-- Helper: prefix ('PT'/'PC'/etc) + YYMMDD + 6-digit seq + 2-digit random
-- Format: PREFIX-YYMMDD-NNNNNN-RR (total 17 chars + prefix length)
CREATE OR REPLACE FUNCTION public._gen_finance_tx_code(p_prefix text DEFAULT 'PT')
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq bigint;
BEGIN
  v_seq := nextval('public.finance_tx_code_seq');
  RETURN p_prefix || '-' ||
         TO_CHAR(NOW(), 'YYMMDD') || '-' ||
         LPAD((v_seq % 1000000)::text, 6, '0') ||
         LPAD(FLOOR(RANDOM() * 100)::text, 2, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public._gen_finance_tx_code(text) TO authenticated, anon, service_role;

-- Áp dụng helper cho record_manual_payment_received — RPC này được test
-- parallel hay hit collision. Các RPC khác (process_incoming_bank_transfer,
-- _insert_order_payment_tx, etc.) giữ pattern cũ (ưu tiên scope hẹp),
-- migrate dần trong các migration sau.
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

  -- [FIX 2026-04-24] Dùng helper nextval-based thay RANDOM 4-digit để
  -- tránh collision khi parallel insert.
  v_trans_code := public._gen_finance_tx_code('PT');

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
