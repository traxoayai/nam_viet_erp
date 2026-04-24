-- Backfill product_units (unit_type=wholesale) cho 14 SP có sẵn
-- products.wholesale_unit + conversion_factor > 1 trong legacy, nhưng chưa
-- có wholesale row trong product_units.
--
-- Chỉ backfill case AN TOÀN:
-- - wholesale_unit non-empty
-- - legacy conversion_factor > 1 (có thông tin quy đổi thật)
-- - tên wholesale_unit KHÔNG trùng với unit_name đã tồn tại cho SP đó
--
-- Các case còn lại (3,406 factor=1, 1,325 tên trùng, 3,909 retail) cần PM
-- nhập tay qua UI hoặc export/import batch — không migration auto được.
--
-- Price: copy từ product_units.price_sell của base unit × legacy_conv nếu
-- product có base; else dùng products.price_wholesale nếu có; else 0.
-- Date: 2026-04-24
-- ============================================================================

BEGIN;

INSERT INTO public.product_units (
  product_id, unit_name, conversion_rate, is_base, unit_type,
  price, price_sell, price_cost
)
SELECT
  p.id,
  p.wholesale_unit,
  p.conversion_factor,
  false,
  'wholesale',
  COALESCE(
    (SELECT pu_base.price_sell * p.conversion_factor
     FROM public.product_units pu_base
     WHERE pu_base.product_id = p.id AND pu_base.is_base = true
     LIMIT 1),
    p.price_wholesale,
    0
  ) AS price,
  COALESCE(
    (SELECT pu_base.price_sell * p.conversion_factor
     FROM public.product_units pu_base
     WHERE pu_base.product_id = p.id AND pu_base.is_base = true
     LIMIT 1),
    p.price_wholesale,
    0
  ) AS price_sell,
  COALESCE(
    (SELECT pu_base.price_cost * p.conversion_factor
     FROM public.product_units pu_base
     WHERE pu_base.product_id = p.id AND pu_base.is_base = true
     LIMIT 1),
    0
  ) AS price_cost
FROM public.products p
WHERE p.status = 'active'
  AND p.wholesale_unit IS NOT NULL AND btrim(p.wholesale_unit) <> ''
  AND COALESCE(p.conversion_factor, 0) > 1
  AND NOT EXISTS (
    SELECT 1 FROM public.product_units pu
    WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale'
  )
  AND NOT EXISTS (
    -- tránh xung đột UNIQUE (product_id, unit_name)
    SELECT 1 FROM public.product_units pu
    WHERE pu.product_id = p.id
      AND btrim(pu.unit_name) = btrim(p.wholesale_unit)
  )
ON CONFLICT (product_id, unit_name) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;
