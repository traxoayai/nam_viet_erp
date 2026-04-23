-- Hotfix: Define public.split_words_vn(text)
-- =====================================================================
-- BUG: Migration 20260423160000_catalog_and_clone_no_flashsale.sql gọi
--      `public.split_words_vn(p_search)` trong get_wholesale_catalog
--      nhưng function này chưa bao giờ được define → prod trả 500
--      `42883 function public.split_words_vn(text) does not exist`.
-- FIX: Định nghĩa lại theo đúng logic inline của migration 20260414200001
--      (fuzzy multi-word: "eff 150" → ["eff","150"], strip empty + trim).
-- IMMUTABLE + STRICT: Không phụ thuộc state DB, không cần auth context.
-- Date: 2026-04-23
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.split_words_vn(p_text text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(
    array_remove(string_to_array(trim(COALESCE(p_text, '')), ' '), ''),
    ARRAY[]::text[]
  );
$$;

GRANT EXECUTE ON FUNCTION public.split_words_vn(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
