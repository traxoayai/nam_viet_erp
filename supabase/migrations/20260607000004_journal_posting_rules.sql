-- Engine sinh bút toán theo nghiệp vụ (mapping TT133). Ngày 2026-06-07.
BEGIN;

-- MUA HÀNG: Nợ156 (tiền hàng) + Nợ1331 (thuế) / Có331 (phải trả)
CREATE OR REPLACE FUNCTION public.gen_journal_purchase(p_book text, p_invoice_id bigint)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v RECORD; v_goods numeric; v_tax numeric; v_total numeric; v_lines jsonb;
BEGIN
  PERFORM public.check_rpc_access('gen_journal_purchase');
  SELECT * INTO v FROM public.finance_invoices WHERE id=p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hóa đơn #% không tồn tại', p_invoice_id; END IF;
  v_goods := COALESCE(v.total_amount_pre_tax,0);
  v_tax   := COALESCE(v.tax_amount,0);
  v_total := COALESCE(v.total_amount_post_tax, v_goods+v_tax);
  v_lines := jsonb_build_array(
    jsonb_build_object('account_code','156','debit',v_goods,'credit',0,'description','Tiền hàng'),
    jsonb_build_object('account_code','1331','debit',v_tax,'credit',0,'description','Thuế GTGT đầu vào'),
    jsonb_build_object('account_code','331','debit',0,'credit',v_total,
                       'partner_id', COALESCE(v.supplier_id::text, v.supplier_tax_code),'description','Phải trả NCC'));
  IF v_tax = 0 THEN v_lines := v_lines - 1; END IF; -- bỏ dòng thuế nếu = 0
  RETURN public.acc_create_journal_entry(p_book, COALESCE(v.invoice_date, current_date), 'purchase',
    'finance_invoices', p_invoice_id::text, 'Mua hàng HĐ '||COALESCE(v.invoice_number,''), v_lines);
END $fn$;

-- BÁN HÀNG: Nợ131 / Có5111 + Có33311 (tham số revenue/vat để dùng chung POS + B2B + 2 sổ)
CREATE OR REPLACE FUNCTION public.gen_journal_sale(
  p_book text, p_source_id text, p_entry_date date, p_partner text, p_revenue numeric, p_vat numeric
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_lines jsonb; v_total numeric := COALESCE(p_revenue,0)+COALESCE(p_vat,0);
BEGIN
  PERFORM public.check_rpc_access('gen_journal_sale');
  v_lines := jsonb_build_array(
    jsonb_build_object('account_code','131','debit',v_total,'credit',0,'partner_id',p_partner,'description','Phải thu KH'),
    jsonb_build_object('account_code','5111','debit',0,'credit',COALESCE(p_revenue,0),'description','Doanh thu'),
    jsonb_build_object('account_code','33311','debit',0,'credit',COALESCE(p_vat,0),'description','Thuế GTGT đầu ra'));
  IF COALESCE(p_vat,0)=0 THEN v_lines := v_lines - 2; END IF;
  RETURN public.acc_create_journal_entry(p_book, p_entry_date, 'sale', 'orders', p_source_id,
    'Bán hàng '||p_source_id, v_lines);
END $fn$;

-- GIÁ VỐN: Nợ632 / Có156
CREATE OR REPLACE FUNCTION public.gen_journal_cogs(
  p_book text, p_source_id text, p_entry_date date, p_cogs numeric
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_lines jsonb;
BEGIN
  PERFORM public.check_rpc_access('gen_journal_cogs');
  IF COALESCE(p_cogs,0) <= 0 THEN RAISE EXCEPTION 'Giá vốn phải > 0'; END IF;
  v_lines := jsonb_build_array(
    jsonb_build_object('account_code','632','debit',p_cogs,'credit',0,'description','Giá vốn'),
    jsonb_build_object('account_code','156','debit',0,'credit',p_cogs,'description','Xuất kho'));
  RETURN public.acc_create_journal_entry(p_book, p_entry_date, 'cogs', 'orders', p_source_id, 'Giá vốn '||p_source_id, v_lines);
END $fn$;

-- CHI: Nợ (TK đối ứng) / Có (TK tiền)
CREATE OR REPLACE FUNCTION public.gen_journal_payment(
  p_book text, p_source_id text, p_entry_date date, p_amount numeric,
  p_category_account text, p_fund_account text, p_partner text, p_desc text
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_lines jsonb;
BEGIN
  PERFORM public.check_rpc_access('gen_journal_payment');
  IF COALESCE(p_amount,0)<=0 THEN RAISE EXCEPTION 'Số tiền chi phải > 0'; END IF;
  v_lines := jsonb_build_array(
    jsonb_build_object('account_code',p_category_account,'debit',p_amount,'credit',0,'partner_id',p_partner,'description',p_desc),
    jsonb_build_object('account_code',p_fund_account,'debit',0,'credit',p_amount,'description','Chi tiền'));
  RETURN public.acc_create_journal_entry(p_book, p_entry_date, 'payment', 'finance_transactions', p_source_id, COALESCE(p_desc,'Phiếu chi'), v_lines);
END $fn$;

-- THU: Nợ (TK tiền) / Có (TK đối ứng)
CREATE OR REPLACE FUNCTION public.gen_journal_receipt(
  p_book text, p_source_id text, p_entry_date date, p_amount numeric,
  p_category_account text, p_fund_account text, p_partner text, p_desc text
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_lines jsonb;
BEGIN
  PERFORM public.check_rpc_access('gen_journal_receipt');
  IF COALESCE(p_amount,0)<=0 THEN RAISE EXCEPTION 'Số tiền thu phải > 0'; END IF;
  v_lines := jsonb_build_array(
    jsonb_build_object('account_code',p_fund_account,'debit',p_amount,'credit',0,'description','Thu tiền'),
    jsonb_build_object('account_code',p_category_account,'debit',0,'credit',p_amount,'partner_id',p_partner,'description',p_desc));
  RETURN public.acc_create_journal_entry(p_book, p_entry_date, 'receipt', 'finance_transactions', p_source_id, COALESCE(p_desc,'Phiếu thu'), v_lines);
END $fn$;

GRANT EXECUTE ON FUNCTION public.gen_journal_purchase(text,bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gen_journal_sale(text,text,date,text,numeric,numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gen_journal_cogs(text,text,date,numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gen_journal_payment(text,text,date,numeric,text,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gen_journal_receipt(text,text,date,numeric,text,text,text,text) TO authenticated, service_role;

INSERT INTO public.rpc_access_rules(function_name,required_permission,max_calls_per_minute,is_write,description) VALUES
  ('gen_journal_purchase','finance.view_balance',120,true,'Sinh bút toán mua hàng'),
  ('gen_journal_sale','finance.view_balance',120,true,'Sinh bút toán bán hàng'),
  ('gen_journal_cogs','finance.view_balance',120,true,'Sinh bút toán giá vốn'),
  ('gen_journal_payment','finance.view_balance',120,true,'Sinh bút toán chi'),
  ('gen_journal_receipt','finance.view_balance',120,true,'Sinh bút toán thu')
ON CONFLICT (function_name) DO UPDATE SET required_permission=EXCLUDED.required_permission,
  max_calls_per_minute=EXCLUDED.max_calls_per_minute, is_write=EXCLUDED.is_write, description=EXCLUDED.description;

COMMIT;
