-- Bulk apply _gen_finance_tx_code helper cho tất cả RPC còn RANDOM 4-digit
-- ============================================================================
-- 7 RPC chạy cùng pattern inline code-gen collision-prone:
-- _insert_order_payment_tx, confirm_order_payment, confirm_purchase_payment,
-- create_finance_transaction, create_sales_order, record_b2b_debt_payment,
-- submit_cash_remittance (prefix: PT/PC/OS hoặc biến v_prefix).
--
-- Dùng DO block + pg_get_functiondef + regex_replace + EXECUTE để thay
-- nguyên pattern mà không copy-paste body dài dòng.
--
-- Pattern 1: literal prefix 'XX-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0')
-- Pattern 2: variable prefix v_prefix || '-' || TO_CHAR...
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

    -- Pattern 1: literal string prefix
    v_new := regexp_replace(
      v_new,
      '''([A-Z]+)-'' \|\| TO_CHAR\(NOW\(\), ''YYMMDD''\) \|\| ''-'' \|\| LPAD\(FLOOR\(RANDOM\(\) \* 10000\)::TEXT, 4, ''0''\)',
      'public._gen_finance_tx_code(''\1'')',
      'g'
    );

    -- Pattern 2: variable prefix (any identifier name)
    v_new := regexp_replace(
      v_new,
      '([a-z_][a-z0-9_]*) \|\| ''-'' \|\| TO_CHAR\(NOW\(\), ''YYMMDD''\) \|\| ''-'' \|\| LPAD\(FLOOR\(RANDOM\(\) \* 10000\)::TEXT, 4, ''0''\)',
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

-- VERIFY:
-- SELECT proname FROM pg_proc
--   WHERE prosrc LIKE '%FLOOR(RANDOM() * 10000)%' AND pronamespace='public'::regnamespace;
-- (expect: empty — tất cả RPC đã migrate)
