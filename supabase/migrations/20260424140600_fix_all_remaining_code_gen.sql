-- Fix all remaining random()*10000 code-gen (ORDER + INVENTORY + còn-sót FINANCE)
-- ============================================================================
-- 14 RPC còn lại dùng các pattern đa dạng:
--   Pattern A: 'XX-' || to_char(NOW(), 'YYMMDD') || '-' || floor(random()*10000)::text
--   Pattern B: 'XX-' || to_char(NOW(), 'YYMMDD') || '-' || LPAD(floor(random()*10000)::text, 4, '0')
--   Pattern C: v_prefix || to_char(NOW(), 'YYMMDD') || '-' || ...
--   Pattern D: 'XX-' || to_char(NOW(), 'YYMMDD') || '-B' || LPAD(...) (bulk_pay_orders)
--
-- Thay tất cả bằng public._gen_finance_tx_code(prefix) — helper đã kiểm nghiệm,
-- sequence-based, không collision. Tên "finance" cũ nhưng generic (prefix params).
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
    WHERE pronamespace = 'public'::regnamespace
      AND prosrc ~* 'floor\(\s*random\(\)\s*\*\s*10000\s*\)'
      AND proname != '_gen_finance_tx_code'
    ORDER BY proname
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_new := v_def;

    -- Pattern A: literal prefix, KHÔNG LPAD (lowercase)
    v_new := regexp_replace(
      v_new,
      '''([A-Z][A-Z0-9]*)-''\s*\|\|\s*to_char\(NOW\(\),\s*''YYMMDD''\)\s*\|\|\s*''-''\s*\|\|\s*floor\(random\(\)\s*\*\s*10000\)::text',
      'public._gen_finance_tx_code(''\1'')',
      'gi'
    );

    -- Pattern B: literal prefix, CÓ LPAD (lowercase)
    v_new := regexp_replace(
      v_new,
      '''([A-Z][A-Z0-9]*)-''\s*\|\|\s*to_char\(NOW\(\),\s*''YYMMDD''\)\s*\|\|\s*''-''\s*\|\|\s*LPAD\(floor\(random\(\)\s*\*\s*10000\)::text,\s*4,\s*''0''\)',
      'public._gen_finance_tx_code(''\1'')',
      'gi'
    );

    -- Pattern C: variable prefix, KHÔNG LPAD
    v_new := regexp_replace(
      v_new,
      '([a-z_][a-z0-9_]*)\s*\|\|\s*''-''\s*\|\|\s*to_char\(NOW\(\),\s*''YYMMDD''\)\s*\|\|\s*''-''\s*\|\|\s*floor\(random\(\)\s*\*\s*10000\)::text',
      'public._gen_finance_tx_code(\1)',
      'gi'
    );

    -- Pattern D: variable prefix đã có trailing dash (e.g. v_prefix := ''SO-'')
    v_new := regexp_replace(
      v_new,
      '([a-z_][a-z0-9_]*)\s*\|\|\s*to_char\(NOW\(\),\s*''YYMMDD''\)\s*\|\|\s*''-''\s*\|\|\s*LPAD\(floor\(random\(\)\s*\*\s*10000\)::text,\s*4,\s*''0''\)',
      'public._gen_finance_tx_code(rtrim(\1, ''-''))',
      'gi'
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

-- VERIFY:
-- SELECT proname FROM pg_proc
--   WHERE pronamespace='public'::regnamespace
--     AND prosrc ~* 'floor\(\s*random\(\)\s*\*\s*10000'
--     AND proname != '_gen_finance_tx_code';
