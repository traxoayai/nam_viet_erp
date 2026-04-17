-- Migration: REVERT data fix cho 10 đơn bị trừ kho 2 lần
-- ============================================================================
-- BUG: Các đơn có cả txn type='out'/action='sale' (từ create_sales_order) VÀ
--      txn type='sale_order'/action='SALE' (từ confirm_outbound_packing)
--      → bị trừ inventory_batches 2 lần cho cùng 1 đơn.
-- FIX: Cộng ngược phần trừ từ create_sales_order (type='out'/action='sale')
--      vào inventory_batches. Giữ txn làm audit trail, chỉ mark description.
-- Net impact sau fix:
--   PACKED/SHIPPING/DELIVERED: net trừ = -X (đúng = 1 lần trừ đóng gói)
--   CANCELLED (đã có +return): net = 0 (đúng = hoàn toàn bộ)
-- 10 đơn: SO-260328-6597, SO-260330-1488, SO-260330-9596, SO-260408-4008,
--         SO-260416-8879, SO-260416-9111, SO-260416-9211, SO-260417-3861,
--         SO-260417-4053, SO-260417-5077
-- Tổng revert: ~2820 đvcs trải nhiều SKU. Lưu backup để rollback 100%.
-- Date: 2026-04-17
-- ============================================================================

BEGIN;

-- 1. Bảng backup (idempotent: chỉ tạo nếu chưa có)
CREATE TABLE IF NOT EXISTS public._revert_double_deduct_20260417 (
  id BIGSERIAL PRIMARY KEY,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL,  -- 'backup_txn' | 'backup_batch'
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS _revert_double_deduct_20260417_action_idx
  ON public._revert_double_deduct_20260417(action);

COMMENT ON TABLE public._revert_double_deduct_20260417 IS
  'Backup snapshot trước khi revert 10 đơn double-deduct (2026-04-17). Giữ để rollback. An toàn xóa sau 30 ngày nếu không cần rollback.';

-- 2. Guard idempotent: chỉ chạy nếu chưa có backup (tránh rerun)
DO $$
DECLARE
  v_already_run BOOLEAN;
  v_order_codes TEXT[] := ARRAY[
    'SO-260328-6597', 'SO-260330-1488', 'SO-260330-9596', 'SO-260408-4008',
    'SO-260416-8879', 'SO-260416-9111', 'SO-260416-9211', 'SO-260417-3861',
    'SO-260417-4053', 'SO-260417-5077'
  ];
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public._revert_double_deduct_20260417
    WHERE action = 'backup_txn'
  ) INTO v_already_run;

  IF v_already_run THEN
    RAISE NOTICE 'Migration đã chạy trước đó. Bỏ qua để tránh double-revert. Xoá bảng _revert_double_deduct_20260417 nếu muốn chạy lại.';
    RETURN;
  END IF;

  -- 3. Backup tất cả txn type='out'/action='sale' của 10 đơn (để rollback)
  INSERT INTO public._revert_double_deduct_20260417 (action, payload)
  SELECT 'backup_txn', to_jsonb(it.*)
  FROM public.inventory_transactions it
  WHERE it.ref_id = ANY(v_order_codes)
    AND it.type = 'out'
    AND it.action_group = 'sale';

  -- 4. Backup inventory_batches rows sẽ bị UPDATE (để rollback)
  INSERT INTO public._revert_double_deduct_20260417 (action, payload)
  SELECT DISTINCT 'backup_batch', to_jsonb(ib.*)
  FROM public.inventory_batches ib
  WHERE (ib.warehouse_id, ib.product_id, ib.batch_id) IN (
    SELECT DISTINCT it.warehouse_id, it.product_id, it.batch_id
    FROM public.inventory_transactions it
    WHERE it.ref_id = ANY(v_order_codes)
      AND it.type = 'out'
      AND it.action_group = 'sale'
  );

  -- 5. Cộng ngược inventory_batches.quantity += ABS(txn.quantity)
  -- Group theo (warehouse_id, product_id, batch_id) để tránh double-apply
  WITH to_revert AS (
    SELECT it.warehouse_id, it.product_id, it.batch_id,
           SUM(ABS(it.quantity))::INTEGER AS revert_qty
    FROM public.inventory_transactions it
    WHERE it.ref_id = ANY(v_order_codes)
      AND it.type = 'out'
      AND it.action_group = 'sale'
      AND it.quantity < 0
    GROUP BY it.warehouse_id, it.product_id, it.batch_id
  )
  UPDATE public.inventory_batches ib
  SET quantity = ib.quantity + tr.revert_qty,
      updated_at = NOW()
  FROM to_revert tr
  WHERE ib.warehouse_id = tr.warehouse_id
    AND ib.product_id = tr.product_id
    AND ib.batch_id = tr.batch_id;

  -- 6. Mark txn đã revert (giữ bản ghi, chỉ prefix description)
  UPDATE public.inventory_transactions
  SET description = '[REVERTED-DOUBLE-DEDUCT 2026-04-17] ' || COALESCE(description, '')
  WHERE ref_id = ANY(v_order_codes)
    AND type = 'out'
    AND action_group = 'sale'
    AND COALESCE(description, '') NOT LIKE '[REVERTED-DOUBLE-DEDUCT 2026-04-17]%';

  RAISE NOTICE 'Revert double-deduct hoàn tất cho 10 đơn. Backup trong _revert_double_deduct_20260417.';
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
-- FROM public._revert_double_deduct_20260417 bkp
-- WHERE bkp.action = 'backup_batch'
--   AND (bkp.payload->>'id')::BIGINT = ib.id;
--
-- -- Restore inventory_transactions.description
-- UPDATE public.inventory_transactions it
-- SET description = bkp.payload->>'description'
-- FROM public._revert_double_deduct_20260417 bkp
-- WHERE bkp.action = 'backup_txn'
--   AND (bkp.payload->>'id')::BIGINT = it.id;
--
-- -- Xoá backup sau khi rollback thành công
-- DROP TABLE public._revert_double_deduct_20260417;
--
-- COMMIT;
-- ============================================================================
