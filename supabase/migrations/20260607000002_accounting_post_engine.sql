-- Engine nền hạch toán: get/create kỳ, tạo bút toán nháp (cân Nợ=Có). Ngày 2026-06-07.
BEGIN;

CREATE OR REPLACE FUNCTION public.acc_get_or_create_period(p_book text, p_date date)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_id bigint; v_y int := extract(year from p_date); v_m int := extract(month from p_date);
BEGIN
  SELECT id INTO v_id FROM public.accounting_periods WHERE book=p_book AND year=v_y AND month=v_m;
  IF v_id IS NULL THEN
    INSERT INTO public.accounting_periods(book,year,month) VALUES (p_book,v_y,v_m)
    ON CONFLICT (book,year,month) DO UPDATE SET book=EXCLUDED.book RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $fn$;

CREATE OR REPLACE FUNCTION public.acc_create_journal_entry(
  p_book text, p_entry_date date, p_doc_type text,
  p_source_ref_type text, p_source_ref_id text, p_description text, p_lines jsonb
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_period bigint; v_entry bigint; v_line jsonb; v_acc uuid;
  v_td numeric := 0; v_tc numeric := 0; v_no int := 0;
BEGIN
  PERFORM public.check_rpc_access('acc_create_journal_entry');
  IF p_book NOT IN ('vat','actual') THEN RAISE EXCEPTION 'book không hợp lệ: %', p_book; END IF;
  IF jsonb_array_length(COALESCE(p_lines,'[]'::jsonb)) < 2 THEN
    RAISE EXCEPTION 'Bút toán phải có tối thiểu 2 dòng';
  END IF;
  v_period := public.acc_get_or_create_period(p_book, p_entry_date);
  IF (SELECT status FROM public.accounting_periods WHERE id=v_period) = 'closed' THEN
    RAISE EXCEPTION 'Kỳ kế toán đã khóa, không thể thêm bút toán (book=%, ngày=%)', p_book, p_entry_date;
  END IF;
  INSERT INTO public.journal_entries(book,entry_date,period_id,doc_type,source_ref_type,source_ref_id,description,status,created_by)
  VALUES (p_book,p_entry_date,v_period,p_doc_type,p_source_ref_type,p_source_ref_id,p_description,'draft',auth.uid())
  RETURNING id INTO v_entry;
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    SELECT id INTO v_acc FROM public.chart_of_accounts WHERE account_code = (v_line->>'account_code');
    IF v_acc IS NULL THEN RAISE EXCEPTION 'Không tìm thấy TK %', v_line->>'account_code'; END IF;
    v_no := v_no + 1;
    INSERT INTO public.journal_entry_lines(entry_id,account_id,debit,credit,partner_id,description,line_no)
    VALUES (v_entry, v_acc, COALESCE((v_line->>'debit')::numeric,0), COALESCE((v_line->>'credit')::numeric,0),
            v_line->>'partner_id', v_line->>'description', v_no);
    v_td := v_td + COALESCE((v_line->>'debit')::numeric,0);
    v_tc := v_tc + COALESCE((v_line->>'credit')::numeric,0);
  END LOOP;
  IF round(v_td,2) <> round(v_tc,2) THEN
    RAISE EXCEPTION 'Bút toán không cân: Nợ %=/= Có %', v_td, v_tc;
  END IF;
  UPDATE public.journal_entries SET total_debit=v_td, total_credit=v_tc WHERE id=v_entry;
  RETURN v_entry;
END $fn$;

ALTER FUNCTION public.acc_get_or_create_period(text,date) OWNER TO postgres;
ALTER FUNCTION public.acc_create_journal_entry(text,date,text,text,text,text,jsonb) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.acc_create_journal_entry(text,date,text,text,text,text,jsonb) TO authenticated, service_role;

INSERT INTO public.rpc_access_rules(function_name,required_permission,max_calls_per_minute,is_write,description)
VALUES ('acc_create_journal_entry','finance.view_balance',120,true,'Tạo bút toán nháp')
ON CONFLICT (function_name) DO UPDATE SET required_permission=EXCLUDED.required_permission,
  max_calls_per_minute=EXCLUDED.max_calls_per_minute, is_write=EXCLUDED.is_write, description=EXCLUDED.description;

COMMIT;
