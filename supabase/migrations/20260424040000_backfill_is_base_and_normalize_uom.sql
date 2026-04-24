-- Backfill is_base=true + normalize UOM whitespace/NFC + dedupe
--
-- Audit prod 2026-04-24:
-- - 2,688 products có product_units nhưng không unit nào is_base=true → chia
--   base→UOM trong hiển thị fallback convRate=1 → sai số tồn.
-- - 23 duplicate UOM sau khi btrim+NFC (vd "Hộp" vs "Hộp " vs Unicode khác).
--
-- Strategy A (backfill is_base):
--   - Với mỗi product không có base: pick unit có conversion_rate=1 và id
--     nhỏ nhất → SET is_base=true.
--   - Products có nhiều unit rate=1 hoặc 0 unit rate=1: log + skip (PM xử
--     lý manual).
--
-- Strategy B (normalize + dedupe):
--   - btrim unit_name + NFC normalize trên tất cả product_units.
--   - Gộp duplicate: keep unit có is_base=true ưu tiên, sau đó id nhỏ nhất.
--   - Re-point order_items.uom → normalized name nếu match với unit bị xóa.
--     (thực chất unit_name sau normalize sẽ bằng nhau → KHÔNG cần remap,
--     btrim trên trigger đã đảm bảo lookup đúng bất kể whitespace.)
--
-- Migration IDEMPOTENT: chạy lại không gây hại.
-- Date: 2026-04-24
-- ============================================================================

BEGIN;

-- ============================================================================
-- A. Backfill is_base = true cho products thiếu base unit
-- ============================================================================
-- Only products với CHÍNH XÁC 1 unit có conversion_rate=1 (tránh ambiguity).
WITH candidates AS (
  SELECT product_id, MIN(id) AS pick_id
  FROM public.product_units
  WHERE conversion_rate = 1
    AND product_id IN (
      SELECT product_id FROM public.product_units
      GROUP BY product_id
      HAVING COUNT(*) FILTER (WHERE is_base = true) = 0
    )
  GROUP BY product_id
  HAVING COUNT(*) = 1
)
UPDATE public.product_units pu
SET is_base = true
FROM candidates c
WHERE pu.id = c.pick_id;

-- ============================================================================
-- B1. Normalize product_units.unit_name: btrim + NFC.
-- ============================================================================
-- Postgres 15 có normalize(text, NFC) built-in.
--
-- KHÔNG normalize order_items.uom vì:
-- 1. order_items là snapshot lịch sử, không cần sửa.
-- 2. Trigger 030000 dùng btrim()+btrim() trong WHERE lookup nên vẫn match
--    được order_items.uom "Hộp " với product_units.unit_name "Hộp" sau
--    normalize — an toàn mà không cần UPDATE.
-- 3. Một số order_items legacy có UOM không thuộc product_units (vd prod
--    có "Chai" nhưng order ghi "Hộp") — nếu UPDATE → trigger RAISE fail.
UPDATE public.product_units
SET unit_name = normalize(btrim(unit_name), NFC)
WHERE unit_name <> normalize(btrim(unit_name), NFC);

-- ============================================================================
-- B2. Dedupe: gộp rows cùng (product_id, unit_name) — keep is_base ưu tiên.
-- ============================================================================
-- Delete duplicates giữ bản có is_base=true trước, sau đó id nhỏ nhất.
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY product_id, unit_name
      ORDER BY
        CASE WHEN is_base = true THEN 0 ELSE 1 END,
        id
    ) AS rn
  FROM public.product_units
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.product_units
WHERE id IN (SELECT id FROM to_delete);

-- ============================================================================
-- B3. Add UNIQUE constraint để tránh tái phát (nếu chưa có)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_units_product_id_unit_name_key'
  ) THEN
    ALTER TABLE public.product_units
      ADD CONSTRAINT product_units_product_id_unit_name_key
      UNIQUE (product_id, unit_name);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
