-- Auto-backfill tất cả active products thiếu retail/wholesale UOM dựa theo
-- PATTERN của SP cùng category đã có đủ 3 loại (user insight: "dựa theo SP
-- có đơn vị tương tự hiện có đủ 3 loại để làm theo").
--
-- Strategy — "learn by example":
-- 1. Với mỗi (category_name, unit_type=retail|wholesale): pick MOST COMMON
--    (unit_name, conversion_rate) làm template cho category đó.
-- 2. Áp template cho mọi SP trong category đang thiếu loại đó.
-- 3. Nếu category chưa có template → fallback "Lẻ"/"Thùng" conv=1.
-- 4. 99 SP không có unit nào → tạo base "Cái" + retail "Lẻ" + wholesale
--    "Thùng" (placeholder, PM sẽ sửa).
--
-- Price placeholder: copy base.price_sell × conversion_rate (giá đúng theo
-- quy tắc quy đổi) hoặc 0 nếu không có base. PM chỉnh sau.
--
-- Idempotent: ON CONFLICT DO NOTHING + NOT EXISTS guard → chạy lại không hại.
-- Số liệu có thể sai (user chấp nhận "sửa sau") nhưng cấu trúc đủ.
-- Date: 2026-04-24
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 0: Tạo base "Cái" cho 99 SP không có unit nào
-- ============================================================================
INSERT INTO public.product_units (
  product_id, unit_name, unit_type, conversion_rate, is_base,
  price, price_sell, price_cost
)
SELECT p.id, 'Cái', 'base', 1, true,
  COALESCE(p.actual_cost, 0), COALESCE(p.actual_cost, 0), COALESCE(p.actual_cost, 0)
FROM public.products p
WHERE p.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_units pu WHERE pu.product_id = p.id
  )
ON CONFLICT (product_id, unit_name) DO NOTHING;

-- ============================================================================
-- STEP 1: Tạo "template" per category — most common (unit_name,
-- conversion_rate) for each of retail/wholesale
-- ============================================================================
CREATE TEMP TABLE _tpl_retail AS
SELECT DISTINCT ON (p.category_name)
  p.category_name,
  pu.unit_name,
  pu.conversion_rate
FROM public.product_units pu
JOIN public.products p ON p.id = pu.product_id
WHERE pu.unit_type = 'retail' AND p.status = 'active' AND p.category_name IS NOT NULL
GROUP BY p.category_name, pu.unit_name, pu.conversion_rate
ORDER BY p.category_name, COUNT(*) DESC, pu.unit_name;

CREATE TEMP TABLE _tpl_wholesale AS
SELECT DISTINCT ON (p.category_name)
  p.category_name,
  pu.unit_name,
  pu.conversion_rate
FROM public.product_units pu
JOIN public.products p ON p.id = pu.product_id
WHERE pu.unit_type = 'wholesale' AND p.status = 'active' AND p.category_name IS NOT NULL
GROUP BY p.category_name, pu.unit_name, pu.conversion_rate
ORDER BY p.category_name, COUNT(*) DESC, pu.unit_name;

-- ============================================================================
-- STEP 2: Backfill RETAIL — dùng template category, else fallback "Lẻ"
-- ============================================================================
INSERT INTO public.product_units (
  product_id, unit_name, unit_type, conversion_rate, is_base,
  price, price_sell, price_cost
)
SELECT
  p.id,
  -- Chọn unit_name không xung đột với unit hiện có của SP
  CASE
    WHEN tpl.unit_name IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.product_units x
        WHERE x.product_id = p.id AND btrim(x.unit_name) = btrim(tpl.unit_name)
      )
    THEN tpl.unit_name
    WHEN NOT EXISTS (
      SELECT 1 FROM public.product_units x
      WHERE x.product_id = p.id AND btrim(x.unit_name) = 'Lẻ'
    ) THEN 'Lẻ'
    ELSE 'Lẻ-' || p.id::text
  END AS unit_name,
  'retail',
  COALESCE(tpl.conversion_rate, 1),
  false,
  COALESCE(base.price_sell * COALESCE(tpl.conversion_rate, 1), 0),
  COALESCE(base.price_sell * COALESCE(tpl.conversion_rate, 1), 0),
  COALESCE(base.price_cost * COALESCE(tpl.conversion_rate, 1), 0)
FROM public.products p
LEFT JOIN _tpl_retail tpl ON tpl.category_name = p.category_name
LEFT JOIN public.product_units base
  ON base.product_id = p.id AND base.is_base = true
WHERE p.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_units pu
    WHERE pu.product_id = p.id AND pu.unit_type = 'retail'
  )
ON CONFLICT (product_id, unit_name) DO NOTHING;

-- ============================================================================
-- STEP 3: Backfill WHOLESALE — priority:
--   (1) products.wholesale_unit legacy + conversion_factor (nếu không conflict)
--   (2) category template
--   (3) "Thùng" fallback
-- ============================================================================
INSERT INTO public.product_units (
  product_id, unit_name, unit_type, conversion_rate, is_base,
  price, price_sell, price_cost
)
SELECT
  p.id,
  CASE
    WHEN p.wholesale_unit IS NOT NULL
      AND btrim(p.wholesale_unit) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.product_units x
        WHERE x.product_id = p.id
          AND btrim(x.unit_name) = btrim(p.wholesale_unit)
      )
    THEN btrim(p.wholesale_unit)
    WHEN tpl.unit_name IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.product_units x
        WHERE x.product_id = p.id AND btrim(x.unit_name) = btrim(tpl.unit_name)
      )
    THEN tpl.unit_name
    WHEN NOT EXISTS (
      SELECT 1 FROM public.product_units x
      WHERE x.product_id = p.id AND btrim(x.unit_name) = 'Thùng'
    ) THEN 'Thùng'
    ELSE 'Thùng-' || p.id::text
  END AS unit_name,
  'wholesale',
  CASE
    WHEN p.wholesale_unit IS NOT NULL
      AND btrim(p.wholesale_unit) <> ''
      AND COALESCE(p.conversion_factor, 0) > 1
      AND NOT EXISTS (
        SELECT 1 FROM public.product_units x
        WHERE x.product_id = p.id
          AND btrim(x.unit_name) = btrim(p.wholesale_unit)
      )
    THEN p.conversion_factor
    ELSE GREATEST(COALESCE(tpl.conversion_rate, 1), 1)
  END AS conversion_rate,
  false,
  COALESCE(base.price_sell * GREATEST(
    CASE WHEN COALESCE(p.conversion_factor, 0) > 1
      THEN p.conversion_factor
      ELSE COALESCE(tpl.conversion_rate, 1)
    END, 1), 0),
  COALESCE(base.price_sell * GREATEST(
    CASE WHEN COALESCE(p.conversion_factor, 0) > 1
      THEN p.conversion_factor
      ELSE COALESCE(tpl.conversion_rate, 1)
    END, 1), 0),
  COALESCE(base.price_cost * GREATEST(
    CASE WHEN COALESCE(p.conversion_factor, 0) > 1
      THEN p.conversion_factor
      ELSE COALESCE(tpl.conversion_rate, 1)
    END, 1), 0)
FROM public.products p
LEFT JOIN _tpl_wholesale tpl ON tpl.category_name = p.category_name
LEFT JOIN public.product_units base
  ON base.product_id = p.id AND base.is_base = true
WHERE p.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_units pu
    WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale'
  )
ON CONFLICT (product_id, unit_name) DO NOTHING;

DROP TABLE _tpl_retail;
DROP TABLE _tpl_wholesale;

NOTIFY pgrst, 'reload schema';

COMMIT;
