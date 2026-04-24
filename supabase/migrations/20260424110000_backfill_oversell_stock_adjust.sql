-- =====================================================
-- Backfill stock + adjust 17 oversell orders còn lại
-- Created: 2026-04-24
-- Lý do: Migration 050000 đã adjust 8/25 order oversell, còn 17 orders
--        fail vì kho không đủ bù. User yêu cầu "tự nhập thêm vào kho"
--        để close loop.
-- Phạm vi:
--   - SP 669 Crestor (warehouse 1): nhập 27 Viên
--   - SP 771 Alpha Chymotrypsin (warehouse 1): nhập 3992 Viên
--   - SP 826 Pirimas (warehouse 1): nhập 28 Ống
--   - SP 1249 Dexamethason (warehouse 1): nhập 855 Ống
--   - Tổng 4 batch master + 4 inventory_batches + 4 IN_ADJUST log
-- Sau đó: loop qua _stock_adjust_oversell_failures (17 rows) gọi
--         _deduct_stock_fefo, xoá row thành công.
-- =====================================================

BEGIN;

-- STEP 1: Tạo 4 batch master cho 4 SP (đặt expiry xa để FEFO đẩy sau cùng)
-- Dùng batch_code unique để idempotent (WHERE NOT EXISTS).
INSERT INTO public.batches (product_id, batch_code, expiry_date, manufacturing_date, inbound_price, created_at)
SELECT x.product_id, x.batch_code, DATE '2030-12-31', CURRENT_DATE, x.inbound_price, NOW()
FROM (VALUES
  (669::bigint,  'ADJ-OVERSELL-20260424-669',  10187.12),
  (771::bigint,  'ADJ-OVERSELL-20260424-771',  310.00),
  (826::bigint,  'ADJ-OVERSELL-20260424-826',  108282.00),
  (1249::bigint, 'ADJ-OVERSELL-20260424-1249', 1000.00)
) AS x(product_id, batch_code, inbound_price)
WHERE NOT EXISTS (
  SELECT 1 FROM public.batches b
  WHERE b.product_id = x.product_id AND b.batch_code = x.batch_code
);

-- STEP 2: Nhập kho cho warehouse 1 — quantity = tổng deficit từ failures table
-- Idempotent: nếu row đã tồn tại (chạy lại), cộng dồn không hợp lý → dùng
-- ON CONFLICT DO NOTHING để skip. Vì STEP 1 idempotent nên STEP 2 cũng vậy.
INSERT INTO public.inventory_batches (warehouse_id, product_id, batch_id, quantity, updated_at)
SELECT 1::bigint, b.product_id, b.id,
       COALESCE((
         SELECT SUM(f.missing_base_qty)::int
         FROM public._stock_adjust_oversell_failures f
         WHERE f.product_id = b.product_id
       ), 0),
       NOW()
FROM public.batches b
WHERE b.batch_code IN (
  'ADJ-OVERSELL-20260424-669',
  'ADJ-OVERSELL-20260424-771',
  'ADJ-OVERSELL-20260424-826',
  'ADJ-OVERSELL-20260424-1249'
)
AND NOT EXISTS (
  SELECT 1 FROM public.inventory_batches ib
  WHERE ib.warehouse_id = 1 AND ib.product_id = b.product_id AND ib.batch_id = b.id
)
AND EXISTS (
  SELECT 1 FROM public._stock_adjust_oversell_failures f
  WHERE f.product_id = b.product_id
);

-- STEP 3: Log IN_ADJUST audit trail — mỗi batch 1 row
INSERT INTO public.inventory_transactions (
  warehouse_id, product_id, batch_id, type, action_group, quantity,
  ref_id, description, created_at
)
SELECT 1::bigint, b.product_id, b.id, 'in_adjust', 'ADJUST',
       COALESCE((
         SELECT SUM(f.missing_base_qty)::int
         FROM public._stock_adjust_oversell_failures f
         WHERE f.product_id = b.product_id
       ), 0),
       'ADJ-OVERSELL-BACKFILL-20260424',
       'Nhập bù kho cho ' || COUNT(*) OVER () || ' SP bị oversell (UOM mismatch migration 030000+050000 còn sót)',
       NOW()
FROM public.batches b
WHERE b.batch_code LIKE 'ADJ-OVERSELL-20260424-%'
AND NOT EXISTS (
  SELECT 1 FROM public.inventory_transactions it
  WHERE it.ref_id = 'ADJ-OVERSELL-BACKFILL-20260424'
    AND it.product_id = b.product_id
    AND it.type = 'in_adjust'
);

-- STEP 4: Loop qua 17 failure rows, re-run FEFO deduct
-- Sử dụng _deduct_stock_fefo đã kiểm chứng (migration 050000).
-- Idempotent: check ref_id 'ADJ-OVERSELL-FIX2-<failure_id>' trong
-- inventory_transactions trước khi deduct.
DO $$
DECLARE
  r RECORD;
  v_ref_code TEXT;
  v_unit_price NUMERIC;
  v_exists BOOLEAN;
  v_ok_count INT := 0;
  v_err_count INT := 0;
BEGIN
  FOR r IN
    SELECT f.id AS failure_id, f.order_code, f.product_id, f.missing_base_qty,
           oi.unit_price, o.warehouse_id, o.customer_id
    FROM public._stock_adjust_oversell_failures f
    JOIN public.orders o ON o.code = f.order_code
    JOIN public.order_items oi ON oi.order_id = o.id
                              AND oi.product_id = f.product_id
                              AND btrim(oi.uom) = btrim(f.uom)
    ORDER BY f.id
  LOOP
    v_ref_code := 'ADJ-OVERSELL-FIX2-' || r.failure_id;

    SELECT EXISTS (
      SELECT 1 FROM public.inventory_transactions
      WHERE ref_id = v_ref_code
    ) INTO v_exists;

    IF v_exists THEN
      RAISE NOTICE 'SKIP (already adjusted): %', v_ref_code;
      CONTINUE;
    END IF;

    BEGIN
      PERFORM public._deduct_stock_fefo(
        r.warehouse_id,
        r.product_id,
        r.missing_base_qty,
        COALESCE(r.unit_price, 0),
        v_ref_code,
        COALESCE(r.customer_id::text, '')
      );
      v_ok_count := v_ok_count + 1;
      RAISE NOTICE 'ADJUSTED: % (product=%, -% base)', v_ref_code, r.product_id, r.missing_base_qty;

      -- Xoá row failure đã xử lý thành công
      DELETE FROM public._stock_adjust_oversell_failures
      WHERE id = r.failure_id;
    EXCEPTION WHEN OTHERS THEN
      v_err_count := v_err_count + 1;
      RAISE NOTICE 'FAIL AGAIN: % (err=%)', v_ref_code, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '=== BACKFILL RESULT: % succeeded, % failed ===', v_ok_count, v_err_count;
END $$;

COMMIT;

-- VERIFY:
-- SELECT COUNT(*) FROM _stock_adjust_oversell_failures;  -- expect 0
-- SELECT SUM(quantity) FROM inventory_batches
--   WHERE warehouse_id=1 AND product_id IN (669,771,826,1249);  -- expect 16 (5+0+5+6)
-- SELECT type, SUM(quantity) FROM inventory_transactions
--   WHERE ref_id LIKE 'ADJ-OVERSELL-FIX2-%' OR ref_id = 'ADJ-OVERSELL-BACKFILL-20260424'
--   GROUP BY type;
