-- Rollback phiếu KK-20260424-032754 — bug "Đủ/OK" không commit (4/2026)
-- ============================================================================
-- Phiếu này có 7 items với counted_at IS NULL nhưng đã COMPLETED →
-- complete_inventory_check (v4 cũ) tính diff = 0 - system_quantity → xuất oan.
--
-- Items affected (đã verify qua REST API):
--   product_id=5372 (3), 4004 (200), 1118 (15), 5592 (2900 Salbutamol),
--   1574 (1000), + 2 items khác trong response truncate.
--
-- Action:
--   1. Xác định items có counted_at IS NULL trong phiếu
--   2. Tìm out_adjust transaction matching → revert
--   3. Cộng lại inventory_batches.quantity
--   4. DELETE transactions oan
--   5. Sync product_inventory
--   6. Reset phiếu về DRAFT để user kiểm kê lại
--
-- Idempotent: chỉ rollback nếu transaction còn tồn tại (chưa rollback trước đó).
-- Date: 2026-04-25
-- ============================================================================

BEGIN;

DO $rollback$
DECLARE
  v_check_code TEXT := 'KK-20260424-032754';
  v_check_id BIGINT;
  v_warehouse_id BIGINT;
  v_item RECORD;
  v_tx RECORD;
  v_revert_count INT := 0;
  v_total_restored NUMERIC := 0;
BEGIN
  -- Lookup check
  SELECT id, warehouse_id INTO v_check_id, v_warehouse_id
  FROM public.inventory_checks WHERE code = v_check_code;

  IF v_check_id IS NULL THEN
    RAISE NOTICE 'Phiếu % không tồn tại — bỏ qua rollback', v_check_code;
    RETURN;
  END IF;

  RAISE NOTICE 'Bắt đầu rollback phiếu % (id=%, warehouse=%)', v_check_code, v_check_id, v_warehouse_id;

  -- Loop items chưa đếm
  FOR v_item IN
    SELECT id, product_id, batch_code, system_quantity, actual_quantity
    FROM public.inventory_check_items
    WHERE check_id = v_check_id
      AND counted_at IS NULL
      AND COALESCE(actual_quantity, 0) = 0
      AND COALESCE(system_quantity, 0) > 0
  LOOP
    RAISE NOTICE '  Rollback item product_id=%, batch=%, system_qty=%',
      v_item.product_id, v_item.batch_code, v_item.system_quantity;

    -- Tìm transactions out_adjust matching
    FOR v_tx IN
      SELECT it.id AS tx_id, it.batch_id, it.quantity, it.warehouse_id
      FROM public.inventory_transactions it
      WHERE it.ref_id = v_check_code
        AND it.type = 'out_adjust'
        AND it.action_group = 'ADJUST'
        AND it.product_id = v_item.product_id
        AND it.quantity < 0
    LOOP
      -- Cộng lại quantity vào inventory_batches
      UPDATE public.inventory_batches
      SET quantity = quantity + ABS(v_tx.quantity), updated_at = NOW()
      WHERE warehouse_id = v_tx.warehouse_id
        AND product_id = v_item.product_id
        AND batch_id = v_tx.batch_id;

      -- DELETE transaction oan
      DELETE FROM public.inventory_transactions WHERE id = v_tx.tx_id;

      v_revert_count := v_revert_count + 1;
      v_total_restored := v_total_restored + ABS(v_tx.quantity);
    END LOOP;
  END LOOP;

  -- Sync product_inventory
  UPDATE public.product_inventory pi
  SET stock_quantity = COALESCE(batch_sum.total, 0), updated_at = NOW()
  FROM (
    SELECT DISTINCT ici.product_id
    FROM public.inventory_check_items ici
    WHERE ici.check_id = v_check_id AND ici.counted_at IS NULL
  ) checked_products
  LEFT JOIN (
    SELECT ib.product_id, SUM(ib.quantity) AS total
    FROM public.inventory_batches ib
    WHERE ib.warehouse_id = v_warehouse_id
    GROUP BY ib.product_id
  ) batch_sum ON checked_products.product_id = batch_sum.product_id
  WHERE pi.product_id = checked_products.product_id
    AND pi.warehouse_id = v_warehouse_id;

  -- Note rollback vào phiếu
  UPDATE public.inventory_checks
  SET note = COALESCE(note, '') || E'\n[ROLLBACK 2026-04-25] Đã hoàn ' || v_total_restored ||
             ' ĐVCS từ ' || v_revert_count || ' giao dịch xuất oan (counted_at IS NULL).',
      status = 'DRAFT',
      completed_at = NULL,
      verified_by = NULL,
      updated_at = NOW()
  WHERE id = v_check_id;

  RAISE NOTICE 'Rollback xong: % giao dịch revert, % ĐVCS hoàn kho. Phiếu reset về DRAFT.',
    v_revert_count, v_total_restored;
END
$rollback$;

NOTIFY pgrst, 'reload schema';
COMMIT;
