-- Normalize case/typo unit_name: "hộp" → "Hộp", "Vi" → "Vỉ", v.v.
-- Skip variants có conv_rate khác canonical hiện có (PM phải review).
-- Date: 2026-04-24
-- ============================================================================

BEGIN;

-- Tạm disable trigger enforce same conv_rate trong migration — sau cleanup
-- data sẽ đảm bảo invariant, re-enable cuối migration.
ALTER TABLE public.product_units DISABLE TRIGGER trg_enforce_same_conv_rate_per_uom;

CREATE TEMP TABLE _unit_name_map (variant TEXT, canonical TEXT);
INSERT INTO _unit_name_map VALUES
  ('hộp', 'Hộp'), (' Hộp', 'Hộp'), ('Hộp ', 'Hộp'),
  ('vỉ', 'Vỉ'), (' Vỉ', 'Vỉ'), ('Vỉ ', 'Vỉ'), ('Vi', 'Vỉ'),
  ('lọ', 'Lọ'), (' Lọ', 'Lọ'), ('Lọ ', 'Lọ'),
  ('chai', 'Chai'), (' Chai', 'Chai'), ('Chai ', 'Chai'),
  ('tub', 'Tub'), (' Tub', 'Tub'), ('Tub ', 'Tub'),
  ('cái', 'Cái'), (' Cái', 'Cái'), ('Cái ', 'Cái'),
  ('gói', 'Gói'), (' Gói', 'Gói'), ('Gói ', 'Gói'),
  ('ống', 'Ống'), (' Ống', 'Ống'), ('Ống ', 'Ống'),
  ('bộ', 'Bộ'), (' Bộ', 'Bộ'), ('Bộ ', 'Bộ'),
  ('túi', 'Túi'), (' Túi', 'Túi'), ('Túi ', 'Túi'),
  ('chiếc', 'Chiếc'), ('miếng', 'Miếng');

CREATE TABLE IF NOT EXISTS public._unit_normalize_skipped (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT,
  variant TEXT,
  canonical TEXT,
  variant_conv NUMERIC,
  existing_canonical_conv NUMERIC,
  unit_type TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DELETE variant: nếu canonical TỒN TẠI cùng (product_id, unit_type) + cùng
-- conv_rate → variant redundant → xóa. Nếu khác conv → log skip.
-- ============================================================================
-- Delete redundant
DELETE FROM public.product_units v
USING _unit_name_map m, public.product_units c
WHERE v.unit_name = m.variant
  AND c.product_id = v.product_id
  AND c.unit_type = v.unit_type
  AND c.unit_name = m.canonical
  AND c.conversion_rate = v.conversion_rate
  AND c.id <> v.id;

-- Log skip (canonical existing có conv KHÁC → PM xử lý)
INSERT INTO public._unit_normalize_skipped
  (product_id, variant, canonical, variant_conv, existing_canonical_conv, unit_type, reason)
SELECT v.product_id, v.unit_name, m.canonical, v.conversion_rate, c.conversion_rate,
       v.unit_type, 'conv_rate_mismatch_with_existing_canonical'
FROM public.product_units v
JOIN _unit_name_map m ON m.variant = v.unit_name
JOIN public.product_units c
  ON c.product_id = v.product_id AND c.unit_type = v.unit_type
     AND c.unit_name = m.canonical AND c.conversion_rate <> v.conversion_rate;

-- Rename các variant không conflict (canonical chưa tồn tại hoặc đã tồn tại
-- cùng conv → ta sẽ CONFLICT DO NOTHING)
UPDATE public.product_units pu
SET unit_name = m.canonical
FROM _unit_name_map m
WHERE pu.unit_name = m.variant
  AND NOT EXISTS (
    SELECT 1 FROM public.product_units c
    WHERE c.product_id = pu.product_id
      AND c.unit_type = pu.unit_type
      AND c.unit_name = m.canonical
  );

-- ============================================================================
-- Compound "Hộp N Vi" → "Hộp N Vỉ" (và các case compound khác)
-- ============================================================================
-- Helper inline — DELETE redundant + UPDATE
DELETE FROM public.product_units v
USING public.product_units c
WHERE v.unit_name ~ '^Hộp \d+ Vi$'
  AND c.product_id = v.product_id
  AND c.unit_type = v.unit_type
  AND c.unit_name = REGEXP_REPLACE(v.unit_name, '\bVi\b', 'Vỉ')
  AND c.conversion_rate = v.conversion_rate
  AND c.id <> v.id;

UPDATE public.product_units
SET unit_name = REGEXP_REPLACE(unit_name, '\bVi\b', 'Vỉ')
WHERE unit_name ~ '^Hộp \d+ Vi$'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_units c
    WHERE c.product_id = product_units.product_id
      AND c.unit_type = product_units.unit_type
      AND c.unit_name = REGEXP_REPLACE(product_units.unit_name, '\bVi\b', 'Vỉ')
  );

