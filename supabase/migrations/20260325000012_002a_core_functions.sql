-- =====================================================
-- Migration 002: Business Logic (Sales + VAT + Stock + PO)
-- Merged from: 005, 006, 007, 008, 009
-- Date: 2026-03-31
-- =====================================================

-- Note: Supabase CLI wraps each migration in a transaction automatically

-- =====================================================
-- SECTION 1: DROP old function signatures (cleanup overloads)
-- =====================================================

-- Drop old UUID-returning create_sales_order (from 20260325000002)
DROP FUNCTION IF EXISTS public.create_sales_order(
  bigint, uuid, bigint, text, text, text, numeric, jsonb, text, text, text, numeric, bigint, text, bigint
);

-- Drop old create_sales_order with UUID p_customer_b2c_id (from 20260328000003 era)
DROP FUNCTION IF EXISTS public.create_sales_order(
  p_items JSONB,
  p_customer_id BIGINT,
  p_customer_b2b_id BIGINT,
  p_customer_b2c_id UUID,
  p_status TEXT,
  p_payment_method TEXT,
  p_discount_amount NUMERIC,
  p_shipping_fee NUMERIC,
  p_shipping_partner_id BIGINT,
  p_delivery_method TEXT,
  p_delivery_address TEXT,
  p_delivery_time TIMESTAMPTZ,
  p_note TEXT,
  p_warehouse_id BIGINT,
  p_order_type TEXT
);

-- Drop old alphabetical-param-order overload (from 20260325000002)
DROP FUNCTION IF EXISTS public.create_sales_order(
  bigint, bigint, bigint, text, text, text, numeric, jsonb, text, text, text, numeric, bigint, text, bigint
);

-- Drop old jsonb-returning bulk_update_product_barcodes
DROP FUNCTION IF EXISTS public.bulk_update_product_barcodes(jsonb);

