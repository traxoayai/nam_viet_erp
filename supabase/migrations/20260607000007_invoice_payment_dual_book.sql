-- RPC create_invoice_payment: thanh toán HĐ + bù trừ chênh lệch 2 sổ (711/811).
-- Ngày 2026-06-07. Idempotent.
BEGIN;

CREATE OR REPLACE FUNCTION public.create_invoice_payment(
  p_invoice_id      bigint,
  p_actual_amount   numeric,
  p_fund_account_id bigint,
  p_entry_date      date,
  p_partner         text,
  p_desc            text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $fn$
DECLARE
  v_inv       RECORD;
  v_total     numeric;
  v_diff      numeric;
  v_fund_code text;
  v_fund_type text;
  v_warning   text := NULL;
  v_entry     bigint;
  v_book      text;
  v_lines     jsonb;
  v_ids       bigint[] := '{}';
BEGIN
  PERFORM public.check_rpc_access('create_invoice_payment');

  -- Kiểm tra hóa đơn tồn tại
  SELECT * INTO v_inv FROM public.finance_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hóa đơn #% không tồn tại', p_invoice_id;
  END IF;

  -- Kiểm tra số tiền thực trả
  IF COALESCE(p_actual_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Số tiền thực trả phải > 0';
  END IF;

  -- Tổng tiền chính thức từ hóa đơn
  v_total := COALESCE(v_inv.total_amount_post_tax, 0);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Hóa đơn chưa có tổng tiền hợp lệ';
  END IF;

  -- Lấy thông tin quỹ (tài khoản kế toán + loại quỹ)
  SELECT account_id, type::text
    INTO v_fund_code, v_fund_type
    FROM public.fund_accounts
   WHERE id = p_fund_account_id;

  IF v_fund_code IS NULL THEN
    RAISE EXCEPTION 'Quỹ #% chưa gán tài khoản kế toán (fund_accounts.account_id)', p_fund_account_id;
  END IF;

  -- Cảnh báo HĐ VAT >= 5tr trả tiền mặt (KHÔNG chặn giao dịch)
  -- ĐỂ CHẶN: bỏ comment dòng RAISE bên dưới
  IF v_total >= 5000000 AND v_fund_type = 'cash' THEN
    v_warning := 'Hóa đơn VAT từ 5 triệu trở lên nên thanh toán qua ngân hàng để được khấu trừ thuế GTGT.';
    -- RAISE EXCEPTION '%', v_warning;
  END IF;

  -- Chênh lệch = tổng HĐ - thực trả (>0: trả ít; <0: trả nhiều; =0: đúng)
  v_diff := v_total - p_actual_amount;

  -- (1) Phiếu CHÍNH THỨC: Nợ 331 / Có [quỹ] = v_total
  --     Ghi CẢ 2 sổ (INTERNAL + TAX) → triệt tiêu công nợ chính thức
  v_lines := jsonb_build_array(
    jsonb_build_object(
      'account_code', '331',
      'debit',        v_total,
      'credit',       0,
      'partner_id',   p_partner,
      'description',  'Thanh toán NCC (chính thức)'
    ),
    jsonb_build_object(
      'account_code', v_fund_code,
      'debit',        0,
      'credit',       v_total,
      'description',  'Chi trả NCC'
    )
  );

  FOREACH v_book IN ARRAY ARRAY['INTERNAL', 'TAX'] LOOP
    v_entry := public.acc_create_journal_entry(
      v_book,
      p_entry_date,
      'payment',
      'finance_invoices',
      p_invoice_id::text,
      COALESCE(p_desc, 'Thanh toán HĐ ') || COALESCE(v_inv.invoice_number, ''),
      v_lines
    );
    PERFORM public.post_journal_entry(v_entry);
    v_ids := array_append(v_ids, v_entry);
  END LOOP;

  -- (2) Phiếu BÙ TRỪ chênh lệch (CHỈ sổ INTERNAL)
  --     v_diff > 0: trả ít hơn HĐ → lợi nội bộ: Nợ [quỹ] / Có 711
  --     v_diff < 0: trả nhiều hơn HĐ → chi phí nội bộ: Nợ 811 / Có [quỹ]
  IF v_diff <> 0 THEN
    IF v_diff > 0 THEN
      -- Trả ít hơn HĐ → thu nhập khác
      v_lines := jsonb_build_array(
        jsonb_build_object(
          'account_code', v_fund_code,
          'debit',        v_diff,
          'credit',       0,
          'description',  'Chênh lệch trả ít hơn HĐ'
        ),
        jsonb_build_object(
          'account_code', '711',
          'debit',        0,
          'credit',       v_diff,
          'description',  'Thu nhập khác (chênh lệch thanh toán)'
        )
      );
    ELSE
      -- Trả nhiều hơn HĐ → chi phí khác (v_diff âm, lấy abs)
      v_lines := jsonb_build_array(
        jsonb_build_object(
          'account_code', '811',
          'debit',        (-v_diff),
          'credit',       0,
          'description',  'Chi phí khác (chênh lệch thanh toán)'
        ),
        jsonb_build_object(
          'account_code', v_fund_code,
          'debit',        0,
          'credit',       (-v_diff),
          'description',  'Chênh lệch trả nhiều hơn HĐ'
        )
      );
    END IF;

    v_entry := public.acc_create_journal_entry(
      'INTERNAL',
      p_entry_date,
      'payment',
      'finance_invoices',
      p_invoice_id::text,
      'Bù trừ chênh lệch thanh toán HĐ',
      v_lines
    );
    PERFORM public.post_journal_entry(v_entry);
    v_ids := array_append(v_ids, v_entry);
  END IF;

  -- (3) Cập nhật HĐ: đánh dấu đã tất toán (công nợ chính thức = 0)
  UPDATE public.finance_invoices
     SET paid_amount    = v_total,
         payment_status = 'PAID'
   WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'entry_ids',  to_jsonb(v_ids),
    'warning',    v_warning,
    'difference', v_diff
  );
END $fn$;

ALTER FUNCTION public.create_invoice_payment(bigint, numeric, bigint, date, text, text)
  OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.create_invoice_payment(bigint, numeric, bigint, date, text, text)
  TO authenticated, service_role;

INSERT INTO public.rpc_access_rules(
  function_name, required_permission, max_calls_per_minute, is_write, description
) VALUES (
  'create_invoice_payment',
  'finance.view_balance',
  60,
  true,
  'Thanh toán HĐ + bù trừ chênh lệch 2 sổ'
) ON CONFLICT (function_name) DO UPDATE
  SET required_permission  = EXCLUDED.required_permission,
      max_calls_per_minute = EXCLUDED.max_calls_per_minute,
      is_write             = EXCLUDED.is_write,
      description          = EXCLUDED.description;

COMMIT;
