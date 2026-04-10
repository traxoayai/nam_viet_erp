-- =============================================================================
-- MIGRATION: fix_stock_and_demo_data (merged)
-- GOAL:
--   1. Fix get_products_stock_status — return ALL requested IDs (LEFT JOIN)
--   2. Ensure get_wholesale_catalog has total_quantity, stock_status,
--      nearest_expiry, deal_name, multi-filter support
--   3. Restore missing demo products
-- =============================================================================

BEGIN;

-- 1. Fix get_products_stock_status: LEFT JOIN ensures ALL requested IDs returned
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

-- 2. Ensure helper functions exist
CREATE OR REPLACE FUNCTION public.split_csv_nonempty(p text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    array_agg(trim(x)) FILTER (WHERE trim(x) <> ''),
    ARRAY[]::text[]
  )
  FROM unnest(string_to_array(coalesce(p, ''), ',')) AS t(x);
$$;

CREATE OR REPLACE FUNCTION public.product_dosage_label(spec text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  s text := lower(coalesce(spec, ''));
BEGIN
  IF position('viên nén' in s) > 0 THEN RETURN 'Viên nén'; END IF;
  IF position('viên nang cứng' in s) > 0 THEN RETURN 'Viên nang cứng'; END IF;
  IF position('viên nang mềm' in s) > 0 THEN RETURN 'Viên nang mềm'; END IF;
  IF position('viên nang' in s) > 0 THEN RETURN 'Viên nang'; END IF;
  IF position('viên ngậm' in s) > 0 THEN RETURN 'Viên ngậm'; END IF;
  IF position('viên sủi' in s) > 0 THEN RETURN 'Viên sủi'; END IF;
  IF position('dung dịch' in s) > 0 AND position('ống' in s) > 0 THEN RETURN 'Dung dịch'; END IF;
  IF position('chai' in s) > 0 OR position('lọ' in s) > 0 OR position('siro' in s) > 0 OR position('syrup' in s) > 0 THEN RETURN 'Dung dịch'; END IF;
  IF position('gói' in s) > 0 OR position('bột' in s) > 0 OR position('cốm' in s) > 0 THEN RETURN 'Dạng bột'; END IF;
  IF position('kem' in s) > 0 OR position('gel' in s) > 0 OR position('nhũ tương' in s) > 0 THEN RETURN 'Nhũ tương (Gel)'; END IF;
  IF position('xịt' in s) > 0 OR position('phun sương' in s) > 0 THEN RETURN 'Xịt/Phun sương'; END IF;
  IF position('miếng dán' in s) > 0 THEN RETURN 'Miếng dán'; END IF;
  RETURN NULL;
END;
$$;

-- 3. Drop old 7-param overload (missing p_sort, total_quantity, stock_status)
DROP FUNCTION IF EXISTS public.get_wholesale_catalog(text, text, text, numeric, numeric, integer, integer);

CREATE OR REPLACE FUNCTION public.get_wholesale_catalog(
  p_search TEXT DEFAULT '',
  p_category TEXT DEFAULT '',
  p_manufacturer TEXT DEFAULT '',
  p_price_min NUMERIC DEFAULT 0,
  p_price_max NUMERIC DEFAULT 0,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 20,
  p_sort TEXT DEFAULT 'best-seller',
  p_categories TEXT DEFAULT '',
  p_manufacturers TEXT DEFAULT '',
  p_countries TEXT DEFAULT '',
  p_dosage_forms TEXT DEFAULT ''
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
         OR p.active_ingredient ILIKE '%' || p_search || '%'
         OR p.description ILIKE '%' || p_search || '%')
    AND (
      CASE
        WHEN coalesce(p_categories, '') <> '' THEN p.category_name = ANY(public.split_csv_nonempty(p_categories))
        WHEN p_category <> '' THEN p.category_name = p_category
        ELSE TRUE
      END
    )
    AND (
      CASE
        WHEN coalesce(p_manufacturers, '') <> '' THEN p.manufacturer_name = ANY(public.split_csv_nonempty(p_manufacturers))
        WHEN p_manufacturer <> '' THEN p.manufacturer_name = p_manufacturer
        ELSE TRUE
      END
    )
    AND (
      p_countries = '' OR EXISTS (
        SELECT 1 FROM public.manufacturers mf
        WHERE mf.name = p.manufacturer_name
          AND mf.status = 'active'
          AND trim(mf.country) = ANY(public.split_csv_nonempty(p_countries))
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
      COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id), 0)::INT AS total_quantity,
      CASE
        WHEN COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id), 0) = 0 THEN 'out_of_stock'
        WHEN COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id), 0) <= 50 THEN 'low_stock'
        ELSE 'in_stock'
      END AS stock_status,
      (SELECT MIN(b.expiry_date)
       FROM public.batches b
       JOIN public.inventory_batches ib ON ib.batch_id = b.id
       WHERE ib.product_id = p.id AND ib.quantity > 0) AS nearest_expiry
    FROM public.products p
    WHERE p.status = 'active'
      AND (p_search = '' OR p.fts @@ plainto_tsquery('simple', p_search)
           OR p.name ILIKE '%' || p_search || '%'
           OR p.sku ILIKE '%' || p_search || '%'
           OR p.active_ingredient ILIKE '%' || p_search || '%'
           OR p.description ILIKE '%' || p_search || '%')
      AND (
        CASE
          WHEN coalesce(p_categories, '') <> '' THEN p.category_name = ANY(public.split_csv_nonempty(p_categories))
          WHEN p_category <> '' THEN p.category_name = p_category
          ELSE TRUE
        END
      )
      AND (
        CASE
          WHEN coalesce(p_manufacturers, '') <> '' THEN p.manufacturer_name = ANY(public.split_csv_nonempty(p_manufacturers))
          WHEN p_manufacturer <> '' THEN p.manufacturer_name = p_manufacturer
          ELSE TRUE
        END
      )
      AND (
        p_countries = '' OR EXISTS (
          SELECT 1 FROM public.manufacturers mf
          WHERE mf.name = p.manufacturer_name
            AND mf.status = 'active'
            AND trim(mf.country) = ANY(public.split_csv_nonempty(p_countries))
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

-- 4. Restore demo data
UPDATE public.products SET status = 'active' WHERE id = 8;

INSERT INTO public.products (id, name, status, sku, wholesale_unit, actual_cost)
SELECT 2, 'Sản phẩm demo 2', 'active', 'DEMO-002', 'Hộp', 100000
WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE id = 2);

INSERT INTO public.product_units (product_id, unit_name, conversion_rate, unit_type, price_sell, is_base)
SELECT 2, 'Hộp', 1, 'wholesale', 110500, true
WHERE NOT EXISTS (SELECT 1 FROM public.product_units WHERE product_id = 2 AND unit_name = 'Hộp');

INSERT INTO public.product_units (product_id, unit_name, conversion_rate, unit_type, price_sell, is_base)
SELECT 8, 'Hộp', 1, 'wholesale', 101400, true
WHERE NOT EXISTS (SELECT 1 FROM public.product_units WHERE product_id = 8 AND unit_name = 'Hộp');

COMMIT;
