-- BCTC reports: Bảng cân đối tài khoản + KQKD (B02-DNN TT133). Ngày 2026-06-07. Idempotent.
BEGIN;

-- ─── RPC 1: get_trial_balance ─────────────────────────────────────────────────
-- Bảng cân đối tài khoản: mỗi dòng 1 TK có số dư/phát sinh trong kỳ.
CREATE OR REPLACE FUNCTION public.get_trial_balance(
  p_book  text,
  p_year  int,
  p_month int
) RETURNS TABLE (
  account_code   text,
  account_name   text,
  opening_debit  numeric,
  opening_credit numeric,
  period_debit   numeric,
  period_credit  numeric,
  closing_debit  numeric,
  closing_credit numeric
) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_period_id bigint;
BEGIN
  PERFORM public.check_rpc_access('get_trial_balance');

  -- Lấy period_id theo (book, year, month)
  SELECT id INTO v_period_id
  FROM public.accounting_periods
  WHERE book = p_book AND year = p_year AND month = p_month;

  -- Nếu chưa có kỳ → trả rỗng
  IF v_period_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    coa.account_code,
    coa.name          AS account_name,
    ab.opening_debit,
    ab.opening_credit,
    ab.period_debit,
    ab.period_credit,
    ab.closing_debit,
    ab.closing_credit
  FROM public.account_balances ab
  JOIN public.chart_of_accounts coa ON coa.id = ab.account_id
  WHERE ab.book = p_book
    AND ab.period_id = v_period_id
    -- Chỉ lấy dòng có bất kỳ giá trị <> 0
    AND (
      ab.opening_debit  <> 0 OR ab.opening_credit  <> 0 OR
      ab.period_debit   <> 0 OR ab.period_credit   <> 0 OR
      ab.closing_debit  <> 0 OR ab.closing_credit  <> 0
    )
  ORDER BY coa.account_code;
END $fn$;

