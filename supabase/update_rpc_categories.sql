CREATE OR REPLACE FUNCTION public.get_wholesale_catalog(
  p_search text DEFAULT '',
  p_category text DEFAULT '',
  p_manufacturer text DEFAULT '',
  p_price_min numeric DEFAULT 0,
  p_price_max numeric DEFAULT 0,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20,
  p_sort text DEFAULT 'best-seller',
  p_categories text DEFAULT '',
  p_manufacturers text DEFAULT '',
  p_countries text DEFAULT '',
  p_dosage_forms text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_offset INT;
  v_total BIGINT;
  v_data JSON;
  v_cat_ids int[];
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  -- Resolve category IDs from slugs or names
  IF coalesce(p_categories, '') <> '' THEN
    SELECT array_agg(id) INTO v_cat_ids FROM public.categories 
    WHERE slug = ANY(public.split_csv_nonempty(p_categories)) OR name = ANY(public.split_csv_nonempty(p_categories));
  ELSIF coalesce(p_category, '') <> '' THEN
    SELECT array_agg(id) INTO v_cat_ids FROM public.categories 
    WHERE slug = p_category OR name = p_category;
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.products p
  WHERE p.status = 'active'
    AND (p_search = '' OR p.fts @@ plainto_tsquery('simple', p_search)
         OR p.name ILIKE '%' || p_search || '%'
         OR p.sku ILIKE '%' || p_search || '%')
    AND (
      v_cat_ids IS NULL OR p.category_id = ANY(v_cat_ids)
    )
    AND (
      p_manufacturer = '' OR p.manufacturer_name = p_manufacturer
      OR (p_manufacturers <> '' AND p.manufacturer_name = ANY(public.split_csv_nonempty(p_manufacturers)))
    )
    AND (p_price_min = 0 AND p_price_max = 0 OR (
      LEAST(
        COALESCE(
          (SELECT pu.price_sell FROM public.product_units pu WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' AND pu.price_sell > 0 LIMIT 1),
          (SELECT pu.price_sell FROM public.product_units pu WHERE pu.product_id = p.id AND pu.price_sell > 0 LIMIT 1),
          p.actual_cost
        ),
        999999999
      ) BETWEEN p_price_min AND CASE WHEN p_price_max > 0 THEN p_price_max ELSE 999999999 END
    ));

  SELECT json_agg(row_data) INTO v_data
  FROM (
    SELECT
      p.id, p.name, p.sku, p.description, 
      (SELECT name FROM public.categories WHERE id = p.category_id) as category_name,
      p.active_ingredient, p.manufacturer_name, p.image_url,
      p.wholesale_unit, p.packing_spec, p.registration_number,
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
      END AS stock_status,
      COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id), 0)::INT AS total_quantity,
      (SELECT MIN(b.expiry_date) FROM public.batches b JOIN public.inventory_batches ib ON ib.batch_id = b.id WHERE ib.product_id = p.id AND ib.quantity > 0) AS nearest_expiry
    FROM public.products p
    WHERE p.status = 'active'
      AND (p_search = '' OR p.fts @@ plainto_tsquery('simple', p_search) OR p.name ILIKE '%' || p_search || '%')
      AND (v_cat_ids IS NULL OR p.category_id = ANY(v_cat_ids))
    ORDER BY 
      CASE WHEN p_sort = 'price-asc' THEN 1 ELSE 0 END,
      p.name
    LIMIT p_page_size OFFSET v_offset
  ) row_data;

  RETURN json_build_object('data', COALESCE(v_data, '[]'::json), 'total', v_total, 'page', p_page, 'page_size', p_page_size);
END;
$$;
