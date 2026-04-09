-- =============================================================================
-- MIGRATION: fix_stock_reporting_and_demo_data
-- GOAL: Fix total_quantity reporting, crashes, and restore missing demo products.
-- =============================================================================

-- 1. Update get_products_stock_status to ensure ALL requested IDs are returned
CREATE OR REPLACE FUNCTION public.get_products_stock_status(
  p_product_ids BIGINT[],
  p_warehouse_id BIGINT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(json_build_object(
    'product_id', pid,
    'total_quantity', COALESCE(s.total_qty, 0),
    'stock_status', CASE
      WHEN COALESCE(s.total_qty, 0) = 0 THEN 'out_of_stock'
      WHEN COALESCE(s.total_qty, 0) <= 50 THEN 'low_stock'
      ELSE 'in_stock'
    END
  )) INTO v_result
  FROM UNNEST(p_product_ids) pid
  LEFT JOIN (
    SELECT
      ib.product_id,
      SUM(ib.quantity) AS total_qty
    FROM public.inventory_batches ib
    WHERE ib.product_id = ANY(p_product_ids)
      AND (p_warehouse_id IS NULL OR ib.warehouse_id = p_warehouse_id)
    GROUP BY ib.product_id
  ) s ON s.product_id = pid;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- 2. Update get_wholesale_catalog to include total_quantity
CREATE OR REPLACE FUNCTION public.get_wholesale_catalog(
  p_search TEXT DEFAULT '',
  p_category TEXT DEFAULT '',
  p_manufacturer TEXT DEFAULT '',
  p_price_min NUMERIC DEFAULT 0,
  p_price_max NUMERIC DEFAULT 0,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 20,
  p_sort TEXT DEFAULT 'name-asc'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total BIGINT;
  v_data JSON;
  v_offset INTEGER;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  -- Count total
  SELECT COUNT(*) INTO v_total
  FROM public.products p
  WHERE p.status = 'active'
    AND (p_search = '' OR p.fts @@ plainto_tsquery('simple', p_search)
         OR p.name ILIKE '%' || p_search || '%'
         OR p.sku ILIKE '%' || p_search || '%'
         OR p.active_ingredient ILIKE '%' || p_search || '%')
    AND (p_category = '' OR EXISTS (
        SELECT 1 FROM unnest(string_to_array(p_category, ',')) cat 
        WHERE p.category_name ILIKE trim(cat)
    ))
    AND (p_manufacturer = '' OR EXISTS (
        SELECT 1 FROM unnest(string_to_array(p_manufacturer, ',')) m 
        WHERE p.manufacturer_name ILIKE trim(m)
    ));

  -- Get data
  SELECT json_agg(row_data) INTO v_data
  FROM (
    SELECT
      p.id, p.name, p.sku, p.description, p.category_name, p.active_ingredient,
      p.manufacturer_name, p.image_url, p.wholesale_unit, p.packing_spec, p.registration_number,
      LEAST(
        COALESCE(
          (SELECT pu.price_sell FROM public.product_units pu
           WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1),
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
      COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id), 0) AS total_quantity,
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
      AND (p_category = '' OR EXISTS (
          SELECT 1 FROM unnest(string_to_array(p_category, ',')) cat 
          WHERE p.category_name ILIKE trim(cat)
      ))
      AND (p_manufacturer = '' OR EXISTS (
          SELECT 1 FROM unnest(string_to_array(p_manufacturer, ',')) m 
          WHERE p.manufacturer_name ILIKE trim(m)
      ))
    ORDER BY 
      CASE WHEN p_sort = 'price-asc' THEN 1 END ASC,
      CASE WHEN p_sort = 'price-asc' THEN (
        SELECT pu.price_sell FROM public.product_units pu 
        WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1
      ) END ASC,
      CASE WHEN p_sort = 'name-asc' THEN p.name END ASC,
      p.name ASC
    LIMIT p_page_size OFFSET v_offset
  ) row_data;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$function$;

-- 3. Restore demo data mentioned in curl report
UPDATE public.products SET status = 'active' WHERE id = 8;
INSERT INTO public.products (id, name, status, sku, wholesale_unit, actual_cost)
SELECT 2, 'Sản phẩm demo 2', 'active', 'DEMO-002', 'Hộp', 100000
WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE id = 2);

INSERT INTO public.product_units (product_id, unit_name, conversion_rate, unit_type, price_sell, is_base)
SELECT 2, 'Hộp', 1, 'wholesale', 110500, true
WHERE NOT EXISTS (SELECT 1 FROM public.product_units WHERE product_id = 2 AND unit_name = 'Hộp');

-- Ensure ID 8 also has a wholesale unit for price verification
INSERT INTO public.product_units (product_id, unit_name, conversion_rate, unit_type, price_sell, is_base)
SELECT 8, 'Hộp', 1, 'wholesale', 101400, true
WHERE NOT EXISTS (SELECT 1 FROM public.product_units WHERE product_id = 8 AND unit_name = 'Hộp');
