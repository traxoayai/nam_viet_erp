-- Khóa kỳ + kết chuyển cuối kỳ (TT133): 5xx/7xx -> 911, 6xx/8xx -> 911, 911 -> 4212. Ngày 2026-06-07.
BEGIN;
CREATE OR REPLACE FUNCTION public.acc_close_period(p_book text, p_year int, p_month int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_period bigint; v_date date := (make_date(p_year,p_month,1) + interval '1 month' - interval '1 day')::date;
  v_rev numeric := 0; v_exp numeric := 0; v_pl numeric;
  v_lines jsonb; v_entry bigint; v_rec RECORD; v_next bigint; v_next_date date;
  v_status text; v_next_status text;
BEGIN
  PERFORM public.check_rpc_access('acc_close_period');
  SELECT id, status INTO v_period, v_status
  FROM public.accounting_periods
  WHERE book=p_book AND year=p_year AND month=p_month
  FOR UPDATE;
  IF v_period IS NULL THEN RAISE EXCEPTION 'Chưa có kỳ %/% sổ %', p_month,p_year,p_book; END IF;
  IF v_status='closed' THEN RAISE EXCEPTION 'Kỳ đã khóa'; END IF;

  -- (1) Kết chuyển doanh thu (5xx,7xx dư Có) -> 911: mỗi TK 1 dòng Nợ, tổng 1 dòng Có 911
  v_lines := '[]'::jsonb;
  FOR v_rec IN
    SELECT a.account_code AS code, (b.period_credit - b.period_debit) AS amt
    FROM public.account_balances b JOIN public.chart_of_accounts a ON a.id=b.account_id
    WHERE b.book=p_book AND b.period_id=v_period
      AND (a.account_code LIKE '5%' OR a.account_code LIKE '7%')
      AND (b.period_credit - b.period_debit) <> 0
  LOOP
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_code',v_rec.code,'debit',v_rec.amt,'credit',0,'description','K/c doanh thu'));
    v_rev := v_rev + v_rec.amt;
  END LOOP;
  IF v_rev <> 0 THEN
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_code','911','debit',0,'credit',v_rev,'description','K/c doanh thu'));
    v_entry := public.acc_create_journal_entry(p_book,v_date,'closing','accounting_periods',v_period::text,'Kết chuyển doanh thu',v_lines);
    PERFORM public.post_journal_entry(v_entry);
  END IF;

  -- (2) Kết chuyển chi phí (6xx,8xx dư Nợ) -> 911: mỗi TK 1 dòng Có, tổng 1 dòng Nợ 911
  v_lines := '[]'::jsonb;
  FOR v_rec IN
    SELECT a.account_code AS code, (b.period_debit - b.period_credit) AS amt
    FROM public.account_balances b JOIN public.chart_of_accounts a ON a.id=b.account_id
    WHERE b.book=p_book AND b.period_id=v_period
      AND (a.account_code LIKE '6%' OR a.account_code LIKE '8%')
      AND (b.period_debit - b.period_credit) <> 0
  LOOP
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_code',v_rec.code,'debit',0,'credit',v_rec.amt,'description','K/c chi phí'));
    v_exp := v_exp + v_rec.amt;
  END LOOP;
  IF v_exp <> 0 THEN
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_code','911','debit',v_exp,'credit',0,'description','K/c chi phí'));
    v_entry := public.acc_create_journal_entry(p_book,v_date,'closing','accounting_periods',v_period::text,'Kết chuyển chi phí',v_lines);
    PERFORM public.post_journal_entry(v_entry);
  END IF;

  -- (3) Lãi/lỗ 911 -> 4212
  v_pl := v_rev - v_exp;
  IF v_pl > 0 THEN
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code','911','debit',v_pl,'credit',0,'description','Kết chuyển lãi'),
      jsonb_build_object('account_code','4212','debit',0,'credit',v_pl,'description','Lãi trong kỳ'));
    v_entry := public.acc_create_journal_entry(p_book,v_date,'closing','accounting_periods',v_period::text,'Kết chuyển lãi',v_lines);
    PERFORM public.post_journal_entry(v_entry);
  ELSIF v_pl < 0 THEN
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code','4212','debit',-v_pl,'credit',0,'description','Lỗ trong kỳ'),
      jsonb_build_object('account_code','911','debit',0,'credit',-v_pl,'description','Kết chuyển lỗ'));
    v_entry := public.acc_create_journal_entry(p_book,v_date,'closing','accounting_periods',v_period::text,'Kết chuyển lỗ',v_lines);
    PERFORM public.post_journal_entry(v_entry);
  END IF;

  -- (4) Khóa kỳ
  UPDATE public.accounting_periods SET status='closed', closed_at=now() WHERE id=v_period;

  -- (5) Bê số dư cuối kỳ -> đầu kỳ kế tiếp (chỉ TK tài sản/nguồn vốn: 1,2,3,4; bỏ 5,6,7,8,911)
  v_next_date := v_date + 1;
  v_next := public.acc_get_or_create_period(p_book, v_next_date);
  SELECT status INTO v_next_status FROM public.accounting_periods WHERE id=v_next;
  IF v_next_status = 'closed' THEN
    RAISE EXCEPTION 'Kỳ kế tiếp đã khóa — không thể bê số dư. Mở lại kỳ sau trước khi đóng kỳ này.';
  END IF;
  INSERT INTO public.account_balances(book,account_id,period_id,opening_debit,opening_credit,closing_debit,closing_credit)
  SELECT b.book, b.account_id, v_next,
         GREATEST(b.closing_debit-b.closing_credit,0), GREATEST(b.closing_credit-b.closing_debit,0),
         GREATEST(b.closing_debit-b.closing_credit,0), GREATEST(b.closing_credit-b.closing_debit,0)
  FROM public.account_balances b JOIN public.chart_of_accounts a ON a.id=b.account_id
  WHERE b.book=p_book AND b.period_id=v_period
    AND a.account_code NOT LIKE '5%' AND a.account_code NOT LIKE '6%'
    AND a.account_code NOT LIKE '7%' AND a.account_code NOT LIKE '8%' AND a.account_code <> '911'
    AND (b.closing_debit - b.closing_credit) <> 0
  ON CONFLICT (book,account_id,period_id) DO UPDATE SET
    opening_debit  = EXCLUDED.opening_debit,
    opening_credit = EXCLUDED.opening_credit,
    closing_debit  = EXCLUDED.opening_debit  + account_balances.period_debit,
    closing_credit = EXCLUDED.opening_credit + account_balances.period_credit;
END $fn$;

GRANT EXECUTE ON FUNCTION public.acc_close_period(text,int,int) TO authenticated, service_role;
INSERT INTO public.rpc_access_rules(function_name,required_permission,max_calls_per_minute,is_write,description)
VALUES ('acc_close_period','finance.view_balance',20,true,'Khóa kỳ + kết chuyển')
ON CONFLICT (function_name) DO UPDATE SET required_permission=EXCLUDED.required_permission,
  max_calls_per_minute=EXCLUDED.max_calls_per_minute, is_write=EXCLUDED.is_write, description=EXCLUDED.description;
COMMIT;
