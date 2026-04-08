-- =========================================================================
-- ROLLBACK: 20260408120000_fix_clone_race_pricefilter.sql
-- Restores functions to their state AFTER 20260408110000 (the fixed versions)
-- This rollback ONLY reverts: clone price refresh, FOR UPDATE lock, price filter
-- =========================================================================

-- 1. Restore clone_sales_order to original version (copies old prices)
CREATE OR REPLACE FUNCTION public.clone_sales_order(p_old_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_old_order RECORD;
    v_new_order_id UUID;
    v_new_code TEXT;
    v_prefix TEXT;
BEGIN
    SELECT * INTO v_old_order FROM public.orders WHERE id = p_old_order_id;
    IF v_old_order IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy đơn hàng gốc để nhân bản.';
    END IF;
    IF v_old_order.order_type = 'POS' THEN v_prefix := 'POS-'; ELSE v_prefix := 'SO-'; END IF;
    v_new_code := v_prefix || to_char(now(), 'YYMMDD') || '-' || LPAD(floor(random() * 10000)::text, 4, '0');
    INSERT INTO public.orders (
        code, order_type, customer_id, customer_b2c_id, warehouse_id,
        delivery_address, delivery_time, delivery_method, shipping_partner_id,
        shipping_fee, discount_amount, total_amount, final_amount,
        status, payment_status, payment_method, remittance_status, paid_amount,
        note, creator_id, created_at, updated_at
    ) VALUES (
        v_new_code, v_old_order.order_type, v_old_order.customer_id, v_old_order.customer_b2c_id, v_old_order.warehouse_id,
        v_old_order.delivery_address, v_old_order.delivery_time, v_old_order.delivery_method, v_old_order.shipping_partner_id,
        v_old_order.shipping_fee, v_old_order.discount_amount, v_old_order.total_amount, v_old_order.final_amount,
        'DRAFT', 'unpaid', v_old_order.payment_method,
        CASE WHEN v_old_order.payment_method = 'cash' THEN 'pending' ELSE 'skipped' END,
        0,
        COALESCE(v_old_order.note, '') || E'\n(Nhân bản từ đơn: ' || v_old_order.code || ')',
        auth.uid(), NOW(), NOW()
    ) RETURNING id INTO v_new_order_id;
    INSERT INTO public.order_items (
        order_id, product_id, uom, conversion_factor, quantity, unit_price,
        discount, is_gift, note, quantity_picked, quantity_returned
    )
    SELECT
        v_new_order_id, product_id, uom, conversion_factor, quantity, unit_price,
        discount, is_gift, note, 0, 0
    FROM public.order_items
    WHERE order_id = p_old_order_id;
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Đã tạo bản sao thành công!',
        'new_order_id', v_new_order_id,
        'new_code', v_new_code
    );
END;
$$;

-- 2. Restore create_sales_order to version from 20260408110000
-- (with correct voucher params and JSON path, but WITHOUT FOR UPDATE lock)
-- This is the FIXED version from migration 110000
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
  p_order_type TEXT DEFAULT NULL,
  p_voucher_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
  v_order_id UUID; v_code TEXT; v_ft_code TEXT; v_item JSONB;
  v_total_amount NUMERIC := 0; v_final_amount NUMERIC := 0;
  v_unit_price NUMERIC; v_quantity NUMERIC; v_discount NUMERIC;
  v_conversion_factor NUMERIC; v_base_quantity_needed NUMERIC;
  v_prefix TEXT; v_final_b2b_id BIGINT; v_loyalty_points_earned INT := 0;
  v_safe_order_type TEXT; v_partner_id BIGINT; v_partner_type TEXT;
  v_voucher_discount NUMERIC := 0; v_voucher_check JSONB; v_available_credit NUMERIC;
