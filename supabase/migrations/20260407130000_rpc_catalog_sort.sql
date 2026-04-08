-- ============================================================
-- Update get_wholesale_catalog: thêm p_sort parameter
-- Sort options: best-seller, price-asc, price-desc, newest, name-asc
-- Sort trên DB trước khi phân trang (server-side sort)
-- ============================================================

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
    AND (p_category = '' OR p.category_name = p_category);

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
      p.stock_status,
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
      ) AS unit_name
    FROM public.products p
    WHERE p.status = 'active'
      AND (p_search = '' OR p.fts @@ plainto_tsquery('simple', p_search)
           OR p.name ILIKE '%' || p_search || '%'
           OR p.sku ILIKE '%' || p_search || '%'
           OR p.active_ingredient ILIKE '%' || p_search || '%')
      AND (p_category = '' OR p.category_name = p_category)
    ORDER BY
      CASE WHEN p_sort = 'price-asc' THEN
        COALESCE(
          (SELECT pu.price_sell FROM public.product_units pu
           WHERE pu.product_id = p.id AND pu.price_sell > 0 LIMIT 1), 999999999)
      END ASC NULLS LAST,
      CASE WHEN p_sort = 'price-desc' THEN
        COALESCE(
          (SELECT pu.price_sell FROM public.product_units pu
           WHERE pu.product_id = p.id AND pu.price_sell > 0 LIMIT 1), 0)
      END DESC NULLS LAST,
      CASE WHEN p_sort = 'newest' THEN p.created_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'name-asc' THEN p.name END ASC NULLS LAST,
      -- Default (best-seller): stock first, then price, then name
      CASE WHEN p_sort NOT IN ('price-asc','price-desc','newest','name-asc') THEN
        CASE WHEN p.stock_status = 'out_of_stock' THEN 1 ELSE 0 END
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
