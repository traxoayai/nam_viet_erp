-- =========================================================================
-- POST-DEPLOY VERIFICATION: 20260408 migrations
-- Run after applying all 3 migrations to production
-- Expected: ALL checks should return TRUE / expected values
-- =========================================================================

-- 1. Check all critical functions exist
SELECT '1. Functions exist' AS check_name;
SELECT proname, pronargs
FROM pg_proc
WHERE proname IN (
  'create_sales_order', 'clone_sales_order',
  'get_customer_exposure_summary', 'get_customer_product_prices',
  'get_wholesale_catalog', 'get_customer_debt_summary',
  'verify_promotion_code'
) AND pronamespace = 'public'::regnamespace
ORDER BY proname;

-- 2. Verify voucher param order is CORRECT (customer_id before total_amount)
SELECT '2. Voucher params correct' AS check_name;
SELECT
  prosrc LIKE '%verify_promotion_code(p_voucher_code, v_final_b2b_id, v_total_amount)%'
    AS voucher_params_fixed
FROM pg_proc
WHERE proname = 'create_sales_order'
  AND pronamespace = 'public'::regnamespace;

-- 3. Verify JSON path for voucher usage is CORRECT
SELECT '3. Voucher JSON path correct' AS check_name;
SELECT
  prosrc LIKE E'%v_voucher_check->\'promotion\'-->>\'id\'%'
    AS json_path_fixed
FROM pg_proc
WHERE proname = 'create_sales_order'
  AND pronamespace = 'public'::regnamespace;

-- 4. Verify FOR UPDATE pessimistic lock exists
SELECT '4. Pessimistic lock exists' AS check_name;
SELECT
  prosrc LIKE '%FOR UPDATE%' AS has_pessimistic_lock
FROM pg_proc
WHERE proname = 'create_sales_order'
  AND pronamespace = 'public'::regnamespace;

-- 5. Verify clone refreshes prices (not copying stale prices)
SELECT '5. Clone refreshes prices' AS check_name;
SELECT
  prosrc LIKE '%v_current_price%' AS clone_refreshes_prices
FROM pg_proc
WHERE proname = 'clone_sales_order'
  AND pronamespace = 'public'::regnamespace;

-- 6. Verify NO stale 4-param overload of get_wholesale_catalog
SELECT '6. No stale 4-param catalog' AS check_name;
SELECT
  COUNT(*) = 0 AS no_stale_overload
FROM pg_proc
WHERE proname = 'get_wholesale_catalog'
  AND pronargs = 4
  AND pronamespace = 'public'::regnamespace;

-- 7. Verify price filter exists in catalog
SELECT '7. Price filter in catalog' AS check_name;
SELECT
  prosrc LIKE '%p_price_min%' AND prosrc LIKE '%BETWEEN%'
    AS has_price_filter
FROM pg_proc
WHERE proname = 'get_wholesale_catalog'
  AND pronargs = 8
  AND pronamespace = 'public'::regnamespace;

-- 8. Verify promotions tables exist
SELECT '8. Promotion tables exist' AS check_name;
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('promotions', 'promotion_usages')
ORDER BY table_name;

-- 9. Smoke test: exposure summary returns data
SELECT '9. Smoke: exposure summary' AS check_name;
SELECT actual_current_debt, pending_orders_total, total_exposure, debt_limit, available_credit
FROM get_customer_exposure_summary(
  (SELECT id FROM customers_b2b WHERE status = 'active' LIMIT 1)
);

-- 10. Smoke test: wholesale catalog returns data
SELECT '10. Smoke: catalog query' AS check_name;
SELECT
  jsonb_array_length((get_wholesale_catalog('', '', '', 0, 0, 1, 5, 'best-seller')::jsonb)->'data')
    AS catalog_product_count;

-- 11. Smoke test: customer product prices
SELECT '11. Smoke: product prices' AS check_name;
SELECT
  json_array_length(
    get_customer_product_prices(
      (SELECT id FROM customers_b2b WHERE status = 'active' LIMIT 1),
      ARRAY[(SELECT id FROM products WHERE status = 'active' LIMIT 1)]
    )
  ) AS price_result_count;

-- 12. Smoke test: debt summary
SELECT '12. Smoke: debt summary' AS check_name;
SELECT
  (get_customer_debt_summary(
    (SELECT id FROM customers_b2b WHERE status = 'active' LIMIT 1)
  )::jsonb)->>'available_credit' IS NOT NULL
    AS debt_has_available_credit;
