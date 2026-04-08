-- Add manufacturer and price range filters to get_wholesale_catalog
CREATE OR REPLACE FUNCTION public.get_wholesale_catalog(
  p_search text DEFAULT '',
  p_category text DEFAULT '',
  p_manufacturer text DEFAULT '',
  p_price_min numeric DEFAULT 0,
  p_price_max numeric DEFAULT 0,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_offset INT;
  v_total BIGINT;
  v_data JSON;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  WITH product_prices AS (
    SELECT
      p.id, p.name, p.sku, p.description, p.category_name,
      p.active_ingredient, p.manufacturer_name, p.image_url,
      p.wholesale_unit, p.packing_spec, p.registration_number,
      p.fts,
      COALESCE(
        (SELECT pu.price_sell FROM public.product_units pu WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' AND pu.price_sell > 0 LIMIT 1),
        (SELECT pu.price_sell FROM public.product_units pu WHERE pu.product_id = p.id AND pu.price_sell > 0 LIMIT 1),
        p.actual_cost
      ) AS price,
      COALESCE(
        (SELECT pu.unit_name FROM public.product_units pu WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1),
        p.wholesale_unit
      ) AS unit_name,
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
  )
  SELECT COUNT(*) INTO v_total
  FROM product_prices pp
  WHERE (p_price_min = 0 OR pp.price >= p_price_min)
    AND (p_price_max = 0 OR pp.price <= p_price_max);

  WITH product_prices AS (
    SELECT
      p.id, p.name, p.sku, p.description, p.category_name,
      p.active_ingredient, p.manufacturer_name, p.image_url,
      p.wholesale_unit, p.packing_spec, p.registration_number,
      p.fts,
      COALESCE(
        (SELECT pu.price_sell FROM public.product_units pu WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' AND pu.price_sell > 0 LIMIT 1),
        (SELECT pu.price_sell FROM public.product_units pu WHERE pu.product_id = p.id AND pu.price_sell > 0 LIMIT 1),
        p.actual_cost
      ) AS price,
      COALESCE(
        (SELECT pu.unit_name FROM public.product_units pu WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1),
        p.wholesale_unit
      ) AS unit_name,
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
  )
  SELECT json_agg(row_data) INTO v_data
  FROM (
    SELECT pp.id, pp.name, pp.sku, pp.description, pp.category_name,
           pp.active_ingredient, pp.manufacturer_name, pp.image_url,
           pp.wholesale_unit, pp.packing_spec, pp.registration_number,
           pp.price, pp.unit_name, pp.stock_status
    FROM product_prices pp
    WHERE (p_price_min = 0 OR pp.price >= p_price_min)
      AND (p_price_max = 0 OR pp.price <= p_price_max)
    ORDER BY
      CASE WHEN pp.stock_status != 'out_of_stock' THEN 0 ELSE 1 END,
      CASE WHEN pp.price IS NOT NULL AND pp.price > 0 THEN 0 ELSE 1 END,
      pp.name
    LIMIT p_page_size OFFSET v_offset
  ) AS row_data;

  RETURN json_build_object('data', COALESCE(v_data, '[]'::json), 'total', v_total, 'page', p_page, 'page_size', p_page_size);
END;
$$;
