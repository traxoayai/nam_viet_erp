-- Backfill product_units cho SP active thiếu unit_type
-- Idempotent: chỉ INSERT nếu thiếu
-- Note: products dùng status text ('active'/'inactive'), không phải is_active boolean
BEGIN;

DO $do$
DECLARE
  r RECORD;
  v_count INT := 0;
BEGIN
  -- Nhóm A.1: backfill 'wholesale' từ products.wholesale_unit
  FOR r IN
    SELECT p.id, p.wholesale_unit
    FROM products p
    WHERE p.status = 'active'
      AND p.wholesale_unit IS NOT NULL
      AND btrim(p.wholesale_unit) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM product_units pu
        WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale'
      )
  LOOP
    INSERT INTO product_units (product_id, unit_name, unit_type, conversion_rate, is_base, price, price_sell, price_cost)
    VALUES (r.id, r.wholesale_unit, 'wholesale', 1, false, 0, 0, 0)
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Backfilled wholesale: % rows', v_count;

  -- Nhóm A.2: backfill 'retail' từ products.retail_unit
  v_count := 0;
  FOR r IN
    SELECT p.id, p.retail_unit
    FROM products p
    WHERE p.status = 'active'
      AND p.retail_unit IS NOT NULL
      AND btrim(p.retail_unit) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM product_units pu
        WHERE pu.product_id = p.id AND pu.unit_type = 'retail'
      )
  LOOP
    INSERT INTO product_units (product_id, unit_name, unit_type, conversion_rate, is_base, price, price_sell, price_cost)
    VALUES (r.id, r.retail_unit, 'retail', 1, false, 0, 0, 0)
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Backfilled retail: % rows', v_count;

  -- Nhóm B: backfill 'base' nếu thiếu hoàn toàn (dùng retail_unit làm base name, fallback 'Cái')
  v_count := 0;
  FOR r IN
    SELECT p.id, COALESCE(NULLIF(btrim(p.retail_unit), ''), 'Cái') AS base_name
    FROM products p
    WHERE p.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM product_units pu
        WHERE pu.product_id = p.id AND pu.is_base = true
      )
  LOOP
    INSERT INTO product_units (product_id, unit_name, unit_type, conversion_rate, is_base, price, price_sell, price_cost)
    VALUES (r.id, r.base_name, 'base', 1, true, 0, 0, 0)
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Backfilled base: % rows', v_count;
END
$do$;

NOTIFY pgrst, 'reload schema';
COMMIT;
