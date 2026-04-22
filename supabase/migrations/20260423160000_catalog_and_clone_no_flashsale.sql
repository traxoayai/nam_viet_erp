-- Fix 2 RPC khác cùng pattern bake Flash Sale discount vào price:
--   1. get_wholesale_catalog — field `price` trả LEAST(wholesale, deal) → FE
--      addItem(product.price) lưu giá đã giảm vào cart. Sửa: trả wholesale
--      gốc. Flash Sale hiển thị riêng qua /api/deals.
--   2. clone_sales_order — refresh price cũng LEAST(wholesale, deal). Sửa:
--      chỉ wholesale, không áp deal.
-- KHÔNG đụng price_min/price_max filter — filter vẫn dùng LEAST để search
-- theo khoảng giá (bao gồm deal) — đúng UX cho khách lọc theo giá effective.
-- Date: 2026-04-23

BEGIN;

-- =====================================================================
-- 1. get_wholesale_catalog: field `price` = wholesale gốc
-- =====================================================================
-- Giữ nguyên signature + logic khác, chỉ sửa SELECT price column trong
-- data subquery (line 122-137 bản 20260417150000). Copy full function để
-- không miss logic khác.

CREATE OR REPLACE FUNCTION public.get_wholesale_catalog(
  p_search text DEFAULT ''::text,
  p_category text DEFAULT ''::text,
  p_manufacturer text DEFAULT ''::text,
  p_price_min numeric DEFAULT 0,
  p_price_max numeric DEFAULT 0,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20,
  p_sort text DEFAULT 'best-seller'::text,
  p_categories text DEFAULT ''::text,
  p_manufacturers text DEFAULT ''::text,
  p_countries text DEFAULT ''::text,
  p_dosage_forms text DEFAULT ''::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_offset INT := (p_page - 1) * p_page_size;
  v_total_count INT;
  v_data JSON;
  v_b2b_wh_id BIGINT := public.get_b2b_warehouse_id();
  v_words text[] := public.split_words_vn(p_search);
BEGIN
  SELECT COUNT(*) INTO v_total_count
  FROM public.products p
  WHERE p.status = 'active'
    AND (p_search = '' OR (
      SELECT bool_and(
        p.name ILIKE '%' || w || '%'
        OR p.sku ILIKE '%' || w || '%'
        OR COALESCE(p.active_ingredient, '') ILIKE '%' || w || '%'
        OR COALESCE(p.description, '') ILIKE '%' || w || '%'
      )
      FROM unnest(v_words) AS w
    ))
    AND (
      CASE
        WHEN coalesce(p_categories, '') <> '' THEN p.category_name = ANY(public.split_csv_nonempty(p_categories))
        WHEN coalesce(p_category, '') <> '' THEN p.category_name = p_category
        ELSE TRUE
      END
    )
    AND (
      CASE
        WHEN coalesce(p_manufacturers, '') <> '' THEN p.manufacturer_name = ANY(public.split_csv_nonempty(p_manufacturers))
        WHEN coalesce(p_manufacturer, '') <> '' THEN p.manufacturer_name = p_manufacturer
        ELSE TRUE
      END
    )
    AND (
      p_countries = '' OR p.manufacturer_id IN (
        SELECT m.id FROM public.manufacturers m
        WHERE m.country = ANY(public.split_csv_nonempty(p_countries))
      )
    )
    AND (
      p_dosage_forms = '' OR (
        public.product_dosage_label(p.packing_spec) IS NOT NULL
        AND public.product_dosage_label(p.packing_spec) = ANY(public.split_csv_nonempty(p_dosage_forms))
      )
    )
    AND (p_price_min = 0 AND p_price_max = 0 OR (
      LEAST(
        COALESCE(
          (SELECT pu.price_sell FROM public.product_units pu
           WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' AND pu.price_sell > 0 LIMIT 1),
          (SELECT pu.price_sell FROM public.product_units pu
           WHERE pu.product_id = p.id AND pu.price_sell > 0 LIMIT 1),
          p.actual_cost
        ),
        COALESCE(
          (SELECT CASE WHEN d.discount_type = 'percent' THEN pu.price_sell * (1 - d.discount_value / 100.0) ELSE pu.price_sell - d.discount_value END
           FROM public.v_active_deals d
           JOIN public.product_units pu ON pu.product_id = d.product_id AND pu.unit_type = 'wholesale'
           WHERE d.product_id = p.id LIMIT 1),
          999999999
        )
      ) BETWEEN
        CASE WHEN p_price_min > 0 THEN p_price_min ELSE 0 END
        AND
        CASE WHEN p_price_max > 0 THEN p_price_max ELSE 999999999 END
    ));

  -- Data
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
      -- [FIX] price = wholesale gốc, KHÔNG LEAST với deal.
      -- Deal hiển thị riêng qua /api/deals (Flash Sale block).
      COALESCE(
        (SELECT pu.price_sell FROM public.product_units pu
         WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' AND pu.price_sell > 0 LIMIT 1),
        (SELECT pu.price_sell FROM public.product_units pu
         WHERE pu.product_id = p.id AND pu.price_sell > 0 LIMIT 1),
        p.actual_cost
      ) AS price,
      COALESCE(
        (SELECT pu.unit_name FROM public.product_units pu
         WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1),
        p.wholesale_unit
      ) AS unit_name,
      (SELECT d.deal_name FROM public.v_active_deals d WHERE d.product_id = p.id LIMIT 1) AS deal_name,
      COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id AND ib.warehouse_id = v_b2b_wh_id), 0)::INT AS total_quantity,
      CASE
        WHEN COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id AND ib.warehouse_id = v_b2b_wh_id), 0) = 0 THEN 'out_of_stock'
        WHEN COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id AND ib.warehouse_id = v_b2b_wh_id), 0) <= 50 THEN 'low_stock'
        ELSE 'in_stock'
      END AS stock_status,
      (SELECT MIN(b.expiry_date)
       FROM public.batches b
       JOIN public.inventory_batches ib ON ib.batch_id = b.id
       WHERE ib.product_id = p.id AND ib.quantity > 0 AND ib.warehouse_id = v_b2b_wh_id) AS nearest_expiry
    FROM public.products p
    WHERE p.status = 'active'
      AND (p_search = '' OR (
        SELECT bool_and(
          p.name ILIKE '%' || w || '%'
          OR p.sku ILIKE '%' || w || '%'
          OR COALESCE(p.active_ingredient, '') ILIKE '%' || w || '%'
          OR COALESCE(p.description, '') ILIKE '%' || w || '%'
        )
        FROM unnest(v_words) AS w
      ))
      AND (
        CASE
          WHEN coalesce(p_categories, '') <> '' THEN p.category_name = ANY(public.split_csv_nonempty(p_categories))
          WHEN coalesce(p_category, '') <> '' THEN p.category_name = p_category
          ELSE TRUE
        END
      )
      AND (
        CASE
          WHEN coalesce(p_manufacturers, '') <> '' THEN p.manufacturer_name = ANY(public.split_csv_nonempty(p_manufacturers))
          WHEN coalesce(p_manufacturer, '') <> '' THEN p.manufacturer_name = p_manufacturer
          ELSE TRUE
        END
      )
      AND (
        p_countries = '' OR p.manufacturer_id IN (
          SELECT m.id FROM public.manufacturers m
          WHERE m.country = ANY(public.split_csv_nonempty(p_countries))
        )
      )
      AND (
        p_dosage_forms = '' OR (
          public.product_dosage_label(p.packing_spec) IS NOT NULL
          AND public.product_dosage_label(p.packing_spec) = ANY(public.split_csv_nonempty(p_dosage_forms))
        )
      )
      AND (p_price_min = 0 AND p_price_max = 0 OR (
        LEAST(
          COALESCE(
            (SELECT pu.price_sell FROM public.product_units pu
             WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' AND pu.price_sell > 0 LIMIT 1),
            (SELECT pu.price_sell FROM public.product_units pu
             WHERE pu.product_id = p.id AND pu.price_sell > 0 LIMIT 1),
            p.actual_cost
          ),
          COALESCE(
            (SELECT CASE WHEN d.discount_type = 'percent' THEN pu.price_sell * (1 - d.discount_value / 100.0) ELSE pu.price_sell - d.discount_value END
             FROM public.v_active_deals d
             JOIN public.product_units pu ON pu.product_id = d.product_id AND pu.unit_type = 'wholesale'
             WHERE d.product_id = p.id LIMIT 1),
            999999999
          )
        ) BETWEEN
          CASE WHEN p_price_min > 0 THEN p_price_min ELSE 0 END
          AND
          CASE WHEN p_price_max > 0 THEN p_price_max ELSE 999999999 END
      ))
    ORDER BY
      CASE WHEN p_sort = 'best-seller' THEN
        COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id AND ib.warehouse_id = v_b2b_wh_id), 0)
      END DESC NULLS LAST,
      CASE WHEN p_sort = 'name-asc' THEN p.name END ASC,
      CASE WHEN p_sort = 'name-desc' THEN p.name END DESC,
      CASE WHEN p_sort = 'price-asc' THEN
        COALESCE(
          (SELECT pu.price_sell FROM public.product_units pu
           WHERE pu.product_id = p.id AND pu.price_sell > 0 LIMIT 1), 999999999)
      END ASC,
      CASE WHEN p_sort = 'price-desc' THEN
        COALESCE(
          (SELECT pu.price_sell FROM public.product_units pu
           WHERE pu.product_id = p.id AND pu.price_sell > 0 LIMIT 1), 0)
      END DESC,
      CASE WHEN p_sort = 'newest' THEN p.created_at END DESC,
      CASE WHEN p_sort = 'stock-asc' THEN
        COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id AND ib.warehouse_id = v_b2b_wh_id), 0)
      END ASC,
      CASE WHEN p_sort = 'stock-desc' THEN
        COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id AND ib.warehouse_id = v_b2b_wh_id), 0)
      END DESC,
      CASE WHEN p_sort = 'expiry-asc' THEN
        (SELECT MIN(b.expiry_date) FROM public.batches b
         JOIN public.inventory_batches ib ON ib.batch_id = b.id
         WHERE ib.product_id = p.id AND ib.quantity > 0 AND ib.warehouse_id = v_b2b_wh_id)
      END ASC NULLS LAST,
      CASE WHEN p_sort = 'expiry-desc' THEN
        (SELECT MIN(b.expiry_date) FROM public.batches b
         JOIN public.inventory_batches ib ON ib.batch_id = b.id
         WHERE ib.product_id = p.id AND ib.quantity > 0 AND ib.warehouse_id = v_b2b_wh_id)
      END DESC NULLS LAST,
      p.id
    OFFSET v_offset LIMIT p_page_size
  ) row_data;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'total', v_total_count,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_wholesale_catalog(text, text, text, numeric, numeric, integer, integer, text, text, text, text, text) TO anon, authenticated, service_role;


