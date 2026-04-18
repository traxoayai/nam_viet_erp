-- Migration: REVERT đợt 2 — 5 đơn bị double-deduct do bug case-sensitivity
-- ============================================================================
-- BUG: Migration 20260417115000 check idempotent `action_group = 'SALE'` (uppercase only)
--      nhưng _deduct_stock_fefo ghi 'sale' (lowercase). Guard miss → trừ lần 2.
-- FIXED: Migration 20260417200000 đổi thành IN ('sale', 'SALE').
-- Nhưng trong window giữa 2 migration, 5 đơn đã bị admin đóng gói → bị trừ kho lần 2.
-- FIX: Cộng ngược phần trừ từ confirm_outbound_packing (type='sale_order', action_group='SALE')
--      vào inventory_batches. Giữ txn làm audit trail, mark [REVERTED-CASE-BUG].
-- Danh sách: SO-260416-1329 (portal), SO-260417-9853, SO-260418-2856, SO-260418-6239, SO-260418-8881 (erp)
-- Date: 2026-04-18
-- ============================================================================

BEGIN;

-- 1. Bảng backup riêng cho đợt này
CREATE TABLE IF NOT EXISTS public._revert_double_deduct_20260418 (
  id BIGSERIAL PRIMARY KEY,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS _revert_double_deduct_20260418_action_idx
  ON public._revert_double_deduct_20260418(action);

COMMENT ON TABLE public._revert_double_deduct_20260418 IS
  'Backup đợt 2 (2026-04-18): 5 đơn double-deduct do bug case-sensitivity 20260417115000. Giữ để rollback.';

-- 2. Logic revert
DO $$
DECLARE
  v_already_run BOOLEAN;
  v_order_codes TEXT[] := ARRAY[
    'SO-260416-1329', 'SO-260417-9853', 'SO-260418-2856',
    'SO-260418-6239', 'SO-260418-8881'
  ];
BEGIN
  -- Guard idempotent
  SELECT EXISTS (
    SELECT 1 FROM public._revert_double_deduct_20260418 WHERE action = 'backup_txn'
  ) INTO v_already_run;

  IF v_already_run THEN
    RAISE NOTICE 'Migration đã chạy trước đó. Bỏ qua để tránh double-revert.';
    RETURN;
  END IF;

  -- 3. Backup tất cả txn type='sale_order'/action_group='SALE' của 5 đơn
  -- (Đây là txn "dư" từ confirm_outbound_packing — phải revert, giữ lại 'out'/'sale' làm txn chính)
  INSERT INTO public._revert_double_deduct_20260418 (action, payload)
  SELECT 'backup_txn', to_jsonb(it.*)
  FROM public.inventory_transactions it
  WHERE it.ref_id = ANY(v_order_codes)
    AND it.type = 'sale_order'
    AND it.action_group = 'SALE';

  -- 4. Backup inventory_batches sẽ bị UPDATE
  INSERT INTO public._revert_double_deduct_20260418 (action, payload)
  SELECT DISTINCT 'backup_batch', to_jsonb(ib.*)
  FROM public.inventory_batches ib
  WHERE (ib.warehouse_id, ib.product_id, ib.batch_id) IN (
    SELECT DISTINCT it.warehouse_id, it.product_id, it.batch_id
    FROM public.inventory_transactions it
    WHERE it.ref_id = ANY(v_order_codes)
      AND it.type = 'sale_order'
      AND it.action_group = 'SALE'
  );

  -- 5. Cộng ngược inventory_batches += ABS(txn.quantity)
  WITH to_revert AS (
    SELECT it.warehouse_id, it.product_id, it.batch_id,
           SUM(ABS(it.quantity))::INTEGER AS revert_qty
    FROM public.inventory_transactions it
    WHERE it.ref_id = ANY(v_order_codes)
      AND it.type = 'sale_order'
      AND it.action_group = 'SALE'
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

  -- 6. Mark txn đã revert
  UPDATE public.inventory_transactions
  SET description = '[REVERTED-CASE-BUG 2026-04-18] ' || COALESCE(description, '')
  WHERE ref_id = ANY(v_order_codes)
    AND type = 'sale_order'
    AND action_group = 'SALE'
    AND COALESCE(description, '') NOT LIKE '[REVERTED-CASE-BUG 2026-04-18]%';

  RAISE NOTICE 'Revert đợt 2 hoàn tất cho 5 đơn. Backup: _revert_double_deduct_20260418.';
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK (thủ công):
-- BEGIN;
-- UPDATE public.inventory_batches ib
-- SET quantity = (bkp.payload->>'quantity')::INTEGER, updated_at = NOW()
-- FROM public._revert_double_deduct_20260418 bkp
-- WHERE bkp.action = 'backup_batch' AND (bkp.payload->>'id')::BIGINT = ib.id;
--
-- UPDATE public.inventory_transactions it
-- SET description = bkp.payload->>'description'
-- FROM public._revert_double_deduct_20260418 bkp
-- WHERE bkp.action = 'backup_txn' AND (bkp.payload->>'id')::BIGINT = it.id;
--
-- DROP TABLE public._revert_double_deduct_20260418;
-- COMMIT;
-- ============================================================================
