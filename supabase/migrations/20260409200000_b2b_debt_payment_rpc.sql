-- ============================================================
-- B2B Debt Payment RPC — ghi nhận thanh toán nợ từ SePay PG
-- Ngày: 2026-04-09
-- ============================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.record_b2b_debt_payment(
  p_customer_b2b_id BIGINT,
  p_amount          NUMERIC,
  p_bank_ref_id     TEXT,
  p_description     TEXT DEFAULT 'Thanh toán công nợ B2B qua SePay'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fund_id       BIGINT;
  v_trans_code    TEXT;
  v_customer_name TEXT;
BEGIN
  -- [IDEMPOTENCY] Chống ghi trùng mã tham chiếu
  IF p_bank_ref_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.finance_transactions
    WHERE bank_reference_id = p_bank_ref_id
  ) THEN
    RETURN jsonb_build_object('status', 'ignored', 'reason', 'transaction_already_processed');
  END IF;

  -- Lấy tên khách hàng
  SELECT name INTO v_customer_name
  FROM public.customers_b2b
  WHERE id = p_customer_b2b_id;

  IF v_customer_name IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'reason', 'customer_not_found');
  END IF;

  -- Lấy quỹ ngân hàng đầu tiên
  SELECT id INTO v_fund_id
  FROM public.fund_accounts
  WHERE type = 'bank'
  LIMIT 1;
  IF v_fund_id IS NULL THEN v_fund_id := 1; END IF;

  -- Sinh mã phiếu thu nội bộ
  v_trans_code := 'PT-' || TO_CHAR(NOW(), 'YYMMDD') || '-'
    || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  -- Ghi phiếu thu (trigger trg_auto_sync_order_payment sẽ gạch nợ nếu liên kết đơn)
  INSERT INTO public.finance_transactions (
    code, amount, flow, business_type, fund_account_id,
    partner_type, partner_id, partner_name_cache,
    description, status, bank_reference_id
  ) VALUES (
    v_trans_code, p_amount, 'in', 'trade', v_fund_id,
    'customer_b2b', p_customer_b2b_id::TEXT, v_customer_name,
    p_description, 'completed', p_bank_ref_id
  );

  RETURN jsonb_build_object(
    'status',           'success',
    'transaction_code', v_trans_code,
    'customer_name',    v_customer_name,
    'message',          'Đã ghi nhận thanh toán công nợ B2B'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_b2b_debt_payment(BIGINT, NUMERIC, TEXT, TEXT)
  TO service_role;

COMMIT;
