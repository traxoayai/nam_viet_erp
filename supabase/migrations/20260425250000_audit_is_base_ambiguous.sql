-- Audit: sản phẩm có nhiều product_units cùng conversion_rate=1 nhưng chưa có is_base=true.
--
-- Context:
--   Migration 20260424040000 backfill is_base=true chỉ cho products có CHÍNH XÁC
--   1 unit conversion_rate=1. Products có ≥2 units cùng rate=1 bị skip vì ambiguous
--   — không rõ unit nào là base thực tế.
--
-- Function này READ-ONLY, dùng để liệt kê các sản phẩm đó để PM / business
--   quyết định thủ công unit nào được SET is_base=true.
--
-- Cách dùng:
--   SELECT * FROM public.audit_is_base_ambiguous() ORDER BY product_id;
--
-- KHÔNG auto-fix vì cần business decide.
-- Date: 2026-04-25
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_is_base_ambiguous()
RETURNS TABLE (
  product_id   bigint,
  unit_ids     bigint[],
  unit_names   text[],
  ambiguous_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Products chưa có is_base=true VÀ có nhiều unit conversion_rate=1
  SELECT
    pu.product_id,
    array_agg(pu.id ORDER BY pu.id)          AS unit_ids,
    array_agg(pu.unit_name ORDER BY pu.id)   AS unit_names,
    count(*)::integer                         AS ambiguous_count
  FROM public.product_units pu
  WHERE pu.conversion_rate = 1
    AND pu.product_id IN (
      -- products không có is_base=true
      SELECT product_id
      FROM public.product_units
      GROUP BY product_id
      HAVING COUNT(*) FILTER (WHERE is_base = true) = 0
    )
  GROUP BY pu.product_id
  HAVING COUNT(*) >= 2;
$$;

COMMENT ON FUNCTION public.audit_is_base_ambiguous() IS
  'List sản phẩm có ≥2 product_units cùng conversion_rate=1 nhưng chưa có is_base=true. Dùng để PM/business quyết định thủ công unit nào là base thực tế.';