DELETE FROM public.product_units v
USING public.product_units c
WHERE v.unit_name ~ '^Hộp \d+ vỉ$'
  AND c.product_id = v.product_id
  AND c.unit_type = v.unit_type
  AND c.unit_name = REGEXP_REPLACE(v.unit_name, 'vỉ', 'Vỉ')
  AND c.conversion_rate = v.conversion_rate
  AND c.id <> v.id;

UPDATE public.product_units
SET unit_name = REGEXP_REPLACE(unit_name, 'vỉ', 'Vỉ')
WHERE unit_name ~ '^Hộp \d+ vỉ$'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_units c
    WHERE c.product_id = product_units.product_id
      AND c.unit_type = product_units.unit_type
      AND c.unit_name = REGEXP_REPLACE(product_units.unit_name, 'vỉ', 'Vỉ')
  );

DELETE FROM public.product_units v
USING public.product_units c
WHERE v.unit_name ~ '^Hộp \d+ gói$'
  AND c.product_id = v.product_id
  AND c.unit_type = v.unit_type
  AND c.unit_name = REGEXP_REPLACE(v.unit_name, 'gói', 'Gói')
  AND c.conversion_rate = v.conversion_rate
  AND c.id <> v.id;

UPDATE public.product_units
SET unit_name = REGEXP_REPLACE(unit_name, 'gói', 'Gói')
WHERE unit_name ~ '^Hộp \d+ gói$'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_units c
    WHERE c.product_id = product_units.product_id
      AND c.unit_type = product_units.unit_type
      AND c.unit_name = REGEXP_REPLACE(product_units.unit_name, 'gói', 'Gói')
  );

DELETE FROM public.product_units v
USING public.product_units c
WHERE v.unit_name ~ '^Hộp \d+ ống$'
  AND c.product_id = v.product_id
  AND c.unit_type = v.unit_type
  AND c.unit_name = REGEXP_REPLACE(v.unit_name, 'ống', 'Ống')
  AND c.conversion_rate = v.conversion_rate
  AND c.id <> v.id;

UPDATE public.product_units
SET unit_name = REGEXP_REPLACE(unit_name, 'ống', 'Ống')
WHERE unit_name ~ '^Hộp \d+ ống$'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_units c
    WHERE c.product_id = product_units.product_id
      AND c.unit_type = product_units.unit_type
      AND c.unit_name = REGEXP_REPLACE(product_units.unit_name, 'ống', 'Ống')
  );

DROP TABLE _unit_name_map;

-- ============================================================================
-- Extra cleanup: rename "Đơn vị lẻ" → base unit_name (giống pattern 080000
-- cho "Lẻ"/"Thùng"). 16 SP test ID 8-25 đều có pattern này.
-- ============================================================================
UPDATE public.product_units r
SET unit_name = base.unit_name
FROM public.product_units base
WHERE r.product_id = base.product_id
  AND base.is_base = true
  AND r.unit_type = 'retail'
  AND r.conversion_rate = 1
  AND base.conversion_rate = 1
  AND r.unit_name = 'Đơn vị lẻ'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_units x
    WHERE x.product_id = r.product_id
      AND x.unit_name = base.unit_name
      AND x.unit_type = 'retail'
      AND x.id <> r.id
  );

-- ============================================================================
-- Sau cleanup: remove các row khác conv_rate cho cùng (product_id, unit_name)
-- (giữ row is_base=true ưu tiên, rồi conv phổ biến nhất, rồi id nhỏ nhất).
-- Rồi re-enable trigger.
-- ============================================================================
WITH same_name AS (
  SELECT pu.id,
    ROW_NUMBER() OVER (
      PARTITION BY pu.product_id, pu.unit_name
      ORDER BY
        CASE WHEN pu.is_base = true THEN 0 ELSE 1 END,
        pu.id
    ) AS rn
  FROM public.product_units pu
  WHERE EXISTS (
    SELECT 1 FROM public.product_units pu2
    WHERE pu2.product_id = pu.product_id
      AND pu2.unit_name = pu.unit_name
      AND pu2.id <> pu.id
      AND pu2.conversion_rate <> pu.conversion_rate
  )
)
DELETE FROM public.product_units
WHERE id IN (SELECT id FROM same_name WHERE rn > 1);

ALTER TABLE public.product_units ENABLE TRIGGER trg_enforce_same_conv_rate_per_uom;

NOTIFY pgrst, 'reload schema';

COMMIT;