-- =====================================================================
-- 2. clone_sales_order: refresh price = wholesale gốc (không áp deal)
-- =====================================================================
-- Chỉ sửa phần SELECT LEAST(...) INTO v_current_price trong LOOP items.
-- DROP trước vì PROD có thể có return type khác migration này.

DROP FUNCTION IF EXISTS public.clone_sales_order(uuid);

CREATE OR REPLACE FUNCTION public.clone_sales_order(p_old_order_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_old_order RECORD;
    v_new_order_id UUID;
    v_new_code TEXT;
    v_item RECORD;
    v_current_price NUMERIC;
    v_total_amount NUMERIC := 0;
    v_final_amount NUMERIC;
BEGIN
    SELECT * INTO v_old_order FROM public.orders WHERE id = p_old_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', p_old_order_id;
    END IF;

    v_new_code := 'ORD-' || to_char(NOW(), 'YYMMDD') || '-' || substr(md5(random()::text), 1, 6);

    INSERT INTO public.orders (
        code, order_type, customer_id, customer_b2c_id, warehouse_id,
        delivery_address, delivery_time, delivery_method, shipping_partner_id,
        shipping_fee, total_amount, final_amount, discount_amount,
        status, payment_status, payment_method, approval_status, total_paid,
        note, user_id, created_at, updated_at
    ) VALUES (
        v_new_code, v_old_order.order_type, v_old_order.customer_id, v_old_order.customer_b2c_id, v_old_order.warehouse_id,
        v_old_order.delivery_address, v_old_order.delivery_time, v_old_order.delivery_method, v_old_order.shipping_partner_id,
        v_old_order.shipping_fee, 0, 0, 0,
        'DRAFT', 'unpaid', v_old_order.payment_method,
        CASE WHEN v_old_order.payment_method = 'cash' THEN 'pending' ELSE 'skipped' END,
        0,
        COALESCE(v_old_order.note, '') || E'\n(Nhân bản từ đơn: ' || v_old_order.code || ')',
        auth.uid(), NOW(), NOW()
    ) RETURNING id INTO v_new_order_id;

    -- 4. Copy items WITH REFRESHED WHOLESALE PRICE (KHÔNG áp Flash Sale deal)
    FOR v_item IN
        SELECT product_id, uom, conversion_factor, quantity, unit_price,
               discount, is_gift, note
        FROM public.order_items
        WHERE order_id = p_old_order_id
    LOOP
        -- [FIX] Refresh price = wholesale gốc. Khách tự chọn voucher ở checkout.
        SELECT COALESCE(
            (SELECT pu.price_sell FROM public.product_units pu
             WHERE pu.product_id = v_item.product_id AND pu.unit_type = 'wholesale' AND pu.price_sell > 0 LIMIT 1),
            (SELECT pu.price_sell FROM public.product_units pu
             WHERE pu.product_id = v_item.product_id AND pu.price_sell > 0 LIMIT 1),
            v_item.unit_price
        ) INTO v_current_price;

        INSERT INTO public.order_items (
            order_id, product_id, uom, conversion_factor, quantity, unit_price,
            discount, is_gift, note, quantity_picked, quantity_returned
        ) VALUES (
            v_new_order_id, v_item.product_id, v_item.uom, v_item.conversion_factor, v_item.quantity,
            v_current_price,
            v_item.discount, v_item.is_gift, v_item.note, 0, 0
        );

        v_total_amount := v_total_amount + (v_item.quantity * v_current_price);
    END LOOP;

    v_final_amount := v_total_amount + COALESCE(v_old_order.shipping_fee, 0);

    UPDATE public.orders
    SET total_amount = v_total_amount,
        final_amount = v_final_amount
    WHERE id = v_new_order_id;

    RETURN v_new_order_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.clone_sales_order(uuid) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