-- ─── RPC 2: get_income_statement ─────────────────────────────────────────────
-- KQKD (B02-DNN TT133): tính từ phát sinh trong kỳ của account_balances.
-- Doanh thu = period_credit - period_debit của nhóm TK doanh thu.
-- Chi phí  = period_debit  - period_credit của nhóm TK chi phí.
CREATE OR REPLACE FUNCTION public.get_income_statement(
  p_book  text,
  p_year  int,
  p_month int
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_period_id         bigint;

  -- Doanh thu & chi phí thô
  v_511               numeric := 0;  -- doanh thu bán hàng (511%)
  v_632               numeric := 0;  -- giá vốn (632%)
  v_515               numeric := 0;  -- doanh thu tài chính (515%)
  v_635               numeric := 0;  -- chi phí tài chính (635%)
  v_642               numeric := 0;  -- chi phí QLKD: 642% (6421+6422+...)
  v_711               numeric := 0;  -- thu nhập khác (711%)
  v_811               numeric := 0;  -- chi phí khác (811%)
  v_821               numeric := 0;  -- chi phí thuế TNDN (821%)

  -- Chỉ tiêu tổng hợp
  v_loi_nhuan_gop     numeric;
  v_loi_nhuan_thuan   numeric;
  v_loi_nhuan_khac    numeric;
  v_tong_truoc_thue   numeric;
  v_sau_thue          numeric;
BEGIN
  PERFORM public.check_rpc_access('get_income_statement');

  -- Lấy period_id
  SELECT id INTO v_period_id
  FROM public.accounting_periods
  WHERE book = p_book AND year = p_year AND month = p_month;

  -- Kỳ chưa tồn tại → trả jsonb rỗng (tất cả 0)
  IF v_period_id IS NULL THEN
    RETURN jsonb_build_object(
      'doanh_thu_ban_hang',      0,
      'doanh_thu_thuan',         0,
      'gia_von',                 0,
      'loi_nhuan_gop',           0,
      'doanh_thu_tai_chinh',     0,
      'chi_phi_tai_chinh',       0,
      'chi_phi_qlkd',            0,
      'loi_nhuan_thuan',         0,
      'thu_nhap_khac',           0,
      'chi_phi_khac',            0,
      'loi_nhuan_khac',          0,
      'tong_loi_nhuan_truoc_thue', 0,
      'chi_phi_thue_tndn',       0,
      'loi_nhuan_sau_thue',      0
    );
  END IF;

  -- SUM theo prefix account_code từ account_balances JOIN chart_of_accounts
  -- 511%: Doanh thu bán hàng — Có thuần = period_credit - period_debit
  SELECT COALESCE(SUM(ab.period_credit - ab.period_debit), 0) INTO v_511
  FROM public.account_balances ab
  JOIN public.chart_of_accounts coa ON coa.id = ab.account_id
  WHERE ab.book = p_book AND ab.period_id = v_period_id
    AND coa.account_code LIKE '511%';

  -- 632%: Giá vốn hàng bán — Nợ thuần = period_debit - period_credit
  SELECT COALESCE(SUM(ab.period_debit - ab.period_credit), 0) INTO v_632
  FROM public.account_balances ab
  JOIN public.chart_of_accounts coa ON coa.id = ab.account_id
  WHERE ab.book = p_book AND ab.period_id = v_period_id
    AND coa.account_code LIKE '632%';

  -- 515%: Doanh thu tài chính — Có thuần
  SELECT COALESCE(SUM(ab.period_credit - ab.period_debit), 0) INTO v_515
  FROM public.account_balances ab
  JOIN public.chart_of_accounts coa ON coa.id = ab.account_id
  WHERE ab.book = p_book AND ab.period_id = v_period_id
    AND coa.account_code LIKE '515%';

  -- 635%: Chi phí tài chính — Nợ thuần
  SELECT COALESCE(SUM(ab.period_debit - ab.period_credit), 0) INTO v_635
  FROM public.account_balances ab
  JOIN public.chart_of_accounts coa ON coa.id = ab.account_id
  WHERE ab.book = p_book AND ab.period_id = v_period_id
    AND coa.account_code LIKE '635%';

  -- 642%: Chi phí QLKD (gồm 6421, 6422, v.v.) — Nợ thuần
  SELECT COALESCE(SUM(ab.period_debit - ab.period_credit), 0) INTO v_642
  FROM public.account_balances ab
  JOIN public.chart_of_accounts coa ON coa.id = ab.account_id
  WHERE ab.book = p_book AND ab.period_id = v_period_id
    AND coa.account_code LIKE '642%';

  -- 711%: Thu nhập khác — Có thuần
  SELECT COALESCE(SUM(ab.period_credit - ab.period_debit), 0) INTO v_711
  FROM public.account_balances ab
  JOIN public.chart_of_accounts coa ON coa.id = ab.account_id
  WHERE ab.book = p_book AND ab.period_id = v_period_id
    AND coa.account_code LIKE '711%';

  -- 811%: Chi phí khác — Nợ thuần
  SELECT COALESCE(SUM(ab.period_debit - ab.period_credit), 0) INTO v_811
  FROM public.account_balances ab
  JOIN public.chart_of_accounts coa ON coa.id = ab.account_id
  WHERE ab.book = p_book AND ab.period_id = v_period_id
    AND coa.account_code LIKE '811%';

  -- 821%: Chi phí thuế TNDN — Nợ thuần
  SELECT COALESCE(SUM(ab.period_debit - ab.period_credit), 0) INTO v_821
  FROM public.account_balances ab
  JOIN public.chart_of_accounts coa ON coa.id = ab.account_id
  WHERE ab.book = p_book AND ab.period_id = v_period_id
    AND coa.account_code LIKE '821%';

  -- Tính các chỉ tiêu tổng hợp
  v_loi_nhuan_gop   := v_511 - v_632;                         -- mã 20
  v_loi_nhuan_thuan := v_loi_nhuan_gop + v_515 - v_635 - v_642; -- mã 30
  v_loi_nhuan_khac  := v_711 - v_811;                         -- mã 40
  v_tong_truoc_thue := v_loi_nhuan_thuan + v_loi_nhuan_khac;  -- mã 50
  v_sau_thue        := v_tong_truoc_thue - v_821;              -- mã 60

  RETURN jsonb_build_object(
    'doanh_thu_ban_hang',        v_511,            -- mã 01
    'doanh_thu_thuan',           v_511,            -- mã 10 (TT133 đơn giản: = 511)
    'gia_von',                   v_632,            -- mã 11
    'loi_nhuan_gop',             v_loi_nhuan_gop,  -- mã 20
    'doanh_thu_tai_chinh',       v_515,            -- mã 21
    'chi_phi_tai_chinh',         v_635,            -- mã 22
    'chi_phi_qlkd',              v_642,            -- mã 24
    'loi_nhuan_thuan',           v_loi_nhuan_thuan,-- mã 30
    'thu_nhap_khac',             v_711,            -- mã 31
    'chi_phi_khac',              v_811,            -- mã 32
    'loi_nhuan_khac',            v_loi_nhuan_khac, -- mã 40
    'tong_loi_nhuan_truoc_thue', v_tong_truoc_thue,-- mã 50
    'chi_phi_thue_tndn',         v_821,            -- mã 51
    'loi_nhuan_sau_thue',        v_sau_thue        -- mã 60
  );
END $fn$;

-- ─── GRANT ────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_trial_balance(text, int, int)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_income_statement(text, int, int) TO authenticated, service_role;

-- ─── rpc_access_rules ─────────────────────────────────────────────────────────
INSERT INTO public.rpc_access_rules(function_name, required_permission, max_calls_per_minute, is_write, description)
VALUES
  ('get_trial_balance',    'finance.view_balance', 120, false, 'Bảng cân đối tài khoản'),
  ('get_income_statement', 'finance.view_balance', 120, false, 'Kết quả kinh doanh B02-DNN TT133')
ON CONFLICT (function_name) DO UPDATE
  SET required_permission    = EXCLUDED.required_permission,
      max_calls_per_minute   = EXCLUDED.max_calls_per_minute,
      is_write               = EXCLUDED.is_write,
      description            = EXCLUDED.description;

COMMIT;
