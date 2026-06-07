-- gen_journal_for_sales_order v2 — fix theo adversarial review 2026-06-08:
--   #1 Idempotency PER doc_type: check 'sale' va 'cogs' RIENG (truoc đây check chung
--      doc_type IN('sale','cogs') -> neu lan 1 chi co 'sale' (actual_cost=0/NULL, cogs=0)
--      thi backfill gia von sau bi chan vinh vien -> thieu 632/156, lai thoi phong).
--   #2 Race-safe: pg_advisory_xact_lock theo order (pattern record_manual_payment_received)
--      -> 2 lan goi dong thoi khong tao trung but toan.
--   #3 Status gate: chi ghi nhan DT cho don ĐA xuat/giao/ban (PACKED/SHIPPING/DELIVERED/
--      COMPLETED). Bo qua PENDING/QUOTE/DRAFT/CONFIRMED/CANCELLED (chua xuat kho -> chua
--      ghi nhan; tranh ghi so don bao gia/da huy).
--   #4 Tach phi van chuyen: 5111 = tien hang (final - shipping_fee), 5113 = phi ship
--      (doanh thu dich vu). No 131 = tong final_amount (phai thu day du).
--   #5 RAISE neu thieu TK 632/156 khi cogs>0 (truoc đây nuot im lang).
-- Giu nguyen: CHI so INTERNAL, opening_debt skip, draft (ke toan duyet moi vao so).
-- Ngay 2026-06-08.
BEGIN;

CREATE OR REPLACE FUNCTION public.gen_journal_for_sales_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_order RECORD;
  v_period bigint;
  v_recv numeric;      -- tong phai thu (No 131) = final_amount
  v_revenue numeric;   -- doanh thu hang hoa (Co 5111) = final - shipping
  v_shipping numeric;  -- doanh thu dich vu van chuyen (Co 5113)
  v_cogs numeric;
  v_partner text;
  v_date date;
  v_has_sale boolean;
  v_has_cogs boolean;
  v_entry_sale bigint := NULL;
  v_entry_cogs bigint := NULL;
  v_acc131 uuid; v_acc5111 uuid; v_acc5113 uuid; v_acc632 uuid; v_acc156 uuid;
