-- Clean up 16 SP test có duy nhất 1 unit "Đơn vị lẻ" (is_base=true, retail).
-- Rename unit_name → "Cái" + unit_type='base', sau đó tạo retail + wholesale
-- cùng tên "Cái" (conv=1) → đảm bảo đủ 3 loại như các SP khác.
--
-- Thêm: đảm bảo 1 SP chỉ có tối đa 1 row is_base=true (SP 8 đang có 2 row
-- is_base=true = anomaly).
-- Date: 2026-04-24
-- ============================================================================

BEGIN;

-- Tạm disable trigger check conv
ALTER TABLE public.product_units DISABLE TRIGGER trg_enforce_same_conv_rate_per_uom;

-- 1. Fix is_base=true duplicates: giữ duy nhất 1 is_base per SP (ưu tiên
--    unit_type='base', rồi conversion_rate=1, rồi id nhỏ nhất)
WITH ranked_base AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY product_id
      ORDER BY
        CASE WHEN unit_type = 'base' THEN 0 ELSE 1 END,
        CASE WHEN conversion_rate = 1 THEN 0 ELSE 1 END,
        id
    ) AS rn
  FROM public.product_units
  WHERE is_base = true
)
UPDATE public.product_units
SET is_base = false
WHERE id IN (SELECT id FROM ranked_base WHERE rn > 1);

-- 2. Rename "Đơn vị lẻ" → "Cái" + set unit_type='base' (16 SP test)
UPDATE public.product_units
SET unit_name = 'Cái', unit_type = 'base', is_base = true
WHERE unit_name = 'Đơn vị lẻ';

-- 3. Xóa bất kỳ row nào khác nếu conflict với "Cái" sau rename
-- (không có vì 16 SP mỗi SP chỉ 1 row, nhưng safe)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY product_id, unit_name, unit_type
      ORDER BY CASE WHEN is_base = true THEN 0 ELSE 1 END, id
    ) AS rn
  FROM public.product_units
)
DELETE FROM public.product_units WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 4. Tạo retail + wholesale "Cái" cho các SP chỉ có base "Cái"
INSERT INTO public.product_units (
  product_id, unit_name, unit_type, conversion_rate, is_base,
  price, price_sell, price_cost
)
SELECT p.id, 'Cái', 'retail', 1, false,
  COALESCE(b.price_sell, 0), COALESCE(b.price_sell, 0), COALESCE(b.price_cost, 0)
FROM public.products p
JOIN public.product_units b
  ON b.product_id = p.id AND b.is_base = true AND b.unit_name = 'Cái'
WHERE p.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_units pu
    WHERE pu.product_id = p.id AND pu.unit_type = 'retail'
  )
ON CONFLICT (product_id, unit_name, unit_type) DO NOTHING;

INSERT INTO public.product_units (
  product_id, unit_name, unit_type, conversion_rate, is_base,
  price, price_sell, price_cost
)
SELECT p.id, 'Cái', 'wholesale', 1, false,
  COALESCE(b.price_sell, 0), COALESCE(b.price_sell, 0), COALESCE(b.price_cost, 0)
FROM public.products p
JOIN public.product_units b
  ON b.product_id = p.id AND b.is_base = true AND b.unit_name = 'Cái'
WHERE p.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_units pu
    WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale'
  )
ON CONFLICT (product_id, unit_name, unit_type) DO NOTHING;

ALTER TABLE public.product_units ENABLE TRIGGER trg_enforce_same_conv_rate_per_uom;

NOTIFY pgrst, 'reload schema';

COMMIT;
