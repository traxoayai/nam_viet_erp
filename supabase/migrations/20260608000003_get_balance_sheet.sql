-- RPC get_balance_sheet: Bang can doi ke toan B01a-DNN (TT133). 2026-06-08.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_balance_sheet(p_book text, p_year int, p_month int)
RETURNS TABLE(ma_so text, ten_chi_tieu text, so_tien numeric)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_period bigint;
BEGIN
  PERFORM public.check_rpc_access('get_balance_sheet');
  SELECT id INTO v_period FROM public.accounting_periods WHERE book=p_book AND year=p_year AND month=p_month;
  RETURN QUERY
  SELECT m.ma_so, MAX(m.ten_chi_tieu) AS ten_chi_tieu,
         COALESCE(SUM(
           m.sign * CASE
             WHEN m.side='debit'  THEN (b.closing_debit - b.closing_credit)
             WHEN m.side='credit' THEN (b.closing_credit - b.closing_debit)
             ELSE (b.closing_debit - b.closing_credit) END
         ),0) AS so_tien
  FROM public.bctc_line_mapping m
  LEFT JOIN public.chart_of_accounts a ON a.account_code LIKE m.account_prefix || '%'
  LEFT JOIN public.account_balances b ON b.account_id=a.id AND b.book=p_book AND b.period_id=v_period
  WHERE m.report='B01a'
  GROUP BY m.ma_so ORDER BY MAX(m.sort_order);
END $fn$;
GRANT EXECUTE ON FUNCTION public.get_balance_sheet(text,int,int) TO authenticated, service_role;
INSERT INTO public.rpc_access_rules(function_name,required_permission,max_calls_per_minute,is_write,description)
VALUES ('get_balance_sheet','finance.view_balance',60,false,'BCTC - Bang can doi ke toan B01a')
ON CONFLICT (function_name) DO UPDATE SET required_permission=EXCLUDED.required_permission,
  max_calls_per_minute=EXCLUDED.max_calls_per_minute, is_write=EXCLUDED.is_write, description=EXCLUDED.description;
COMMIT;