BEGIN
  PERFORM public.check_rpc_access('create_sales_order');
  IF p_warehouse_id IS NULL THEN RAISE EXCEPTION 'Bắt buộc phải chọn Kho xuất hàng (p_warehouse_id).'; END IF;
  IF p_order_type IS NULL OR p_order_type = '' THEN
    IF p_customer_b2c_id IS NOT NULL THEN v_safe_order_type := 'POS'; ELSE v_safe_order_type := 'B2B'; END IF;
  ELSE v_safe_order_type := p_order_type; END IF;
  v_final_b2b_id := COALESCE(p_customer_b2b_id, p_customer_id);
  IF v_safe_order_type = 'POS' THEN v_prefix := 'POS-'; ELSE v_prefix := 'SO-'; END IF;
  v_code := v_prefix || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total_amount := v_total_amount + ((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC);
  END LOOP;
  IF p_status IN ('CONFIRMED','COMPLETED','PACKED','SHIPPING','DELIVERED','DONE') THEN
    PERFORM public._validate_stock_availability(p_warehouse_id, p_items);
  END IF;
  -- Correct param order (from 110000 fix)
  IF p_voucher_code IS NOT NULL AND p_voucher_code <> '' THEN
      v_voucher_check := public.verify_promotion_code(p_voucher_code, v_final_b2b_id, v_total_amount);
      IF (v_voucher_check->>'valid')::BOOLEAN = false THEN RAISE EXCEPTION 'Voucher không hợp lệ: %', (v_voucher_check->>'message'); END IF;
      v_voucher_discount := (v_voucher_check->>'discount_amount')::NUMERIC;
  END IF;
  v_final_amount := v_total_amount - COALESCE(p_discount_amount, 0) - v_voucher_discount + COALESCE(p_shipping_fee, 0);
  -- NO FOR UPDATE lock (rollback removes it)
  IF v_safe_order_type = 'B2B' AND p_payment_method <> 'cash' AND v_final_b2b_id IS NOT NULL THEN
      SELECT available_credit INTO v_available_credit FROM public.get_customer_exposure_summary(v_final_b2b_id);
      IF (COALESCE(v_available_credit, 0) - v_final_amount) < 0 THEN
          RAISE EXCEPTION 'Đơn hàng vượt quá hạn mức công nợ khả dụng. Khả dụng hiện tại: %đ. Tổng đơn: %đ',
            to_char(COALESCE(v_available_credit, 0), 'FM999G999G999G999'), to_char(v_final_amount, 'FM999G999G999G999');
      END IF;
  END IF;
  INSERT INTO public.orders (code, customer_id, customer_b2c_id, creator_id, status, order_type, payment_method, remittance_status, delivery_address, delivery_time, note, discount_amount, shipping_fee, shipping_partner_id, delivery_method, warehouse_id, total_amount, final_amount, paid_amount, payment_status, created_at, updated_at)
  VALUES (v_code, v_final_b2b_id, p_customer_b2c_id, auth.uid(), p_status, v_safe_order_type, p_payment_method, CASE WHEN p_payment_method='cash' THEN 'pending' ELSE 'skipped' END, COALESCE(p_delivery_address,''), p_delivery_time, p_note, COALESCE(p_discount_amount,0)+v_voucher_discount, COALESCE(p_shipping_fee,0), p_shipping_partner_id, p_delivery_method, p_warehouse_id, v_total_amount, v_final_amount, 0, 'unpaid', NOW(), NOW())
  RETURNING id INTO v_order_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_quantity := (v_item->>'quantity')::NUMERIC; v_unit_price := (v_item->>'unit_price')::NUMERIC; v_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);
    v_conversion_factor := public._resolve_conversion_factor((v_item->>'product_id')::BIGINT, v_item->>'uom', COALESCE((v_item->>'conversion_factor')::NUMERIC, 0));
    v_base_quantity_needed := v_quantity * v_conversion_factor;
    INSERT INTO public.order_items (order_id, product_id, quantity, uom, conversion_factor, unit_price, discount, is_gift, note)
    VALUES (v_order_id, (v_item->>'product_id')::BIGINT, v_quantity, v_item->>'uom', v_conversion_factor, v_unit_price, v_discount, COALESCE((v_item->>'is_gift')::BOOLEAN, false), v_item->>'note');
    IF p_status IN ('CONFIRMED','COMPLETED','PACKED','SHIPPING','DELIVERED','DONE') THEN
      PERFORM public._deduct_stock_fefo(p_warehouse_id, (v_item->>'product_id')::BIGINT, v_base_quantity_needed, v_unit_price, v_code, v_final_b2b_id::TEXT);
    END IF;
  END LOOP;
  -- Correct JSON path (from 110000 fix)
  IF v_voucher_discount > 0 THEN
      INSERT INTO public.promotion_usages (promotion_id, customer_id, order_id, discount_amount) VALUES ((v_voucher_check->'promotion'->>'id')::UUID, v_final_b2b_id, v_order_id, v_voucher_discount);
      UPDATE public.promotions SET usage_count = usage_count + 1 WHERE id = (v_voucher_check->'promotion'->>'id')::UUID;
  END IF;
  IF p_payment_method = 'cash' AND v_final_amount > 0 THEN
    v_partner_id := COALESCE(p_customer_b2c_id, v_final_b2b_id);
    v_partner_type := CASE WHEN p_customer_b2c_id IS NOT NULL THEN 'customer' ELSE 'customer_b2b' END;
    v_ft_code := 'FT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    INSERT INTO public.finance_transactions (code, amount, flow, business_type, description, ref_type, ref_id, partner_id, partner_type, created_by, status, created_at, fund_account_id)
    VALUES (v_ft_code, v_final_amount, 'in', 'trade', 'Thanh toán đơn hàng ' || v_code, 'order', v_code, v_partner_id::text, v_partner_type, auth.uid(), 'completed', NOW(), 1);
    UPDATE public.orders SET paid_amount = v_final_amount, payment_status = 'paid' WHERE id = v_order_id;
  END IF;
  RETURN jsonb_build_object('order_id', v_order_id, 'code', v_code, 'total_amount', v_total_amount, 'final_amount', v_final_amount, 'loyalty_points_earned', v_loyalty_points_earned);
