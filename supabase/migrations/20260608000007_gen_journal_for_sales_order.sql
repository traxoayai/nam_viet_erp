-- RPC sinh but toan BAN HANG + GIA VON (trang thai NHAP/draft) tu 1 don hang.
-- Muc dich: hook ghi so doanh thu khi ban hang (POS/B2B) ma KHONG bat user ban hang
-- phai co quyen ke toan — vi chi tao but toan NHAP, ke toan duyet (finance.post_journal)
-- moi cap nhat so du. Goi non-blocking tu client sau khi tao don thanh cong.
--
-- CHINH SACH KE TOAN (⚠️ CHO PM/KE TOAN XAC NHAN truoc khi deploy):
--   1. Chi ghi SO INTERNAL (so noi bo = giao dich thuc). So TAX (thue) lay doanh thu
--      tu HOA DON VAT phat hanh rieng — KHONG ghi o day de tranh nhan doi (dual-ledger,
--      memory: "KHONG sync 2 so").
--   2. Doanh thu (5111) = orders.final_amount (don KHONG nhung VAT — invoice_status='none'
--      luc tao don). VAT=0 o buoc nay.
--   3. Gia von (632) = SUM(order_items.base_quantity * products.actual_cost). actual_cost
--      la BASE UNIT cost (xac nhan tu migration 20260325000013), base_quantity cung base
--      unit -> dung don vi. Bao gom ca hang tang (is_gift) vi ton kho van xuat.
--   4. Bo qua don order_type='opening_debt' (cong no dau ky, khong phai ban hang thuc).
--   5. Idempotent theo (book=INTERNAL, source_ref_type='orders', source_ref_id, doc_type).
-- Ngay 2026-06-08.
BEGIN;

CREATE OR REPLACE FUNCTION public.gen_journal_for_sales_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_order RECORD;
  v_period bigint;
  v_revenue numeric;
  v_cogs numeric;
  v_partner text;
  v_date date;
  v_entry_sale bigint := NULL;
  v_entry_cogs bigint := NULL;
  v_acc131 uuid; v_acc5111 uuid; v_acc632 uuid; v_acc156 uuid;
BEGIN
  PERFORM public.check_rpc_access('gen_journal_for_sales_order');

  SELECT id, code, order_type, final_amount, customer_id, created_at::date AS d
    INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Đơn hàng % không tồn tại', p_order_id;
  END IF;

  -- (4) Bo qua don cong no dau ky
  IF v_order.order_type = 'opening_debt' THEN
    RETURN jsonb_build_object('skipped', 'opening_debt');
  END IF;

  -- (5) Idempotent
  IF EXISTS (
    SELECT 1 FROM public.journal_entries
    WHERE book = 'INTERNAL' AND source_ref_type = 'orders'
      AND source_ref_id = p_order_id::text AND doc_type IN ('sale', 'cogs')
  ) THEN
    RETURN jsonb_build_object('skipped', 'already_booked');
  END IF;

  v_revenue := COALESCE(v_order.final_amount, 0);
  v_date := COALESCE(v_order.d, CURRENT_DATE);
  v_partner := v_order.customer_id::text;

  -- (3) Gia von theo base unit
  SELECT COALESCE(SUM(oi.base_quantity * COALESCE(p.actual_cost, 0)), 0)
    INTO v_cogs
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = p_order_id;

  v_period := public.acc_get_or_create_period('INTERNAL', v_date);
  IF (SELECT status FROM public.accounting_periods WHERE id = v_period) = 'closed' THEN
    RAISE EXCEPTION 'Kỳ INTERNAL tháng % đã khóa, không thể ghi sổ đơn %', v_date, p_order_id;
  END IF;

  SELECT id INTO v_acc131  FROM public.chart_of_accounts WHERE account_code = '131';
  SELECT id INTO v_acc5111 FROM public.chart_of_accounts WHERE account_code = '5111';
  SELECT id INTO v_acc632  FROM public.chart_of_accounts WHERE account_code = '632';
  SELECT id INTO v_acc156  FROM public.chart_of_accounts WHERE account_code = '156';
  IF v_acc131 IS NULL OR v_acc5111 IS NULL THEN
    RAISE EXCEPTION 'Thiếu TK 131/5111 trong chart_of_accounts (seed TT133 chưa đủ?)';
  END IF;

  -- But toan DOANH THU: No 131 / Co 5111 (so INTERNAL, khong VAT)
  IF v_revenue > 0 THEN
    INSERT INTO public.journal_entries(
      book, entry_date, period_id, doc_type, source_ref_type, source_ref_id,
      description, status, created_by, total_debit, total_credit)
    VALUES ('INTERNAL', v_date, v_period, 'sale', 'orders', p_order_id::text,
      'Doanh thu đơn ' || COALESCE(v_order.code, p_order_id::text), 'draft', auth.uid(),
      v_revenue, v_revenue)
    RETURNING id INTO v_entry_sale;
    INSERT INTO public.journal_entry_lines(entry_id, account_id, debit, credit, partner_id, description, line_no)
    VALUES
      (v_entry_sale, v_acc131,  v_revenue, 0, v_partner, 'Phải thu khách hàng', 1),
      (v_entry_sale, v_acc5111, 0, v_revenue, NULL,      'Doanh thu bán hàng',  2);
  END IF;

  -- But toan GIA VON: No 632 / Co 156 (so INTERNAL)
  IF v_cogs > 0 AND v_acc632 IS NOT NULL AND v_acc156 IS NOT NULL THEN
    INSERT INTO public.journal_entries(
      book, entry_date, period_id, doc_type, source_ref_type, source_ref_id,
      description, status, created_by, total_debit, total_credit)
    VALUES ('INTERNAL', v_date, v_period, 'cogs', 'orders', p_order_id::text,
      'Giá vốn đơn ' || COALESCE(v_order.code, p_order_id::text), 'draft', auth.uid(),
      v_cogs, v_cogs)
    RETURNING id INTO v_entry_cogs;
    INSERT INTO public.journal_entry_lines(entry_id, account_id, debit, credit, partner_id, description, line_no)
    VALUES
      (v_entry_cogs, v_acc632, v_cogs, 0, NULL, 'Giá vốn hàng bán', 1),
      (v_entry_cogs, v_acc156, 0, v_cogs, NULL, 'Xuất kho hàng bán', 2);
  END IF;

  RETURN jsonb_build_object(
    'entry_sale', v_entry_sale,
    'entry_cogs', v_entry_cogs,
    'revenue', v_revenue,
    'cogs', v_cogs,
    'book', 'INTERNAL');
END $fn$;

GRANT EXECUTE ON FUNCTION public.gen_journal_for_sales_order(uuid) TO authenticated, service_role;

-- Rule: required_permission = NULL => check_rpc_access bo qua kiem quyen (moi user da
-- dang nhap goi duoc) nhung VAN rate-limit + ghi audit log (is_write=true). An toan vi
-- chi tao NHAP; post (vao so) doi finance.post_journal.
INSERT INTO public.rpc_access_rules(function_name, required_permission, max_calls_per_minute, is_write, description)
VALUES ('gen_journal_for_sales_order', NULL, 120, true, 'Sinh but toan ban hang + gia von (nhap) tu don hang - so INTERNAL')
ON CONFLICT (function_name) DO UPDATE SET required_permission = EXCLUDED.required_permission,
  max_calls_per_minute = EXCLUDED.max_calls_per_minute, is_write = EXCLUDED.is_write, description = EXCLUDED.description;

COMMIT;
