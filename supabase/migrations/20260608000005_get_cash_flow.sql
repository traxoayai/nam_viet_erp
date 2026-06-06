-- RPC get_cash_flow: Luu chuyen tien te (truc tiep) - TK 111/112. 2026-06-08.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_cash_flow(p_book text, p_year int, p_month int)
RETURNS TABLE(dong_tien_vao numeric, dong_tien_ra numeric, luu_chuyen_thuan numeric)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_period bigint;
BEGIN
  PERFORM public.check_rpc_access('get_cash_flow');
  SELECT id INTO v_period FROM public.accounting_periods WHERE book=p_book AND year=p_year AND month=p_month;
  RETURN QUERY
  SELECT COALESCE(SUM(b.period_debit),0) AS dong_tien_vao,
         COALESCE(SUM(b.period_credit),0) AS dong_tien_ra,
         COALESCE(SUM(b.period_debit - b.period_credit),0) AS luu_chuyen_thuan
  FROM public.account_balances b
  JOIN public.chart_of_accounts a ON a.id=b.account_id
  WHERE b.book=p_book AND b.period_id=v_period
    AND (a.account_code LIKE '111%' OR a.account_code LIKE '112%');
END $fn$;
GRANT EXECUTE ON FUNCTION public.get_cash_flow(text,int,int) TO authenticated, service_role;
INSERT INTO public.rpc_access_rules(function_name,required_permission,max_calls_per_minute,is_write,description)
VALUES ('get_cash_flow','finance.view_balance',60,false,'Luu chuyen tien te (truc tiep)')
ON CONFLICT (function_name) DO UPDATE SET required_permission=EXCLUDED.required_permission,
  max_calls_per_minute=EXCLUDED.max_calls_per_minute, is_write=EXCLUDED.is_write, description=EXCLUDED.description;
COMMIT;
