-- Fix is_base cho 3 SP có duy nhất 1 unit_name nhưng nhiều rows duplicate.
-- ============================================================================
-- Audit RPC `audit_is_base_ambiguous()` flag SP chưa có is_base=true VÀ có
-- ≥2 unit conversion_rate=1. Trong đó 3 SP chỉ có 1 unit_name duy nhất
-- (Gói/Hộp/Cọc), không có ambiguity về UOM thật → safe để auto fix:
--   - 682  Bột muối NBCA — unit_name="Gói"
--   - 3077 BCS Sato Condoms — unit_name="Hộp"
--   - 5605 Bông tẩy trang JoMi — unit_name="Cọc"
--
-- 32 SP còn lại có 2-3 unit_name (Hộp/Tub/Thùng…) → KHÔNG auto fix vì không
-- biết unit nào là base thật. Báo cáo CSV cho business team xác định.
--
-- Action: set is_base=true cho row có pu_id thấp nhất (oldest) per product.
-- Idempotent: dùng IS NOT TRUE check.
-- Date: 2026-04-25
-- ============================================================================

BEGIN;

WITH targets AS (
  SELECT product_id, MIN(id) AS pu_id
  FROM public.product_units
  WHERE product_id IN (682, 3077, 5605)
  GROUP BY product_id
)
UPDATE public.product_units pu
SET is_base = true, updated_at = NOW()
FROM targets t
WHERE pu.id = t.pu_id
  AND COALESCE(pu.is_base, false) IS NOT TRUE;

NOTIFY pgrst, 'reload schema';
COMMIT;
