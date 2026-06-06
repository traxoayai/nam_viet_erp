-- Hạch toán: post bút toán (cộng số dư) + void (hoàn số dư). Ngày 2026-06-07.
BEGIN;

CREATE OR REPLACE FUNCTION public.post_journal_entry(p_entry_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_je RECORD; v_l RECORD;
BEGIN
  PERFORM public.check_rpc_access('post_journal_entry');
  SELECT * INTO v_je FROM public.journal_entries WHERE id=p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bút toán #% không tồn tại', p_entry_id; END IF;
  IF v_je.status <> 'draft' THEN RAISE EXCEPTION 'Chỉ post được bút toán nháp (hiện: %)', v_je.status; END IF;
  IF round(v_je.total_debit,2) <> round(v_je.total_credit,2) THEN
    RAISE EXCEPTION 'Bút toán không cân, không thể post';
  END IF;
  IF (SELECT status FROM public.accounting_periods WHERE id=v_je.period_id)='closed' THEN
    RAISE EXCEPTION 'Kỳ đã khóa, không thể post';
  END IF;
  FOR v_l IN SELECT account_id, debit, credit FROM public.journal_entry_lines WHERE entry_id=p_entry_id LOOP
    INSERT INTO public.account_balances(book,account_id,period_id,period_debit,period_credit)
    VALUES (v_je.book, v_l.account_id, v_je.period_id, v_l.debit, v_l.credit)
    ON CONFLICT (book,account_id,period_id) DO UPDATE SET
      period_debit  = account_balances.period_debit  + EXCLUDED.period_debit,
      period_credit = account_balances.period_credit + EXCLUDED.period_credit,
      updated_at    = now();
    UPDATE public.account_balances b
    SET closing_debit  = b.opening_debit  + b.period_debit,
        closing_credit = b.opening_credit + b.period_credit
    WHERE b.book=v_je.book AND b.account_id=v_l.account_id AND b.period_id=v_je.period_id;
  END LOOP;
  UPDATE public.journal_entries SET status='posted', posted_at=now(), posted_by=auth.uid() WHERE id=p_entry_id;
END $fn$;

CREATE OR REPLACE FUNCTION public.void_journal_entry(p_entry_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_je RECORD; v_l RECORD;
BEGIN
  PERFORM public.check_rpc_access('void_journal_entry');
  SELECT * INTO v_je FROM public.journal_entries WHERE id=p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bút toán #% không tồn tại', p_entry_id; END IF;
  IF (SELECT status FROM public.accounting_periods WHERE id=v_je.period_id)='closed' THEN
    RAISE EXCEPTION 'Kỳ đã khóa, không thể hủy';
  END IF;
  IF v_je.status='posted' THEN
    FOR v_l IN SELECT account_id, debit, credit FROM public.journal_entry_lines WHERE entry_id=p_entry_id LOOP
      UPDATE public.account_balances b
      SET period_debit=b.period_debit-v_l.debit, period_credit=b.period_credit-v_l.credit,
          closing_debit=b.opening_debit+(b.period_debit-v_l.debit),
          closing_credit=b.opening_credit+(b.period_credit-v_l.credit), updated_at=now()
      WHERE b.book=v_je.book AND b.account_id=v_l.account_id AND b.period_id=v_je.period_id;
    END LOOP;
  END IF;
  UPDATE public.journal_entries SET status='void' WHERE id=p_entry_id;
END $fn$;

GRANT EXECUTE ON FUNCTION public.post_journal_entry(bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.void_journal_entry(bigint) TO authenticated, service_role;
INSERT INTO public.rpc_access_rules(function_name,required_permission,max_calls_per_minute,is_write,description) VALUES
  ('post_journal_entry','finance.view_balance',120,true,'Post bút toán'),
  ('void_journal_entry','finance.view_balance',60,true,'Hủy bút toán')
ON CONFLICT (function_name) DO UPDATE SET required_permission=EXCLUDED.required_permission,
  max_calls_per_minute=EXCLUDED.max_calls_per_minute, is_write=EXCLUDED.is_write, description=EXCLUDED.description;

COMMIT;
