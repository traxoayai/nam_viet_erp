-- =========================================================================
-- MIGRATION: fix_voucher_params_and_catalog_deals
-- DATE: 2026-04-08
-- FIXES:
--   1. create_sales_order: verify_promotion_code params were SWAPPED
--      (p_customer_id received order total, p_order_value received customer id)
--   2. create_sales_order: voucher usage INSERT/UPDATE used wrong JSON path
--      (v_voucher_check->>'promotion_id' → v_voucher_check->'promotion'->>'id')
--   3. get_wholesale_catalog 8-param: missing deal pricing (flash sales)
--   4. Drop stale 4-param overload of get_wholesale_catalog
-- =========================================================================

-- 1. Fix create_sales_order: voucher param swap + JSON path
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
  v_voucher_discount NUMERIC := 0;
  v_voucher_check JSONB;
  v_available_credit NUMERIC;
BEGIN
  -- 0. PERMISSION GUARD
  PERFORM public.check_rpc_access('create_sales_order');

  -- A. VALIDATION
  IF p_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Bắt buộc phải chọn Kho xuất hàng (p_warehouse_id).';
  END IF;

  IF p_order_type IS NULL OR p_order_type = '' THEN
    IF p_customer_b2c_id IS NOT NULL THEN v_safe_order_type := 'POS'; ELSE v_safe_order_type := 'B2B'; END IF;
  ELSE
    v_safe_order_type := p_order_type;
  END IF;

  v_final_b2b_id := COALESCE(p_customer_b2b_id, p_customer_id);

  IF v_safe_order_type = 'POS' THEN v_prefix := 'POS-'; ELSE v_prefix := 'SO-'; END IF;
  v_code := v_prefix || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  -- B. CALCULATE TOTALS FIRST for Voucher & Credit check
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total_amount := v_total_amount + ((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC);
  END LOOP;

  -- C. STOCK CHECK
  IF p_status IN ('CONFIRMED', 'COMPLETED', 'PACKED', 'SHIPPING', 'DELIVERED', 'DONE') THEN
    PERFORM public._validate_stock_availability(p_warehouse_id, p_items);
  END IF;

  -- D. VOUCHER VALIDATION
  -- FIX: params were SWAPPED in previous migration. Correct order:
  --   verify_promotion_code(p_code, p_customer_id, p_order_value)
  IF p_voucher_code IS NOT NULL AND p_voucher_code <> '' THEN
      v_voucher_check := public.verify_promotion_code(p_voucher_code, v_final_b2b_id, v_total_amount);
      IF (v_voucher_check->>'valid')::BOOLEAN = false THEN
          RAISE EXCEPTION 'Voucher không hợp lệ: %', (v_voucher_check->>'message');
      END IF;
      v_voucher_discount := (v_voucher_check->>'discount_amount')::NUMERIC;
  END IF;

  v_final_amount := v_total_amount - COALESCE(p_discount_amount, 0) - v_voucher_discount + COALESCE(p_shipping_fee, 0);

  -- E. CREDIT EXPOSURE CHECK (B2B only)
  IF v_safe_order_type = 'B2B' AND p_payment_method <> 'cash' AND v_final_b2b_id IS NOT NULL THEN
      SELECT available_credit INTO v_available_credit
      FROM public.get_customer_exposure_summary(v_final_b2b_id);

      IF (COALESCE(v_available_credit, 0) - v_final_amount) < 0 THEN
          RAISE EXCEPTION 'Đơn hàng vượt quá hạn mức công nợ khả dụng. Khả dụng hiện tại: %đ. Tổng đơn: %đ',
            to_char(COALESCE(v_available_credit, 0), 'FM999G999G999G999'),
            to_char(v_final_amount, 'FM999G999G999G999');
      END IF;
  END IF;

  -- F. INSERT ORDER HEADER
  INSERT INTO public.orders (
    code, customer_id, customer_b2c_id, creator_id, status, order_type,
    payment_method, remittance_status, delivery_address, delivery_time, note,
    discount_amount, shipping_fee, shipping_partner_id, delivery_method, warehouse_id,
    total_amount, final_amount, paid_amount, payment_status, created_at, updated_at
  ) VALUES (
    v_code, v_final_b2b_id, p_customer_b2c_id, auth.uid(), p_status, v_safe_order_type,
    p_payment_method, CASE WHEN p_payment_method = 'cash' THEN 'pending' ELSE 'skipped' END,
    COALESCE(p_delivery_address, ''), p_delivery_time, p_note,
    COALESCE(p_discount_amount, 0) + v_voucher_discount, COALESCE(p_shipping_fee, 0), p_shipping_partner_id, p_delivery_method, p_warehouse_id,
    v_total_amount, v_final_amount, 0, 'unpaid', NOW(), NOW()
  ) RETURNING id INTO v_order_id;

  -- G. PROCESS ITEMS
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
  END LOOP;

  -- H. RECORD VOUCHER USAGE if success
  -- FIX: JSON path was wrong. verify_promotion_code returns { promotion: { id, ... } }
  --   Old (broken): v_voucher_check->>'promotion_id'
  --   New (correct): v_voucher_check->'promotion'->>'id'
  IF v_voucher_discount > 0 THEN
      INSERT INTO public.promotion_usages (promotion_id, customer_id, order_id, discount_amount)
      VALUES ((v_voucher_check->'promotion'->>'id')::UUID, v_final_b2b_id, v_order_id, v_voucher_discount);

      UPDATE public.promotions SET usage_count = usage_count + 1
      WHERE id = (v_voucher_check->'promotion'->>'id')::UUID;
  END IF;

  -- I. AUTO FINANCE TRANSACTION (cash payment only)
  IF p_payment_method = 'cash' AND v_final_amount > 0 THEN
    v_partner_id   := COALESCE(p_customer_b2c_id, v_final_b2b_id);
    v_partner_type := CASE WHEN p_customer_b2c_id IS NOT NULL THEN 'customer' ELSE 'customer_b2b' END;
    v_ft_code := 'FT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    INSERT INTO public.finance_transactions (
      code, amount, flow, business_type, description,
      ref_type, ref_id, partner_id, partner_type,
      created_by, status, created_at, fund_account_id
    ) VALUES (
      v_ft_code, v_final_amount, 'in', 'trade',
      'Thanh toán đơn hàng ' || v_code,
      'order', v_code, v_partner_id::text, v_partner_type,
      auth.uid(), 'completed', NOW(), 1
    );

    UPDATE public.orders SET paid_amount = v_final_amount, payment_status = 'paid' WHERE id = v_order_id;
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


