-- Fix regex parser bank memo cho format mã đơn 8-digit
-- ============================================================================
-- ROOT CAUSE: 20260424140000 đổi _gen_finance_tx_code → SO-YYMMDD-NNNNNNRR
--   (8 chữ số sau YYMMDD). Banking app strip dấu gạch → memo `SO26042500006840`.
--   Regex cũ '(SO|POS)[\s-]?(\d{6})[\s-]?(\d{4})' chỉ bắt 4 chữ số → fail match.
--
-- FIX: Đổi suffix thành (\d{8}|\d{4}) — alternation ưu tiên 8 digits cho format
--   mới, fallback 4 digits cho đơn cũ trước 2026-04-24. Format result giữ nguyên
--   độ dài match (PREFIX-YYMMDD-XXXX hoặc PREFIX-YYMMDD-XXXXXXXX).
-- Date: 2026-04-28
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.extract_order_codes_from_memo(p_memo text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public'
AS $$
DECLARE
  v_normalized text;
  v_result text[] := ARRAY[]::text[];
  v_match text[];
BEGIN
  IF p_memo IS NULL OR btrim(p_memo) = '' THEN
    RETURN ARRAY[]::text[];
  END IF;

  v_normalized := upper(p_memo);

  -- [FIX 2026-04-28] Suffix: 8 digits (format mới) hoặc 4 digits (legacy).
  -- Postgres regex alternation thử pattern đầu trước → ưu tiên 8 digits.
  FOR v_match IN
    SELECT regexp_matches(v_normalized, '(SO|POS)[\s-]?(\d{6})[\s-]?(\d{8}|\d{4})', 'g')
  LOOP
    v_result := v_result || (v_match[1] || '-' || v_match[2] || '-' || v_match[3]);
  END LOOP;

  -- Dedupe preserve order
  SELECT COALESCE(ARRAY_AGG(c ORDER BY min_idx), ARRAY[]::text[]) INTO v_result
  FROM (
    SELECT c, MIN(idx) AS min_idx
    FROM unnest(v_result) WITH ORDINALITY AS t(c, idx)
    GROUP BY c
  ) u;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.extract_order_codes_from_memo(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
