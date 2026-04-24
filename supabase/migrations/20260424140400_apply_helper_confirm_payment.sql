-- Apply _gen_finance_tx_code cho 2 RPC confirm_*_payment còn lại
-- ============================================================================
-- Pattern của 2 RPC này KHÔNG dùng LPAD, chỉ:
--   'PT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || FLOOR(RANDOM() * 10000)::TEXT
-- Regex 140200/140300 yêu cầu LPAD nên miss. Thêm regex v3 xử lý case này.
--
-- create_sales_order cũng có pattern tương tự nhưng dùng cho ORDER code
-- (prefix SO-/POS-), không phải finance_tx → KHÔNG migrate ở đây.
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
    WHERE proname IN ('confirm_order_payment', 'confirm_purchase_payment')
      AND pronamespace = 'public'::regnamespace
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_new := v_def;

    -- Pattern không LPAD: 'XX-' || TO_CHAR(NOW(),'YYMMDD') || '-' || FLOOR(RANDOM()*10000)::TEXT
    v_new := regexp_replace(
      v_new,
      '''([A-Z]+)-''\s*\|\|\s*TO_CHAR\(NOW\(\),\s*''YYMMDD''\)\s*\|\|\s*''-''\s*\|\|\s*FLOOR\(RANDOM\(\)\s*\*\s*10000\)::TEXT',
      'public._gen_finance_tx_code(''\1'')',
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