-- Drop both quick_assign_barcode overloads to start clean
DROP FUNCTION IF EXISTS public.quick_assign_barcode(BIGINT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.quick_assign_barcode(BIGINT, BIGINT, TEXT);

-- Drop old get_purchase_orders_master (7-param version without p_status)
DROP FUNCTION IF EXISTS public.get_purchase_orders_master(integer, integer, text, text, text, timestamp with time zone, timestamp with time zone);

-- Drop ambiguous uuid[] overload of confirm_order_payment
DROP FUNCTION IF EXISTS public.confirm_order_payment(uuid[], bigint);


-- =====================================================
-- SECTION 2: Helper Functions
-- =====================================================

-- 2a. _resolve_conversion_factor (FINAL from 009 with SET search_path)
CREATE OR REPLACE FUNCTION public._resolve_conversion_factor(
  p_product_id BIGINT,
  p_uom TEXT,
  p_explicit_factor NUMERIC DEFAULT 0
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE v_factor NUMERIC;
BEGIN
  IF p_explicit_factor > 0 THEN RETURN p_explicit_factor; END IF;
  SELECT conversion_rate INTO v_factor
  FROM public.product_units
  WHERE product_id = p_product_id AND unit_name = p_uom LIMIT 1;
  RETURN COALESCE(v_factor, 1);
END;
$fn$;


-- 2b. _validate_stock_availability (FINAL from 005 line 400 with SET search_path)
CREATE OR REPLACE FUNCTION public._validate_stock_availability(
  p_warehouse_id BIGINT,
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
  v_item JSONB;
  v_factor NUMERIC;
  v_base_qty NUMERIC;
  v_available NUMERIC;
  v_product_name TEXT;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_factor := public._resolve_conversion_factor(
      (v_item->>'product_id')::BIGINT,
      v_item->>'uom',
      COALESCE((v_item->>'conversion_factor')::NUMERIC, 0)
    );
    v_base_qty := (v_item->>'quantity')::NUMERIC * v_factor;

    -- Lock rows first, then aggregate (FOR UPDATE not allowed with SUM)
    PERFORM 1 FROM public.inventory_batches
    WHERE warehouse_id = p_warehouse_id
      AND product_id = (v_item->>'product_id')::BIGINT
      AND quantity > 0
    FOR UPDATE;

    SELECT COALESCE(SUM(quantity), 0) INTO v_available
    FROM public.inventory_batches
    WHERE warehouse_id = p_warehouse_id
      AND product_id = (v_item->>'product_id')::BIGINT
      AND quantity > 0;

    IF v_available < v_base_qty THEN
      SELECT name INTO v_product_name FROM public.products WHERE id = (v_item->>'product_id')::BIGINT;
      RAISE EXCEPTION 'Không đủ tồn kho cho "%". Cần: %, Tồn: %',
        COALESCE(v_product_name, 'SP #' || (v_item->>'product_id')), v_base_qty, v_available;
    END IF;
  END LOOP;
END;
$fn$;


-- 2c. _deduct_stock_fefo (FINAL: strict no-negative from 005 + NULLIF cast from 007 + SET search_path)
CREATE OR REPLACE FUNCTION public._deduct_stock_fefo(
  p_warehouse_id BIGINT,
  p_product_id BIGINT,
  p_base_quantity NUMERIC,
  p_unit_price NUMERIC,
  p_order_code TEXT,
  p_partner_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
  v_remaining NUMERIC := p_base_quantity;
  v_deduct NUMERIC;
  v_batch RECORD;
BEGIN
  FOR v_batch IN
    SELECT ib.id, ib.quantity, ib.batch_id, b.batch_code
    FROM public.inventory_batches ib
    JOIN public.batches b ON ib.batch_id = b.id
    WHERE ib.warehouse_id = p_warehouse_id
      AND ib.product_id = p_product_id
      AND ib.quantity > 0
    ORDER BY b.expiry_date ASC, ib.id ASC
  LOOP
    IF v_remaining <= 0 THEN EXIT; END IF;
    v_deduct := LEAST(v_batch.quantity, v_remaining);

    UPDATE public.inventory_batches
    SET quantity = quantity - v_deduct, updated_at = NOW()
    WHERE id = v_batch.id;

    INSERT INTO public.inventory_transactions (
      warehouse_id, product_id, batch_id, partner_id,
      type, action_group, quantity, unit_price,
      ref_id, description, created_by, created_at
    ) VALUES (
      p_warehouse_id, p_product_id, v_batch.batch_id, NULLIF(p_partner_id, '')::BIGINT,
      'out', 'sale', (v_deduct * -1), p_unit_price,
      p_order_code, 'Xuất bán (Lô: ' || v_batch.batch_code || ')',
      auth.uid(), NOW()
    );
    v_remaining := v_remaining - v_deduct;
  END LOOP;

  -- Strict check: no negative inventory allowed
  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Khong du ton kho cho SP #% tai kho #% sau khi tru FEFO. Con thieu: %',
      p_product_id, p_warehouse_id, v_remaining;
  END IF;
END;
$fn$;


-- =====================================================
-- SECTION 3: Sales Order (create_sales_order - FINAL)
-- BIGINT params, SET search_path, created_by, code column, partner_id::text
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_sales_order(
  p_items JSONB,
  p_customer_id BIGINT DEFAULT NULL,
  p_customer_b2b_id BIGINT DEFAULT NULL,
  p_customer_b2c_id BIGINT DEFAULT NULL,
  p_status TEXT DEFAULT 'CONFIRMED',
  p_payment_method TEXT DEFAULT 'cash',
  p_discount_amount NUMERIC DEFAULT 0,
  p_shipping_fee NUMERIC DEFAULT 0,
  p_shipping_partner_id BIGINT DEFAULT NULL,
  p_delivery_method TEXT DEFAULT NULL,
  p_delivery_address TEXT DEFAULT NULL,
  p_delivery_time TIMESTAMPTZ DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_warehouse_id BIGINT DEFAULT NULL,
  p_order_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
  v_order_id UUID;
  v_code TEXT;
  v_ft_code TEXT;
  v_item JSONB;
  v_total_amount NUMERIC := 0;
  v_final_amount NUMERIC := 0;
  v_unit_price NUMERIC;
  v_quantity NUMERIC;
  v_discount NUMERIC;
  v_conversion_factor NUMERIC;
  v_base_quantity_needed NUMERIC;
  v_prefix TEXT;
  v_final_b2b_id BIGINT;
  v_loyalty_points_earned INT := 0;
  v_safe_order_type TEXT;
  v_partner_id BIGINT;
  v_partner_type TEXT;
BEGIN
  -- 0. PERMISSION GUARD
  PERFORM public.check_rpc_access('create_sales_order');

  -- A. VALIDATION
  IF p_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Bắt buộc phải chọn Kho xuất hàng (p_warehouse_id).';
  END IF;

  -- B. SETUP ORDER TYPE & CODE
  IF p_order_type IS NULL OR p_order_type = '' THEN
    IF p_customer_b2c_id IS NOT NULL THEN v_safe_order_type := 'POS'; ELSE v_safe_order_type := 'B2B'; END IF;
  ELSE
    v_safe_order_type := p_order_type;
  END IF;

  v_final_b2b_id := COALESCE(p_customer_b2b_id, p_customer_id);

  IF v_safe_order_type = 'POS' THEN v_prefix := 'POS-'; ELSE v_prefix := 'SO-'; END IF;
  v_code := v_prefix || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  -- C. PRE-FLIGHT STOCK CHECK (locks rows, raises if insufficient)
  IF p_status IN ('CONFIRMED', 'COMPLETED', 'PACKED', 'SHIPPING', 'DELIVERED', 'DONE') THEN
    PERFORM public._validate_stock_availability(p_warehouse_id, p_items);
  END IF;

  -- D. INSERT ORDER HEADER
  INSERT INTO public.orders (
    code, customer_id, customer_b2c_id, creator_id, status, order_type,
    payment_method, remittance_status, delivery_address, delivery_time, note,
    discount_amount, shipping_fee, shipping_partner_id, delivery_method, warehouse_id,
    total_amount, final_amount, paid_amount, payment_status, created_at, updated_at
  ) VALUES (
    v_code, v_final_b2b_id, p_customer_b2c_id, auth.uid(), p_status, v_safe_order_type,
    p_payment_method, CASE WHEN p_payment_method = 'cash' THEN 'pending' ELSE 'skipped' END,
    COALESCE(p_delivery_address, ''), p_delivery_time, p_note,
    COALESCE(p_discount_amount, 0), COALESCE(p_shipping_fee, 0), p_shipping_partner_id, p_delivery_method, p_warehouse_id,
    0, 0, 0, 'unpaid', NOW(), NOW()
  ) RETURNING id INTO v_order_id;

  -- E. PROCESS ITEMS
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity      := (v_item->>'quantity')::NUMERIC;
    v_unit_price    := (v_item->>'unit_price')::NUMERIC;
    v_discount      := COALESCE((v_item->>'discount')::NUMERIC, 0);

    v_conversion_factor := public._resolve_conversion_factor(
      (v_item->>'product_id')::BIGINT,
      v_item->>'uom',
      COALESCE((v_item->>'conversion_factor')::NUMERIC, 0)
    );
    v_base_quantity_needed := v_quantity * v_conversion_factor;

    INSERT INTO public.order_items (
      order_id, product_id, quantity, uom, conversion_factor,
      unit_price, discount, is_gift, note
    ) VALUES (
      v_order_id, (v_item->>'product_id')::BIGINT, v_quantity, v_item->>'uom', v_conversion_factor,
      v_unit_price, v_discount, COALESCE((v_item->>'is_gift')::BOOLEAN, false), v_item->>'note'
    );

    IF p_status IN ('CONFIRMED', 'COMPLETED', 'PACKED', 'SHIPPING', 'DELIVERED', 'DONE') THEN
      PERFORM public._deduct_stock_fefo(
        p_warehouse_id,
        (v_item->>'product_id')::BIGINT,
        v_base_quantity_needed,
        v_unit_price,
        v_code,
        v_final_b2b_id::TEXT
      );
    END IF;

    v_total_amount := v_total_amount + (v_quantity * v_unit_price);
  END LOOP;

  -- F. UPDATE TOTALS
  v_final_amount := v_total_amount - COALESCE(p_discount_amount, 0) + COALESCE(p_shipping_fee, 0);
  UPDATE public.orders
  SET total_amount    = v_total_amount,
      final_amount    = v_final_amount,
      paid_amount     = CASE WHEN p_payment_method = 'cash' THEN v_final_amount ELSE 0 END,
      payment_status  = CASE WHEN p_payment_method = 'cash' THEN 'paid' ELSE 'unpaid' END
  WHERE id = v_order_id;

  -- G. AUTO FINANCE TRANSACTION (cash payment only)
  -- BUG FIXES: use created_by (not creator_id), include code column, cast partner_id::text
  IF p_payment_method = 'cash' AND v_final_amount > 0 THEN
    v_partner_id   := COALESCE(p_customer_b2c_id, v_final_b2b_id);
    v_partner_type := CASE WHEN p_customer_b2c_id IS NOT NULL THEN 'customer' ELSE 'customer_b2b' END;

    -- Generate finance transaction code: FT-YYMMDD-XXXX
    v_ft_code := 'FT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    INSERT INTO public.finance_transactions (
      code, amount, flow, business_type, description,
      ref_type, ref_id,
      partner_id, partner_type,
      created_by, status, created_at,
      fund_account_id
    ) VALUES (
      v_ft_code,
      v_final_amount, 'in', 'trade',
      'Thanh toán đơn hàng ' || v_code,
      'order', v_code,
      v_partner_id::text,
      v_partner_type,
      auth.uid(), 'completed', NOW(),
      1
    );
  END IF;

  RETURN jsonb_build_object(
    'order_id',              v_order_id,
    'code',                  v_code,
    'total_amount',          v_total_amount,
    'final_amount',          v_final_amount,
    'loyalty_points_earned', v_loyalty_points_earned
  );
END;
$fn$;


-- =====================================================
-- SECTION 4: VAT Invoice Functions
-- =====================================================

-- 4a. deduct_vat_for_pos_export (FINAL from 006 line 402 with SET search_path)
CREATE OR REPLACE FUNCTION public.deduct_vat_for_pos_export(
  p_product_id BIGINT,
  p_vat_rate NUMERIC,
  p_base_qty NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
  v_current_balance NUMERIC;
BEGIN
  SELECT quantity_balance INTO v_current_balance
  FROM public.vat_inventory_ledger
  WHERE product_id = p_product_id AND vat_rate = p_vat_rate
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy kho VAT cho SP #% (VAT %)', p_product_id, p_vat_rate;
  END IF;

  IF v_current_balance < p_base_qty THEN
    RAISE EXCEPTION 'Không đủ kho VAT cho SP #%. Cần: %, Tồn: %',
      p_product_id, p_base_qty, v_current_balance;
  END IF;

  UPDATE public.vat_inventory_ledger
  SET quantity_balance = quantity_balance - p_base_qty,
      updated_at = NOW()
  WHERE product_id = p_product_id AND vat_rate = p_vat_rate;
END;
$fn$;


-- 4b. batch_deduct_vat_for_pos (FINAL from 006 line 447 with SET search_path)
CREATE OR REPLACE FUNCTION public.batch_deduct_vat_for_pos(p_items JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
  v_item JSONB;
  v_product_id BIGINT;
  v_vat_rate NUMERIC;
  v_qty NUMERIC;
  v_unit TEXT;
  v_conversion_rate NUMERIC;
  v_base_qty NUMERIC;
  v_current_balance NUMERIC;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::BIGINT;
    v_vat_rate := COALESCE((v_item->>'vat_rate')::NUMERIC, 0);
    v_qty := COALESCE((v_item->>'quantity')::NUMERIC, 0);
    v_unit := COALESCE(v_item->>'unit', 'Viên');

    IF v_qty <= 0 THEN CONTINUE; END IF;

    SELECT conversion_rate INTO v_conversion_rate
    FROM public.product_units
    WHERE product_id = v_product_id AND unit_name = v_unit LIMIT 1;
    v_conversion_rate := COALESCE(v_conversion_rate, 1);
    v_base_qty := v_qty * v_conversion_rate;

    SELECT quantity_balance INTO v_current_balance
    FROM public.vat_inventory_ledger
    WHERE product_id = v_product_id AND vat_rate = v_vat_rate
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Không tìm thấy kho VAT cho SP #% (VAT %)', v_product_id, v_vat_rate;
    END IF;
    IF v_current_balance < v_base_qty THEN
      RAISE EXCEPTION 'Không đủ kho VAT SP #%. Cần: %, Tồn: %', v_product_id, v_base_qty, v_current_balance;
    END IF;

    UPDATE public.vat_inventory_ledger
    SET quantity_balance = quantity_balance - v_base_qty, updated_at = NOW()
    WHERE product_id = v_product_id AND vat_rate = v_vat_rate;
  END LOOP;
END;
$fn$;


-- 4c. process_vat_export_entry (FINAL from 006 line 264 with SET search_path, strict validation)
CREATE OR REPLACE FUNCTION public.process_vat_export_entry(p_invoice_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
  v_invoice RECORD;
  v_item JSONB;
  v_product_id BIGINT;
  v_unit_name TEXT;
  v_qty_input NUMERIC;
  v_vat_rate NUMERIC;
  v_conversion_rate NUMERIC;
  v_qty_base NUMERIC;
  v_current_balance NUMERIC;
BEGIN
  -- 0. Permission guard
  PERFORM public.check_rpc_access('process_vat_export_entry');

  -- 1. Get invoice
  SELECT * INTO v_invoice FROM public.finance_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hóa đơn #% không tồn tại', p_invoice_id;
  END IF;

  -- 2. Loop through raw_items
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_invoice.raw_items, '[]'::JSONB))
  LOOP
    v_qty_input := COALESCE((v_item->>'quantity')::NUMERIC, 0);
    IF v_qty_input <= 0 THEN CONTINUE; END IF;

    -- Strict unit validation: no fallback default
    v_unit_name := COALESCE(NULLIF(TRIM(v_item->>'unit'), ''), NULLIF(TRIM(v_item->>'internal_unit'), ''));
    IF v_unit_name IS NULL THEN
      RAISE EXCEPTION 'Item thieu don vi tinh (unit). Invoice #%', p_invoice_id;
    END IF;

    v_vat_rate := COALESCE((v_item->>'vat_rate')::NUMERIC, 0);

    -- Mandatory product_id: no name-based fallback
    v_product_id := (v_item->>'product_id')::BIGINT;
    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Item thieu product_id. Invoice #%, item: %', p_invoice_id, v_item->>'product_name';
    END IF;

    -- Find conversion rate
    SELECT conversion_rate INTO v_conversion_rate
    FROM public.product_units
    WHERE product_id = v_product_id AND unit_name = v_unit_name
    LIMIT 1;
    IF v_conversion_rate IS NULL THEN
      RAISE EXCEPTION 'Khong tim thay don vi "%" cho SP #%. Invoice #%',
        v_unit_name, v_product_id, p_invoice_id;
    END IF;

    v_qty_base := v_qty_input * v_conversion_rate;

    -- Check VAT inventory (with FOR UPDATE lock)
    SELECT quantity_balance INTO v_current_balance
    FROM public.vat_inventory_ledger
    WHERE product_id = v_product_id AND vat_rate = v_vat_rate
    FOR UPDATE;

    IF NOT FOUND OR v_current_balance < v_qty_base THEN
      RAISE EXCEPTION 'Khong du kho VAT cho SP #% (VAT %): Can %, Ton %',
        v_product_id, v_vat_rate, v_qty_base, COALESCE(v_current_balance, 0);
    END IF;

    -- Deduct
    UPDATE public.vat_inventory_ledger
    SET quantity_balance = quantity_balance - v_qty_base,
        updated_at = NOW()
    WHERE product_id = v_product_id AND vat_rate = v_vat_rate;
  END LOOP;
END;
$fn$;


-- 4d. delete_invoice_atomic (FINAL from 006 line 360 - self-contained, no undefined function call)
CREATE OR REPLACE FUNCTION public.delete_invoice_atomic(p_invoice_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
  v_invoice RECORD;
BEGIN
  PERFORM public.check_rpc_access('delete_invoice_atomic');

  SELECT * INTO v_invoice FROM public.finance_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hóa đơn #% không tồn tại', p_invoice_id;
  END IF;

  -- If verified, insert negative reversal entries (audit trail)
  IF v_invoice.status = 'verified' THEN
    INSERT INTO public.vat_inventory_ledger (
      invoice_id, product_id, quantity, unit_price, direction, note, created_at
    )
    SELECT
      p_invoice_id, vil.product_id, -ABS(vil.quantity), vil.unit_price,
      'reversal', 'Auto-reverse khi xóa HĐ #' || p_invoice_id, NOW()
    FROM public.vat_inventory_ledger vil
    WHERE vil.invoice_id = p_invoice_id AND vil.quantity > 0;
  END IF;

  DELETE FROM public.finance_invoice_allocations WHERE invoice_id = p_invoice_id;
  DELETE FROM public.finance_invoices WHERE id = p_invoice_id;
END;
$fn$;
