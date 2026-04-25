-- Fix is_base cho 31 SP còn lại trong audit_is_base_ambiguous
-- ============================================================================
-- Sau migration 270000 đã fix 3 SP đơn giản (1 unit_name), còn 31 SP có
-- 2-3 unit_name khác nhau (vd Hộp/Tub/Thùng).
--
-- LOGIC FIX:
--   Mỗi SP đã có sẵn row với unit_type='base' (column unit_type được design
--   để chỉ định base). Chỉ thiếu flag boolean redundant `is_base=true`.
--   → Set is_base=true cho row có unit_type='base' và pu_id thấp nhất per SP.
--
-- KHÔNG TOUCH conversion_rate vì không biết business value (Hộp = ? Tub).
-- Tất cả rate hiện =1 → multi-unit cùng SP sẽ resolve về cùng base unit
-- với rate=1. Logic 100% đúng (RPC _resolve_conversion_factor_strict không
-- ambiguous nữa); data có thể không khớp business reality (cần business team
-- update conversion_rate sau).
--
-- Idempotent: chỉ update row chưa is_base=true.
-- Date: 2026-04-25
-- ============================================================================

BEGIN;

WITH ambiguous_products AS (
  SELECT product_id FROM public.audit_is_base_ambiguous()
),
base_rows AS (
  SELECT DISTINCT ON (pu.product_id) pu.id, pu.product_id
  FROM public.product_units pu
  JOIN ambiguous_products amb ON amb.product_id = pu.product_id
  WHERE pu.unit_type = 'base'
  ORDER BY pu.product_id, pu.id
),
fallback_rows AS (
  -- Nếu SP không có unit_type='base' (edge case), pick lowest pu_id
  SELECT DISTINCT ON (pu.product_id) pu.id, pu.product_id
  FROM public.product_units pu
  JOIN ambiguous_products amb ON amb.product_id = pu.product_id
  WHERE pu.product_id NOT IN (SELECT product_id FROM base_rows)
  ORDER BY pu.product_id, pu.id
),
targets AS (
  SELECT id FROM base_rows
  UNION ALL
  SELECT id FROM fallback_rows
)
UPDATE public.product_units pu
SET is_base = true, updated_at = NOW()
FROM targets t
WHERE pu.id = t.id
  AND COALESCE(pu.is_base, false) IS NOT TRUE;

NOTIFY pgrst, 'reload schema';
COMMIT;
