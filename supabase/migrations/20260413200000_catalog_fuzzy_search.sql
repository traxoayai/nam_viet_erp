-- Migration: Fuzzy search cho B2B catalog
-- Cho phép tìm viết tắt: "eff 150" → match "Efferalgan 150mg"
-- Logic: tách search thành từng từ, mỗi từ phải match ít nhất 1 field (AND logic)

BEGIN;

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
  v_words TEXT[];
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  -- Tách search thành mảng từ (loại bỏ khoảng trắng thừa)
  IF p_search <> '' THEN
    v_words := array_remove(string_to_array(trim(p_search), ' '), '');
  ELSE
    v_words := '{}';
  END IF;

  -- Count
  SELECT COUNT(*) INTO v_total
  FROM public.products p
  WHERE p.status = 'active'
    -- Fuzzy multi-word search: mỗi từ phải match ít nhất 1 field
    AND (p_search = '' OR (
      SELECT bool_and(
        p.name ILIKE '%' || w || '%'
        OR p.sku ILIKE '%' || w || '%'
        OR COALESCE(p.active_ingredient, '') ILIKE '%' || w || '%'
        OR COALESCE(p.description, '') ILIKE '%' || w || '%'
      )
      FROM unnest(v_words) AS w
    ))
    AND (p_category = '' OR p.category_name = p_category)
    AND (p_manufacturer = '' OR p.manufacturer_name = p_manufacturer)
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
      ) AS price,
      COALESCE(
        (SELECT pu.unit_name FROM public.product_units pu
         WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1),
        p.wholesale_unit
      ) AS unit_name,
      (SELECT d.deal_name FROM public.v_active_deals d WHERE d.product_id = p.id LIMIT 1) AS deal_name,
      CASE
        WHEN COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id), 0) = 0 THEN 'out_of_stock'
        WHEN COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id), 0) <= 50 THEN 'low_stock'
        ELSE 'in_stock'
      END AS stock_status,
      COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id), 0)::INT AS total_quantity,
      (SELECT MIN(b.expiry_date)
       FROM public.batches b
       JOIN public.inventory_batches ib ON ib.batch_id = b.id
       WHERE ib.product_id = p.id AND ib.quantity > 0) AS nearest_expiry
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
      AND (p_category = '' OR p.category_name = p_category)
      AND (p_manufacturer = '' OR p.manufacturer_name = p_manufacturer)
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
      CASE WHEN p_sort = 'price-asc' THEN
        LEAST(
          COALESCE(
            (SELECT pu.price_sell FROM public.product_units pu
             WHERE pu.product_id = p.id AND pu.price_sell > 0 LIMIT 1), 999999999),
          COALESCE(
            (SELECT CASE WHEN d.discount_type = 'percent' THEN pu.price_sell * (1 - d.discount_value / 100.0) ELSE pu.price_sell - d.discount_value END
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
            (SELECT CASE WHEN d.discount_type = 'percent' THEN pu.price_sell * (1 - d.discount_value / 100.0) ELSE pu.price_sell - d.discount_value END
             FROM public.v_active_deals d
             JOIN public.product_units pu ON pu.product_id = d.product_id AND pu.unit_type = 'wholesale'
             WHERE d.product_id = p.id LIMIT 1), 999999999)
        )
      END DESC NULLS LAST,
      CASE WHEN p_sort = 'newest' THEN p.created_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'name-asc' THEN p.name END ASC NULLS LAST,
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

COMMIT;
