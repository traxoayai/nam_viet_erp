-- Bulk apply _gen_finance_tx_code helper — v2 (whitespace-tolerant)
-- ============================================================================
-- Migration 140200 đã update 2/7 RPC. 5 còn lại có line break trong pattern
-- (ví dụ `'-' ||<newline>  LPAD(...)`). Regex v2 dùng `\s+` để tolerate bất
-- kỳ whitespace nào.
-- ============================================================================

BEGIN;

DO $do$
DECLARE
  r RECORD;
  v_def TEXT;
  v_new TEXT;
  v_changed BOOLEAN;
BEGIN
  FOR r IN
    SELECT oid, proname
    FROM pg_proc
    WHERE prosrc LIKE '%FLOOR(RANDOM() * 10000)%'
      AND pronamespace = 'public'::regnamespace
    ORDER BY proname
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_new := v_def;

    -- Pattern 1: literal string prefix + whitespace-tolerant
    v_new := regexp_replace(
      v_new,
      '''([A-Z]+)-''\s*\|\|\s*TO_CHAR\(NOW\(\),\s*''YYMMDD''\)\s*\|\|\s*''-''\s*\|\|\s*LPAD\(FLOOR\(RANDOM\(\)\s*\*\s*10000\)::TEXT,\s*4,\s*''0''\)',
      'public._gen_finance_tx_code(''\1'')',
      'g'
    );

    -- Pattern 2: variable prefix (identifier) + whitespace-tolerant
    v_new := regexp_replace(
      v_new,
      '([a-z_][a-z0-9_]*)\s*\|\|\s*''-''\s*\|\|\s*TO_CHAR\(NOW\(\),\s*''YYMMDD''\)\s*\|\|\s*''-''\s*\|\|\s*LPAD\(FLOOR\(RANDOM\(\)\s*\*\s*10000\)::TEXT,\s*4,\s*''0''\)',
      'public._gen_finance_tx_code(\1)',
      'g'
    );

    v_changed := v_new != v_def;

    IF v_changed THEN
      EXECUTE v_new;
      RAISE NOTICE '  UPDATED: %', r.proname;
    ELSE
      RAISE NOTICE '  SKIP (pattern not matched): %', r.proname;
    END IF;
  END LOOP;
END
$do$;

NOTIFY pgrst, 'reload schema';

COMMIT;