END;
$fn$;

-- 3. Restore get_wholesale_catalog 8-param to version from 20260408110000
-- (with deal pricing but WITHOUT price_min/max filter)
-- Copying from migration 110000 exactly
CREATE OR REPLACE FUNCTION public.get_wholesale_catalog(
  p_search TEXT DEFAULT '', p_category TEXT DEFAULT '', p_manufacturer TEXT DEFAULT '',
  p_price_min NUMERIC DEFAULT 0, p_price_max NUMERIC DEFAULT 0,
  p_page INT DEFAULT 1, p_page_size INT DEFAULT 20, p_sort TEXT DEFAULT 'best-seller'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_offset INT; v_total BIGINT; v_data JSON;
BEGIN
  v_offset := (p_page - 1) * p_page_size;
  SELECT COUNT(*) INTO v_total FROM public.products p WHERE p.status = 'active'
    AND (p_search = '' OR p.fts @@ plainto_tsquery('simple', p_search) OR p.name ILIKE '%' || p_search || '%' OR p.sku ILIKE '%' || p_search || '%' OR p.active_ingredient ILIKE '%' || p_search || '%')
    AND (p_category = '' OR p.category_name = p_category)
    AND (p_manufacturer = '' OR p.manufacturer_name = p_manufacturer);
  SELECT json_agg(row_data) INTO v_data FROM (
    SELECT p.id, p.name, p.sku, p.description, p.category_name, p.active_ingredient, p.manufacturer_name, p.image_url, p.wholesale_unit, p.packing_spec, p.registration_number,
      LEAST(
        COALESCE((SELECT pu.price_sell FROM public.product_units pu WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' AND pu.price_sell > 0 LIMIT 1), (SELECT pu.price_sell FROM public.product_units pu WHERE pu.product_id = p.id AND pu.price_sell > 0 LIMIT 1), p.actual_cost),
        COALESCE((SELECT CASE WHEN d.discount_type = 'percent' THEN pu.price_sell * (1 - d.discount_value / 100.0) ELSE pu.price_sell - d.discount_value END FROM public.v_active_deals d JOIN public.product_units pu ON pu.product_id = d.product_id AND pu.unit_type = 'wholesale' WHERE d.product_id = p.id LIMIT 1), 999999999)
      ) AS price,
      COALESCE((SELECT pu.unit_name FROM public.product_units pu WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1), p.wholesale_unit) AS unit_name,
      (SELECT d.deal_name FROM public.v_active_deals d WHERE d.product_id = p.id LIMIT 1) AS deal_name,
      CASE WHEN COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id), 0) = 0 THEN 'out_of_stock' WHEN COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id), 0) <= 50 THEN 'low_stock' ELSE 'in_stock' END AS stock_status
    FROM public.products p WHERE p.status = 'active'
      AND (p_search = '' OR p.fts @@ plainto_tsquery('simple', p_search) OR p.name ILIKE '%' || p_search || '%' OR p.sku ILIKE '%' || p_search || '%' OR p.active_ingredient ILIKE '%' || p_search || '%')
      AND (p_category = '' OR p.category_name = p_category)
      AND (p_manufacturer = '' OR p.manufacturer_name = p_manufacturer)
    ORDER BY
      CASE WHEN p_sort = 'price-asc' THEN LEAST(COALESCE((SELECT pu.price_sell FROM public.product_units pu WHERE pu.product_id = p.id AND pu.price_sell > 0 LIMIT 1), 999999999), COALESCE((SELECT CASE WHEN d.discount_type = 'percent' THEN pu.price_sell * (1 - d.discount_value / 100.0) ELSE pu.price_sell - d.discount_value END FROM public.v_active_deals d JOIN public.product_units pu ON pu.product_id = d.product_id AND pu.unit_type = 'wholesale' WHERE d.product_id = p.id LIMIT 1), 999999999)) END ASC NULLS LAST,
      CASE WHEN p_sort = 'price-desc' THEN LEAST(COALESCE((SELECT pu.price_sell FROM public.product_units pu WHERE pu.product_id = p.id AND pu.price_sell > 0 LIMIT 1), 0), COALESCE((SELECT CASE WHEN d.discount_type = 'percent' THEN pu.price_sell * (1 - d.discount_value / 100.0) ELSE pu.price_sell - d.discount_value END FROM public.v_active_deals d JOIN public.product_units pu ON pu.product_id = d.product_id AND pu.unit_type = 'wholesale' WHERE d.product_id = p.id LIMIT 1), 999999999)) END DESC NULLS LAST,
      CASE WHEN p_sort = 'newest' THEN p.created_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'name-asc' THEN p.name END ASC NULLS LAST,
      CASE WHEN p_sort NOT IN ('price-asc','price-desc','newest','name-asc') THEN CASE WHEN COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id), 0) = 0 THEN 1 ELSE 0 END END ASC NULLS LAST,
      CASE WHEN p_sort NOT IN ('price-asc','price-desc','newest','name-asc') THEN CASE WHEN COALESCE((SELECT pu.price_sell FROM public.product_units pu WHERE pu.product_id = p.id AND pu.price_sell > 0 LIMIT 1), 0) > 0 THEN 0 ELSE 1 END END ASC NULLS LAST,
      p.name
    LIMIT p_page_size OFFSET v_offset
  ) row_data;
  RETURN json_build_object('data', COALESCE(v_data, '[]'::json), 'total', v_total, 'page', p_page, 'page_size', p_page_size);
END;
$$;
