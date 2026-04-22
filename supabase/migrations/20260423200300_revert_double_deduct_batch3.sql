-- Migration: REVERT data fix cho 6 đơn double-deduct (batch 3)
-- ============================================================================
-- BUG: Scan ngày 2026-04-22 (scripts/audit/double_deduct_scan_20260422.json)
--      phát hiện thêm 6 đơn bị trừ kho 2 lần (overshoot 9,858 đvcs) ngoài
--      15 đơn đã revert trong 20260417160000 + 20260418030000.
--
-- 5 đơn pattern A (type='out' AND action_group='sale' — txn dư từ
-- _deduct_stock_fefo còn sót khi confirm_outbound_packing đã ghi
-- 'sale_order'/'SALE'):
--   SO-260416-1329 (SHIPPING, 4212)
--   SO-260418-8881 (PACKED, 2353)
--   SO-260418-2856 (PACKED, 1689)
--   SO-260417-9853 (PACKED, 1236)
--   SO-260418-6239 (PACKED, 181)
--
-- 1 đơn pattern B (type='sale_order' AND action_group='SALE' AND
-- batch_id IS NULL — có 2 txn sale_order/SALE khác batch, txn batch_id NULL
-- là cái dư cần revert; KHÔNG đụng batches vì batch_id NULL):
--   SO-260330-5213 (DELIVERED, 187)
--
-- Tổng revert: 9,858 đvcs. Backup đầy đủ txn + batch để rollback 100%.
-- KHÔNG đụng: orders, order_items, finance_transactions, sales_invoices,
-- invoice_items, vat_inventory_ledger, customers_b2b.outstanding_debt.
-- Date: 2026-04-23
-- ============================================================================

BEGIN;

