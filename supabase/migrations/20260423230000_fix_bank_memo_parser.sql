-- Fix bank memo parser: regex-based extraction thay vì exact match
-- ============================================================================
-- BUG (root cause cho PENDING không chuyển CONFIRMED):
--   process_incoming_bank_transfer dùng EQUALITY sau REPLACE dash/space:
--     REPLACE(code, '-', '') = REPLACE(memo, '-', '')
--   → Memo có text phụ ("thanh toan SO-...", "FT25SO...") miss parser.
--   → Tiền vào status='pending' business_type='other' ref_id=NULL.
--   → Trigger auto_allocate_payment_to_orders KHÔNG fire (điều kiện
--     status IN ('completed','confirmed')).
--   → Đơn PENDING đứng yên sau khi khách CK.
--
-- FIX:
--   Helper extract_order_codes_from_memo(text) → text[] regex extract
--   (SO|POS)[-\s]?(YYMMDD)[-\s]?(NNNN), dedupe, chuẩn hoá format.
--   Parser mới: multi-order support (phân bổ proportional outstanding),
--   idempotency qua bank_reference_id, giữ fallback pending nếu 0 match.
-- Date: 2026-04-23
-- ============================================================================

BEGIN;

-- 1. Helper: extract các mã đơn từ memo
CREATE OR REPLACE FUNCTION public.extract_order_codes_from_memo(p_memo text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public'
AS $$
DECLARE
  v_normalized text;
  v_result text[] := ARRAY[]::text[];
  v_match text[];
BEGIN
  IF p_memo IS NULL OR btrim(p_memo) = '' THEN
    RETURN ARRAY[]::text[];
  END IF;

  v_normalized := upper(p_memo);

  FOR v_match IN
    SELECT regexp_matches(v_normalized, '(SO|POS)[\s-]?(\d{6})[\s-]?(\d{4})', 'g')
  LOOP
    v_result := v_result || (v_match[1] || '-' || v_match[2] || '-' || v_match[3]);
  END LOOP;

  -- Dedupe preserve order
  SELECT COALESCE(ARRAY_AGG(c ORDER BY min_idx), ARRAY[]::text[]) INTO v_result
  FROM (
    SELECT c, MIN(idx) AS min_idx
    FROM unnest(v_result) WITH ORDINALITY AS t(c, idx)
    GROUP BY c
  ) u;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.extract_order_codes_from_memo(text) TO anon, authenticated, service_role;

-- 2. Parser mới
CREATE OR REPLACE FUNCTION public.process_incoming_bank_transfer(
  p_amount numeric, p_memo text, p_bank_ref_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_codes text[];
  v_code text;
  v_fund_id BIGINT;
  v_trans_code TEXT;
  v_partner_type TEXT;
  v_partner_id TEXT;
  v_partner_name TEXT;
  v_allocated_orders jsonb := '[]'::jsonb;
  v_alloc_amount numeric;
  v_remaining numeric := p_amount;
  v_total_outstanding numeric := 0;
  v_outstanding numeric;
BEGIN
  -- Idempotent
  IF p_bank_ref_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.finance_transactions WHERE bank_reference_id = p_bank_ref_id
  ) THEN
    RETURN jsonb_build_object('status', 'ignored', 'reason', 'transaction_already_processed');
  END IF;

  SELECT id INTO v_fund_id FROM public.fund_accounts WHERE type = 'bank' LIMIT 1;
  IF v_fund_id IS NULL THEN v_fund_id := 1; END IF;

  v_codes := public.extract_order_codes_from_memo(p_memo);

  -- Fallback: 0 mã match → lưu pending cho kế toán
  IF array_length(v_codes, 1) IS NULL OR array_length(v_codes, 1) = 0 THEN
    v_trans_code := 'PT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    INSERT INTO public.finance_transactions (
      code, amount, flow, business_type, fund_account_id,
      description, status, bank_reference_id
    ) VALUES (
      v_trans_code, p_amount, 'in', 'other', v_fund_id,
      'Tiền vào chưa rõ đơn. Nội dung gốc: ' || COALESCE(p_memo, '(rỗng)'), 'pending', p_bank_ref_id
    );
    RETURN jsonb_build_object('status', 'saved_unallocated', 'message', 'Không tìm thấy mã đơn trong memo.');
  END IF;

  -- Tổng outstanding của các đơn match (chưa paid đủ, chưa cancel)
  SELECT COALESCE(SUM(GREATEST(final_amount - COALESCE(paid_amount, 0), 0)), 0)
  INTO v_total_outstanding
  FROM public.orders
  WHERE code = ANY(v_codes)
    AND payment_status != 'paid'
    AND status != 'CANCELLED';

  -- Single order (hoặc tất cả đơn đã paid → vẫn ghi vào đơn đầu tiên để audit)
  IF array_length(v_codes, 1) = 1 OR v_total_outstanding = 0 THEN
    v_code := v_codes[1];
    SELECT o.id, o.code, o.customer_id, o.customer_b2c_id,
           cb.name AS b2b_name, cc.name AS b2c_name
    INTO v_order
    FROM public.orders o
    LEFT JOIN public.customers_b2b cb ON o.customer_id = cb.id
    LEFT JOIN public.customers cc ON o.customer_b2c_id = cc.id
    WHERE o.code = v_code
    LIMIT 1;

    IF v_order.id IS NULL THEN
      v_trans_code := 'PT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
      INSERT INTO public.finance_transactions (
        code, amount, flow, business_type, fund_account_id,
        description, status, bank_reference_id
      ) VALUES (
        v_trans_code, p_amount, 'in', 'other', v_fund_id,
        'Memo có mã ' || v_code || ' nhưng đơn không tồn tại. ND gốc: ' || COALESCE(p_memo, ''),
        'pending', p_bank_ref_id
      );
      RETURN jsonb_build_object('status', 'saved_unallocated', 'reason', 'order_not_found', 'code', v_code);
    END IF;

    IF v_order.customer_id IS NOT NULL THEN
      v_partner_type := 'customer_b2b'; v_partner_id := v_order.customer_id::TEXT; v_partner_name := v_order.b2b_name;
    ELSE
      v_partner_type := 'customer'; v_partner_id := v_order.customer_b2c_id::TEXT; v_partner_name := v_order.b2c_name;
    END IF;

    v_trans_code := 'PT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    INSERT INTO public.finance_transactions (
      code, amount, flow, business_type, fund_account_id,
      partner_type, partner_id, partner_name_cache,
      ref_type, ref_id, description, status, bank_reference_id
    ) VALUES (
      v_trans_code, p_amount, 'in', 'trade', v_fund_id,
      v_partner_type, v_partner_id, COALESCE(v_partner_name, 'Khách lẻ'),
      'order', v_order.code,
      'Hệ thống tự động gạch nợ. ND gốc: ' || COALESCE(p_memo, ''),
      'completed', p_bank_ref_id
    );
    UPDATE public.orders SET payment_method = 'bank_transfer' WHERE id = v_order.id;

    RETURN jsonb_build_object(
      'status', 'success',
      'allocated', jsonb_build_array(
        jsonb_build_object('order_code', v_order.code, 'amount', p_amount, 'trans_code', v_trans_code)
      )
    );
  END IF;

  -- Multi-order: phân bổ proportional theo outstanding
  FOR v_order IN
    SELECT o.id, o.code, o.customer_id, o.customer_b2c_id,
           GREATEST(o.final_amount - COALESCE(o.paid_amount, 0), 0) AS outstanding,
           cb.name AS b2b_name, cc.name AS b2c_name
    FROM public.orders o
    LEFT JOIN public.customers_b2b cb ON o.customer_id = cb.id
    LEFT JOIN public.customers cc ON o.customer_b2c_id = cc.id
    WHERE o.code = ANY(v_codes)
      AND o.payment_status != 'paid'
      AND o.status != 'CANCELLED'
    ORDER BY o.created_at ASC
  LOOP
    v_outstanding := v_order.outstanding;
    v_alloc_amount := LEAST(v_remaining, round(p_amount * v_outstanding / v_total_outstanding));
    IF v_alloc_amount <= 0 THEN CONTINUE; END IF;

    IF v_order.customer_id IS NOT NULL THEN
      v_partner_type := 'customer_b2b'; v_partner_id := v_order.customer_id::TEXT; v_partner_name := v_order.b2b_name;
    ELSE
      v_partner_type := 'customer'; v_partner_id := v_order.customer_b2c_id::TEXT; v_partner_name := v_order.b2c_name;
    END IF;

    v_trans_code := 'PT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    INSERT INTO public.finance_transactions (
      code, amount, flow, business_type, fund_account_id,
      partner_type, partner_id, partner_name_cache,
      ref_type, ref_id, description, status, bank_reference_id
    ) VALUES (
      v_trans_code, v_alloc_amount, 'in', 'trade', v_fund_id,
      v_partner_type, v_partner_id, COALESCE(v_partner_name, 'Khách lẻ'),
      'order', v_order.code,
      'Hệ thống tự động gạch nợ (multi-order). ND gốc: ' || COALESCE(p_memo, ''),
      'completed', p_bank_ref_id || '-' || v_order.code
    );
    v_remaining := v_remaining - v_alloc_amount;
    v_allocated_orders := v_allocated_orders || jsonb_build_array(
      jsonb_build_object('order_code', v_order.code, 'amount', v_alloc_amount, 'trans_code', v_trans_code)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'success',
    'allocated', v_allocated_orders,
    'remaining', v_remaining
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_incoming_bank_transfer(numeric, text, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
