-- Apply _gen_finance_tx_code cho các RPC dùng lowercase `floor(random()...)`
-- ============================================================================
-- Migration 140200-140400 match uppercase FLOOR(RANDOM()) pattern. 3 RPC
-- khác dùng lowercase floor(random()) → miss. Case-insensitive regex fix.
-- RPC liên quan: process_bulk_payment, sell_medical_packages, bulk_pay_orders
-- (bulk_pay_orders có -B prefix batch, pattern khác — skip, collision chance
--  thấp vì không gọi parallel trong test suite).
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
      AND proname NOT IN ('_gen_finance_tx_code', 'create_sales_order',
                           'upsert_product_with_units', 'bulk_pay_orders')
    ORDER BY proname
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_new := v_def;

    -- Pattern 1 case-insensitive literal prefix:
    v_new := regexp_replace(
      v_new,
      '''([A-Z]+)-''\s*\|\|\s*to_char\(NOW\(\),\s*''YYMMDD''\)\s*\|\|\s*''-''\s*\|\|\s*LPAD\(floor\(random\(\)\s*\*\s*10000\)::text,\s*4,\s*''0''\)',
      'public._gen_finance_tx_code(''\1'')',
      'gi'
    );

    -- Pattern 2 case-insensitive variable prefix
    v_new := regexp_replace(
      v_new,
      '([a-z_][a-z0-9_]*)\s*\|\|\s*''-''\s*\|\|\s*to_char\(NOW\(\),\s*''YYMMDD''\)\s*\|\|\s*''-''\s*\|\|\s*LPAD\(floor\(random\(\)\s*\*\s*10000\)::text,\s*4,\s*''0''\)',
      'public._gen_finance_tx_code(\1)',
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