-- 2. Drop stale 4-param overload that nobody uses
-- Portal calls the 8-param version (with p_manufacturer, p_price_min, p_price_max, p_sort).
-- The 4-param was accidentally re-created by the previous migration with deal pricing
-- that should have gone into the 8-param version.
DROP FUNCTION IF EXISTS public.get_wholesale_catalog(text, text, integer, integer);


-- 3. Replace 8-param get_wholesale_catalog with deal-aware pricing
CREATE OR REPLACE FUNCTION public.get_wholesale_catalog(
  p_search TEXT DEFAULT '',
  p_category TEXT DEFAULT '',
  p_manufacturer TEXT DEFAULT '',
  p_price_min NUMERIC DEFAULT 0,
  p_price_max NUMERIC DEFAULT 0,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 20,
  p_sort TEXT DEFAULT 'best-seller'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_offset INT;
  v_total BIGINT;
  v_data JSON;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  SELECT COUNT(*) INTO v_total
  FROM public.products p
  WHERE p.status = 'active'
    AND (p_search = '' OR p.fts @@ plainto_tsquery('simple', p_search)
         OR p.name ILIKE '%' || p_search || '%'
         OR p.sku ILIKE '%' || p_search || '%'
         OR p.active_ingredient ILIKE '%' || p_search || '%')
    AND (p_category = '' OR p.category_name = p_category)
    AND (p_manufacturer = '' OR p.manufacturer_name = p_manufacturer);

  SELECT json_agg(row_data) INTO v_data
  FROM (
    SELECT
      p.id,
      p.name,
      p.sku,
      p.description,
      p.category_name,
      p.active_ingredient,
      p.manufacturer_name,
      p.image_url,
      p.wholesale_unit,
      p.packing_spec,
      p.registration_number,
      -- Deal-aware price: LEAST of wholesale vs active deal
      LEAST(
        COALESCE(
          (SELECT pu.price_sell FROM public.product_units pu
           WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' AND pu.price_sell > 0 LIMIT 1),
          (SELECT pu.price_sell FROM public.product_units pu
           WHERE pu.product_id = p.id AND pu.price_sell > 0 LIMIT 1),
          p.actual_cost
        ),
        COALESCE(
          (SELECT
              CASE
                  WHEN d.discount_type = 'percent' THEN pu.price_sell * (1 - d.discount_value / 100.0)
                  ELSE pu.price_sell - d.discount_value
              END
           FROM public.v_active_deals d
           JOIN public.product_units pu ON pu.product_id = d.product_id AND pu.unit_type = 'wholesale'
           WHERE d.product_id = p.id
           LIMIT 1),
          999999999
        )
      ) AS price,
      COALESCE(
        (SELECT pu.unit_name FROM public.product_units pu
         WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1),
        p.wholesale_unit
      ) AS unit_name,
      -- Deal name for UI badge
      (SELECT d.deal_name FROM public.v_active_deals d WHERE d.product_id = p.id LIMIT 1) AS deal_name,
      -- Stock status
      CASE
        WHEN COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id), 0) = 0 THEN 'out_of_stock'
        WHEN COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id), 0) <= 50 THEN 'low_stock'
        ELSE 'in_stock'
      END AS stock_status
    FROM public.products p
    WHERE p.status = 'active'
      AND (p_search = '' OR p.fts @@ plainto_tsquery('simple', p_search)
           OR p.name ILIKE '%' || p_search || '%'
           OR p.sku ILIKE '%' || p_search || '%'
           OR p.active_ingredient ILIKE '%' || p_search || '%')
      AND (p_category = '' OR p.category_name = p_category)
      AND (p_manufacturer = '' OR p.manufacturer_name = p_manufacturer)
    ORDER BY
      CASE WHEN p_sort = 'price-asc' THEN
        LEAST(
          COALESCE(
            (SELECT pu.price_sell FROM public.product_units pu
             WHERE pu.product_id = p.id AND pu.price_sell > 0 LIMIT 1), 999999999),
          COALESCE(
            (SELECT
                CASE WHEN d.discount_type = 'percent' THEN pu.price_sell * (1 - d.discount_value / 100.0)
                     ELSE pu.price_sell - d.discount_value END
             FROM public.v_active_deals d
             JOIN public.product_units pu ON pu.product_id = d.product_id AND pu.unit_type = 'wholesale'
             WHERE d.product_id = p.id LIMIT 1), 999999999)
        )
      END ASC NULLS LAST,
      CASE WHEN p_sort = 'price-desc' THEN
        LEAST(
          COALESCE(
            (SELECT pu.price_sell FROM public.product_units pu
             WHERE pu.product_id = p.id AND pu.price_sell > 0 LIMIT 1), 0),
          COALESCE(
            (SELECT
                CASE WHEN d.discount_type = 'percent' THEN pu.price_sell * (1 - d.discount_value / 100.0)
                     ELSE pu.price_sell - d.discount_value END
             FROM public.v_active_deals d
             JOIN public.product_units pu ON pu.product_id = d.product_id AND pu.unit_type = 'wholesale'
             WHERE d.product_id = p.id LIMIT 1), 999999999)
        )
      END DESC NULLS LAST,
      CASE WHEN p_sort = 'newest' THEN p.created_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'name-asc' THEN p.name END ASC NULLS LAST,
      -- Default (best-seller): in-stock first, then has-price, then name
      CASE WHEN p_sort NOT IN ('price-asc','price-desc','newest','name-asc') THEN
        CASE
          WHEN COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id), 0) = 0 THEN 1
          ELSE 0
        END
      END ASC NULLS LAST,
      CASE WHEN p_sort NOT IN ('price-asc','price-desc','newest','name-asc') THEN
        CASE WHEN COALESCE(
          (SELECT pu.price_sell FROM public.product_units pu
           WHERE pu.product_id = p.id AND pu.price_sell > 0 LIMIT 1), 0
        ) > 0 THEN 0 ELSE 1 END
      END ASC NULLS LAST,
      p.name
    LIMIT p_page_size OFFSET v_offset
  ) row_data;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$$;
