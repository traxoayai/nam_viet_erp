-- Apply _gen_finance_tx_code helper cho process_incoming_bank_transfer
-- ============================================================================
-- Cùng lý do migration 140000: tránh collision 23505 finance_transactions_code_key
-- khi parallel insert. Body giữ nguyên, chỉ thay 5 vị trí generate v_trans_code.
-- Base: state pg_proc prod ngày 2026-04-24.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.process_incoming_bank_transfer(
  p_amount numeric,
  p_memo text,
  p_bank_ref_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_single_outstanding numeric;
  v_single_alloc numeric;
  v_excess numeric;
BEGIN
  IF p_bank_ref_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.finance_transactions
    WHERE bank_reference_id = p_bank_ref_id
       OR bank_reference_id LIKE p_bank_ref_id || '-%'
  ) THEN
    RETURN jsonb_build_object('status', 'ignored', 'reason', 'transaction_already_processed');
  END IF;

  SELECT id INTO v_fund_id FROM public.fund_accounts WHERE type = 'bank' LIMIT 1;
  IF v_fund_id IS NULL THEN v_fund_id := 1; END IF;

  v_codes := public.extract_order_codes_from_memo(p_memo);

  IF array_length(v_codes, 1) IS NULL OR array_length(v_codes, 1) = 0 THEN
    v_trans_code := public._gen_finance_tx_code('PT');
    INSERT INTO public.finance_transactions (
      code, amount, flow, business_type, fund_account_id,
      description, status, bank_reference_id
    ) VALUES (
      v_trans_code, p_amount, 'in', 'other', v_fund_id,
      'Tiền vào chưa rõ đơn. Nội dung gốc: ' || COALESCE(p_memo, '(rỗng)'), 'pending', p_bank_ref_id
    );
    RETURN jsonb_build_object('status', 'saved_unallocated', 'message', 'Không tìm thấy mã đơn trong memo.');
  END IF;

  SELECT COALESCE(SUM(GREATEST(final_amount - COALESCE(paid_amount, 0), 0)), 0)
  INTO v_total_outstanding
  FROM public.orders
  WHERE code = ANY(v_codes)
    AND payment_status != 'paid'
    AND status != 'CANCELLED';

  IF array_length(v_codes, 1) = 1 OR v_total_outstanding = 0 THEN
    v_code := v_codes[1];
    SELECT o.id, o.code, o.customer_id, o.customer_b2c_id,
           GREATEST(o.final_amount - COALESCE(o.paid_amount, 0), 0) AS outstanding,
           cb.name AS b2b_name, cc.name AS b2c_name
    INTO v_order
    FROM public.orders o
    LEFT JOIN public.customers_b2b cb ON o.customer_id = cb.id
    LEFT JOIN public.customers cc ON o.customer_b2c_id = cc.id
    WHERE o.code = v_code
    LIMIT 1;

    IF v_order.id IS NULL THEN
      v_trans_code := public._gen_finance_tx_code('PT');
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

    v_single_outstanding := COALESCE(v_order.outstanding, 0);
    v_single_alloc := CASE
      WHEN v_single_outstanding > 0 THEN LEAST(p_amount, v_single_outstanding)
      ELSE 0
    END;
    v_excess := p_amount - v_single_alloc;

    IF v_order.customer_id IS NOT NULL THEN
      v_partner_type := 'customer_b2b'; v_partner_id := v_order.customer_id::TEXT; v_partner_name := v_order.b2b_name;
    ELSE
      v_partner_type := 'customer'; v_partner_id := v_order.customer_b2c_id::TEXT; v_partner_name := v_order.b2c_name;
    END IF;

    IF v_single_alloc > 0 THEN
      v_trans_code := public._gen_finance_tx_code('PT');
      INSERT INTO public.finance_transactions (
        code, amount, flow, business_type, fund_account_id,
        partner_type, partner_id, partner_name_cache,
        ref_type, ref_id, description, status, bank_reference_id
      ) VALUES (
        v_trans_code, v_single_alloc, 'in', 'trade', v_fund_id,
        v_partner_type, v_partner_id, COALESCE(v_partner_name, 'Khách lẻ'),
        'order', v_order.code,
        'Hệ thống tự động gạch nợ. ND gốc: ' || COALESCE(p_memo, ''),
        'completed', p_bank_ref_id
      );
      UPDATE public.orders SET payment_method = 'bank_transfer' WHERE id = v_order.id;
      v_allocated_orders := v_allocated_orders || jsonb_build_array(
        jsonb_build_object('order_code', v_order.code, 'amount', v_single_alloc, 'trans_code', v_trans_code)
      );
    END IF;

    IF v_excess > 0 THEN
      v_trans_code := public._gen_finance_tx_code('PT');
      INSERT INTO public.finance_transactions (
        code, amount, flow, business_type, fund_account_id,
        partner_type, partner_id, partner_name_cache,
        description, status, bank_reference_id
      ) VALUES (
        v_trans_code, v_excess, 'in', 'other', v_fund_id,
        v_partner_type, v_partner_id, COALESCE(v_partner_name, 'Khách lẻ'),
        'Dư sau gạch nợ đơn ' || v_order.code || '. ND gốc: ' || COALESCE(p_memo, ''),
        'pending',
        p_bank_ref_id || '-excess'
      );
    END IF;

    RETURN jsonb_build_object(
      'status', 'success',
      'allocated', v_allocated_orders,
      'excess', v_excess
    );
  END IF;

  -- MULTI-ORDER branch — clamp alloc theo outstanding để không overpay
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
    -- [FIX] Clamp 3 chiều: proportional + outstanding + remaining
    v_alloc_amount := LEAST(
      v_remaining,
      v_outstanding,
      round(p_amount * v_outstanding / v_total_outstanding)
    );
    IF v_alloc_amount <= 0 THEN CONTINUE; END IF;

    IF v_order.customer_id IS NOT NULL THEN
      v_partner_type := 'customer_b2b'; v_partner_id := v_order.customer_id::TEXT; v_partner_name := v_order.b2b_name;
    ELSE
      v_partner_type := 'customer'; v_partner_id := v_order.customer_b2c_id::TEXT; v_partner_name := v_order.b2c_name;
    END IF;

    v_trans_code := public._gen_finance_tx_code('PT');
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
    UPDATE public.orders SET payment_method = 'bank_transfer' WHERE id = v_order.id;

    v_remaining := v_remaining - v_alloc_amount;
    v_allocated_orders := v_allocated_orders || jsonb_build_array(
      jsonb_build_object('order_code', v_order.code, 'amount', v_alloc_amount, 'trans_code', v_trans_code)
    );
  END LOOP;

  IF v_remaining > 0 THEN
    v_trans_code := public._gen_finance_tx_code('PT');
    INSERT INTO public.finance_transactions (
      code, amount, flow, business_type, fund_account_id,
      description, status, bank_reference_id
    ) VALUES (
      v_trans_code, v_remaining, 'in', 'other', v_fund_id,
      'Dư sau gạch nợ multi-order (' || array_to_string(v_codes, ',') || '). ND gốc: ' || COALESCE(p_memo, ''),
      'pending',
      p_bank_ref_id || '-remainder'
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'success',
    'allocated', v_allocated_orders,
    'excess', v_remaining
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
