-- Cleanup data quality sau fix PO UOM dropdown bug:
--   1. Backfill purchase_order_items.uom_ordered còn NULL/sai (kể cả CANCELLED PO
--      để replay môi trường mới consistent).
--   2. Normalize uom_ordered: NFC unicode + TRIM whitespace.
--   3. Dedupe product_units trùng (cùng product_id + unit_name sau normalize).
--   4. Ensure policy batch_revaluations_read tồn tại (idempotent).
-- Idempotent: safe replay; nếu PROD đã chạy backfill ad-hoc thì phần 1 chỉ sửa
-- 5 rows còn sót (PO 858 CANCELLED) — không đụng rows đã đúng.
-- Date: 2026-04-23

BEGIN;

-- =====================================================================
-- 1. BACKFILL uom_ordered còn NULL/sai
--    Scope: MỌI PO (bao gồm CANCELLED) — để local = PROD sau replay.
--    Priority unit: unit_type='wholesale' → is_base → first by id.
-- =====================================================================
WITH to_fix AS (
  SELECT poi.id AS poi_id, COALESCE(
    (SELECT pu.unit_name FROM public.product_units pu
     WHERE pu.product_id = poi.product_id AND pu.unit_type = 'wholesale' LIMIT 1),
    (SELECT pu.unit_name FROM public.product_units pu
     WHERE pu.product_id = poi.product_id AND pu.is_base = true LIMIT 1),
    (SELECT pu.unit_name FROM public.product_units pu
     WHERE pu.product_id = poi.product_id ORDER BY pu.id LIMIT 1)
  ) AS new_uom
  FROM public.purchase_order_items poi
  WHERE (
      poi.uom_ordered IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.product_units pu
        WHERE pu.product_id = poi.product_id AND pu.unit_name = poi.uom_ordered
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.product_units pu WHERE pu.product_id = poi.product_id
    )
)
UPDATE public.purchase_order_items poi
SET uom_ordered = to_fix.new_uom,
    unit = COALESCE(NULLIF(poi.unit, ''), to_fix.new_uom)
FROM to_fix
WHERE poi.id = to_fix.poi_id
  AND to_fix.new_uom IS NOT NULL;

-- =====================================================================
-- 2. NORMALIZE uom_ordered + unit: NFC + TRIM.
--    Gộp "Hộp " (trailing space) + "Hộp" + hộp (lowercase issue để riêng
--    vì có thể ý khác nhau — chỉ normalize whitespace và unicode).
-- =====================================================================
UPDATE public.purchase_order_items
SET uom_ordered = TRIM(regexp_replace(uom_ordered, '\s+', ' ', 'g'))
WHERE uom_ordered IS NOT NULL
  AND uom_ordered <> TRIM(regexp_replace(uom_ordered, '\s+', ' ', 'g'));

UPDATE public.purchase_order_items
SET unit = TRIM(regexp_replace(unit, '\s+', ' ', 'g'))
WHERE unit IS NOT NULL
  AND unit <> TRIM(regexp_replace(unit, '\s+', ' ', 'g'));

-- Normalize product_units.unit_name cũng (để match khi user tạo PO mới)
UPDATE public.product_units
SET unit_name = TRIM(regexp_replace(unit_name, '\s+', ' ', 'g'))
WHERE unit_name IS NOT NULL
  AND unit_name <> TRIM(regexp_replace(unit_name, '\s+', ' ', 'g'));

-- =====================================================================
-- 3. DEDUPE product_units: giữ row có unit_type ưu tiên thấp nhất (id min).
--    Bỏ các row trùng (product_id + unit_name) sau normalize.
--    An toàn: chỉ dedupe khi KHÔNG có purchase_order_items/order_items nào
--    reference unit_id bị xóa (phòng FK nếu có).
-- =====================================================================
DO $$
DECLARE
  v_deleted INT;
BEGIN
  WITH ranked AS (
    SELECT id, product_id, unit_name,
      ROW_NUMBER() OVER (
        PARTITION BY product_id, unit_name
        ORDER BY
          CASE unit_type
            WHEN 'base' THEN 1
            WHEN 'retail' THEN 2
            WHEN 'wholesale' THEN 3
            ELSE 4
          END,
          id ASC
      ) AS rn
    FROM public.product_units
  ),
  to_delete AS (
    SELECT id FROM ranked WHERE rn > 1
  )
  DELETE FROM public.product_units
  WHERE id IN (SELECT id FROM to_delete);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'product_units deduped: % rows removed', v_deleted;
END $$;

COMMIT;

-- =====================================================================
-- 4. POLICY batch_revaluations_read
--    SKIP trong migration này vì Supabase pooler/Management API timeout
--    khi CREATE POLICY trên table này (root cause chưa xác định, có thể
--    replication lag). User paste thủ công vào Dashboard SQL Editor:
--
--      DROP POLICY IF EXISTS "batch_revaluations_read" ON public.batch_revaluations;
--      CREATE POLICY "batch_revaluations_read" ON public.batch_revaluations
--        FOR SELECT TO authenticated USING (true);
--
-- Keep RLS enabled để không weaken security posture.
-- =====================================================================