BEGIN
  PERFORM public.check_rpc_access('gen_journal_for_sales_order');
  -- (#2) Khoa theo don -> chong race 2 lan goi dong thoi
  PERFORM pg_advisory_xact_lock(hashtextextended('sales-journal-' || p_order_id::text, 0));

  SELECT id, code, order_type, status, final_amount, shipping_fee, customer_id, created_at::date AS d
    INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Đơn hàng % không tồn tại', p_order_id;
  END IF;

  IF v_order.order_type = 'opening_debt' THEN
    RETURN jsonb_build_object('skipped', 'opening_debt');
  END IF;

  -- (#3) Chi ghi nhan DT cho don da thuc su xuat kho/giao/ban
  IF v_order.status NOT IN ('PACKED', 'SHIPPING', 'DELIVERED', 'COMPLETED') THEN
    RETURN jsonb_build_object('skipped', 'status_not_recognizable', 'status', v_order.status);
  END IF;

  v_recv := COALESCE(v_order.final_amount, 0);
  v_shipping := COALESCE(v_order.shipping_fee, 0);
  v_revenue := v_recv - v_shipping;   -- (#4) tach phi ship khoi doanh thu hang hoa
  v_date := COALESCE(v_order.d, CURRENT_DATE);
  v_partner := v_order.customer_id::text;

  SELECT COALESCE(SUM(oi.base_quantity * COALESCE(p.actual_cost, 0)), 0)
    INTO v_cogs
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = p_order_id;

  -- (#1) Idempotency PER doc_type
  v_has_sale := EXISTS (SELECT 1 FROM public.journal_entries
    WHERE book='INTERNAL' AND source_ref_type='orders' AND source_ref_id=p_order_id::text AND doc_type='sale');
  v_has_cogs := EXISTS (SELECT 1 FROM public.journal_entries
    WHERE book='INTERNAL' AND source_ref_type='orders' AND source_ref_id=p_order_id::text AND doc_type='cogs');

  -- Da co ca 2 (hoac da co phan can thiet) -> khong con gi de them
  IF (v_has_sale OR v_recv <= 0) AND (v_has_cogs OR v_cogs <= 0) THEN
    RETURN jsonb_build_object('skipped', 'already_booked', 'has_sale', v_has_sale, 'has_cogs', v_has_cogs);
  END IF;

  v_period := public.acc_get_or_create_period('INTERNAL', v_date);
  IF (SELECT status FROM public.accounting_periods WHERE id = v_period) = 'closed' THEN
    RAISE EXCEPTION 'Kỳ INTERNAL tháng % đã khóa, không thể ghi sổ đơn %', v_date, p_order_id;
  END IF;

  SELECT id INTO v_acc131  FROM public.chart_of_accounts WHERE account_code = '131';
  SELECT id INTO v_acc5111 FROM public.chart_of_accounts WHERE account_code = '5111';
  SELECT id INTO v_acc5113 FROM public.chart_of_accounts WHERE account_code = '5113';
  SELECT id INTO v_acc632  FROM public.chart_of_accounts WHERE account_code = '632';
  SELECT id INTO v_acc156  FROM public.chart_of_accounts WHERE account_code = '156';

  -- DOANH THU (chi tao khi chua co + co phai thu)
  IF NOT v_has_sale AND v_recv > 0 THEN
    IF v_acc131 IS NULL OR v_acc5111 IS NULL THEN
      RAISE EXCEPTION 'Thiếu TK 131/5111 trong chart_of_accounts (seed TT133 chưa đủ?)';
    END IF;
    IF v_shipping > 0 AND v_acc5113 IS NULL THEN
      RAISE EXCEPTION 'Thiếu TK 5113 (doanh thu dịch vụ) để ghi phí vận chuyển';
    END IF;
    INSERT INTO public.journal_entries(
      book, entry_date, period_id, doc_type, source_ref_type, source_ref_id,
      description, status, created_by, total_debit, total_credit)
    VALUES ('INTERNAL', v_date, v_period, 'sale', 'orders', p_order_id::text,
      'Doanh thu đơn ' || COALESCE(v_order.code, p_order_id::text), 'draft', auth.uid(), v_recv, v_recv)
    RETURNING id INTO v_entry_sale;
    INSERT INTO public.journal_entry_lines(entry_id, account_id, debit, credit, partner_id, description, line_no)
    VALUES
      (v_entry_sale, v_acc131,  v_recv,    0, v_partner, 'Phải thu khách hàng', 1),
      (v_entry_sale, v_acc5111, 0, v_revenue, NULL,      'Doanh thu bán hàng',  2);
    IF v_shipping > 0 THEN
      INSERT INTO public.journal_entry_lines(entry_id, account_id, debit, credit, partner_id, description, line_no)
      VALUES (v_entry_sale, v_acc5113, 0, v_shipping, NULL, 'Doanh thu phí vận chuyển', 3);
    END IF;
  END IF;

  -- GIA VON (chi tao khi chua co + co gia von) — (#1) tach khoi sale, (#5) RAISE neu thieu TK
  IF NOT v_has_cogs AND v_cogs > 0 THEN
    IF v_acc632 IS NULL OR v_acc156 IS NULL THEN
      RAISE EXCEPTION 'Thiếu TK 632/156 trong chart_of_accounts cho giá vốn';
    END IF;
    INSERT INTO public.journal_entries(
      book, entry_date, period_id, doc_type, source_ref_type, source_ref_id,
      description, status, created_by, total_debit, total_credit)
    VALUES ('INTERNAL', v_date, v_period, 'cogs', 'orders', p_order_id::text,
      'Giá vốn đơn ' || COALESCE(v_order.code, p_order_id::text), 'draft', auth.uid(), v_cogs, v_cogs)
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
    'shipping', v_shipping,
    'cogs', v_cogs,
    'book', 'INTERNAL');
END $fn$;

COMMIT;
