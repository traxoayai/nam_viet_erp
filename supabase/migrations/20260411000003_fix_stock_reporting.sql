-- =============================================================================
-- MIGRATION: fix_stock_reporting
-- GOAL: Fix total_quantity reporting in catalog and ensure all requested IDs 
--       get a stock status even if no batches exist.
-- =============================================================================

-- 1. Update get_products_stock_status to ensure ALL requested IDs are returned
--    and correctly identify out_of_stock for products with no batches.
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

-- 2. Update get_wholesale_catalog to include total_quantity field
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

  -- Get total count
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
    ))
    AND (p_price_min = 0 OR (
        SELECT pu.price_sell FROM public.product_units pu 
        WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1
    ) >= p_price_min)
    AND (p_price_max = 0 OR (
        SELECT pu.price_sell FROM public.product_units pu 
        WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1
    ) <= p_price_max);

  -- Get data
  SELECT json_agg(row_data) INTO v_data
  FROM (
    SELECT
      p.id, p.name, p.sku, p.description, p.category_name, p.active_ingredient,
      p.manufacturer_name, p.image_url, p.wholesale_unit, p.packing_spec, p.registration_number,
      -- Price calculation
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
      -- Deal info
      (SELECT d.deal_name FROM public.v_active_deals d WHERE d.product_id = p.id LIMIT 1) as deal_name,
      -- Stock fields
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
      AND (p_price_min = 0 OR (
          SELECT pu.price_sell FROM public.product_units pu 
          WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1
      ) >= p_price_min)
      AND (p_price_max = 0 OR (
          SELECT pu.price_sell FROM public.product_units pu 
          WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1
      ) <= p_price_max)
    ORDER BY 
      CASE WHEN p_sort = 'price-asc' THEN 1 END ASC,
      CASE WHEN p_sort = 'price-asc' THEN (
        SELECT pu.price_sell FROM public.product_units pu 
        WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1
      ) END ASC,
      CASE WHEN p_sort = 'price-desc' THEN 1 END ASC,
      CASE WHEN p_sort = 'price-desc' THEN (
        SELECT pu.price_sell FROM public.product_units pu 
        WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1
      ) END DESC,
      CASE WHEN p_sort = 'newest' THEN p.created_at END DESC,
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