-- 1. Bảng backup (idempotent: chỉ tạo nếu chưa có)
CREATE TABLE IF NOT EXISTS public._revert_double_deduct_20260423 (
  id BIGSERIAL PRIMARY KEY,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL,  -- 'backup_txn' | 'backup_batch'
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS _revert_double_deduct_20260423_action_idx
  ON public._revert_double_deduct_20260423(action);

COMMENT ON TABLE public._revert_double_deduct_20260423 IS
  'Backup snapshot trước khi revert 6 đơn double-deduct batch 3 (2026-04-23). Giữ để rollback. An toàn xóa sau 30 ngày nếu không cần.';

-- 2. Guard idempotent + revert logic
DO $$
DECLARE
  v_already_run BOOLEAN;
  v_orders_pattern_a TEXT[] := ARRAY[
    'SO-260416-1329', 'SO-260418-8881', 'SO-260418-2856',
    'SO-260417-9853', 'SO-260418-6239'
  ];  -- pattern type='out' action_group='sale'
  v_order_pattern_b  TEXT    := 'SO-260330-5213';
  -- pattern type='sale_order' action_group='SALE' AND batch_id IS NULL
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public._revert_double_deduct_20260423 WHERE action = 'backup_txn'
  ) INTO v_already_run;

  IF v_already_run THEN
    RAISE NOTICE 'Migration đã chạy trước đó. Bỏ qua để tránh double-revert. Xoá bảng _revert_double_deduct_20260423 nếu muốn rerun.';
    RETURN;
  END IF;

  -- 3a. Backup txn pattern A (5 đơn out/sale)
  INSERT INTO public._revert_double_deduct_20260423 (action, payload)
  SELECT 'backup_txn', to_jsonb(it.*)
  FROM public.inventory_transactions it
  WHERE it.ref_id = ANY(v_orders_pattern_a)
    AND it.type = 'out'
    AND it.action_group = 'sale'
    AND it.quantity < 0
    AND COALESCE(it.description, '') NOT LIKE '[REVERTED%';

  -- 3b. Backup txn pattern B (1 đơn sale_order/SALE batch_id IS NULL)
  INSERT INTO public._revert_double_deduct_20260423 (action, payload)
  SELECT 'backup_txn', to_jsonb(it.*)
  FROM public.inventory_transactions it
  WHERE it.ref_id = v_order_pattern_b
    AND it.type = 'sale_order'
    AND it.action_group = 'SALE'
    AND it.batch_id IS NULL
    AND it.quantity < 0
    AND COALESCE(it.description, '') NOT LIKE '[REVERTED%';

  -- 4. Backup inventory_batches rows sẽ bị UPDATE (chỉ pattern A vì pattern B
  --    batch_id NULL nên không đụng inventory_batches)
  INSERT INTO public._revert_double_deduct_20260423 (action, payload)
  SELECT DISTINCT 'backup_batch', to_jsonb(ib.*)
  FROM public.inventory_batches ib
  WHERE (ib.warehouse_id, ib.product_id, ib.batch_id) IN (
    SELECT DISTINCT it.warehouse_id, it.product_id, it.batch_id
    FROM public.inventory_transactions it
    WHERE it.ref_id = ANY(v_orders_pattern_a)
      AND it.type = 'out'
      AND it.action_group = 'sale'
      AND it.quantity < 0
      AND it.batch_id IS NOT NULL
      AND COALESCE(it.description, '') NOT LIKE '[REVERTED%'
  );

  -- 5. Cộng ngược inventory_batches.quantity cho pattern A.
  --    Group theo (warehouse_id, product_id, batch_id) tránh double-apply.
  WITH to_revert AS (
    SELECT it.warehouse_id, it.product_id, it.batch_id,
           SUM(ABS(it.quantity))::INTEGER AS revert_qty
    FROM public.inventory_transactions it
    WHERE it.ref_id = ANY(v_orders_pattern_a)
      AND it.type = 'out'
      AND it.action_group = 'sale'
      AND it.quantity < 0
      AND it.batch_id IS NOT NULL
      AND COALESCE(it.description, '') NOT LIKE '[REVERTED%'
    GROUP BY it.warehouse_id, it.product_id, it.batch_id
  )
  UPDATE public.inventory_batches ib
  SET quantity = ib.quantity + tr.revert_qty,
      updated_at = NOW()
  FROM to_revert tr
  WHERE ib.warehouse_id = tr.warehouse_id
    AND ib.product_id = tr.product_id
    AND ib.batch_id = tr.batch_id;

  -- 6. Mark txn pattern A đã revert (giữ row audit)
  UPDATE public.inventory_transactions
  SET description = '[REVERTED-DOUBLE-DEDUCT 2026-04-23] ' || COALESCE(description, '')
  WHERE ref_id = ANY(v_orders_pattern_a)
    AND type = 'out'
    AND action_group = 'sale'
    AND COALESCE(description, '') NOT LIKE '[REVERTED%';

  -- 7. Mark txn pattern B đã revert (không restore batch vì batch_id IS NULL)
  UPDATE public.inventory_transactions
  SET description = '[REVERTED-DOUBLE-DEDUCT 2026-04-23 pattern-B] ' || COALESCE(description, '')
  WHERE ref_id = v_order_pattern_b
    AND type = 'sale_order'
    AND action_group = 'SALE'
    AND batch_id IS NULL
    AND COALESCE(description, '') NOT LIKE '[REVERTED%';

  RAISE NOTICE 'Revert double-deduct batch 3 hoàn tất cho 6 đơn. Backup trong _revert_double_deduct_20260423.';
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK instructions (chạy thủ công nếu cần):
-- ============================================================================
-- BEGIN;
--
-- -- Restore inventory_batches.quantity
-- UPDATE public.inventory_batches ib
-- SET quantity = (bkp.payload->>'quantity')::INTEGER,
--     updated_at = NOW()
-- FROM public._revert_double_deduct_20260423 bkp
-- WHERE bkp.action = 'backup_batch'
--   AND (bkp.payload->>'id')::BIGINT = ib.id;
--
-- -- Restore inventory_transactions.description
-- UPDATE public.inventory_transactions it
-- SET description = bkp.payload->>'description'
-- FROM public._revert_double_deduct_20260423 bkp
-- WHERE bkp.action = 'backup_txn'
--   AND (bkp.payload->>'id')::BIGINT = it.id;
--
-- -- Xoá backup sau khi rollback thành công
-- DROP TABLE public._revert_double_deduct_20260423;
--
-- COMMIT;
-- ============================================================================
