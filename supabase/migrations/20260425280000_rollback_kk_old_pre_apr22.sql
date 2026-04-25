-- Rollback 38 phiếu kiểm kê cũ bị bug "Đủ/OK" (1/2026 - 7/4/2026)
-- ============================================================================
-- Cùng pattern bug với 7 phiếu đã rollback (240000, 260000): items
-- counted_at IS NULL + actual=0 + system>0 nhưng phiếu đã COMPLETED →
-- complete_inventory_check (v3 cũ) tạo out_adjust oan với diff = -system_qty.
--
-- LOGIC ROLLBACK:
--   Mỗi tx có quantity âm cụ thể. Xóa tx + cộng ABS(quantity) vào
--   inventory_batches = phục hồi exact trạng thái before-bug. Các tx
--   subsequent (sale/inbound/transfer) không bị đụng → tồn cuối = baseline +
--   ALL_DELTAS_REMAINING = đúng số thật. Nếu hàng đã bán hết → tồn cuối = 0
--   (tx out_sale subsequent vẫn áp dụng).
--
-- Scope dynamic: tất cả phiếu COMPLETED có items uncounted + completed_at <
-- '2026-04-22' (ngày hotfix complete_inventory_check apply ở 20260425030000).
-- Phiếu sau ngày này hoặc đã DRAFT đều exclude.
--
-- Idempotent: chỉ revert nếu tx oan còn tồn tại.
-- Date: 2026-04-25
-- ============================================================================

BEGIN;

DO $rollback$
DECLARE
  v_check_code TEXT;
  v_check_id BIGINT;
  v_warehouse_id BIGINT;
  v_item RECORD;
  v_tx RECORD;
  v_revert_count INT;
  v_total_restored NUMERIC;
  v_grand_revert INT := 0;
  v_grand_restored NUMERIC := 0;
  v_phieu_count INT := 0;
BEGIN
  FOR v_check_code, v_check_id, v_warehouse_id IN
    SELECT ic.code, ic.id, ic.warehouse_id
    FROM public.inventory_checks ic
    JOIN public.inventory_check_items ici ON ici.check_id = ic.id
    WHERE ic.status = 'COMPLETED'
      AND ic.completed_at < '2026-04-22'::timestamptz
    GROUP BY ic.id, ic.code, ic.warehouse_id
    HAVING COUNT(ici.id) FILTER (
      WHERE ici.counted_at IS NULL
        AND COALESCE(ici.system_quantity, 0) > 0
        AND COALESCE(ici.actual_quantity, 0) = 0
    ) > 0
    ORDER BY ic.completed_at ASC
  LOOP
    v_revert_count := 0;
    v_total_restored := 0;
    v_phieu_count := v_phieu_count + 1;

    RAISE NOTICE '── % | % (id=%, wh=%)', v_phieu_count, v_check_code, v_check_id, v_warehouse_id;

    FOR v_item IN
      SELECT id, product_id, batch_code, system_quantity
      FROM public.inventory_check_items
      WHERE check_id = v_check_id
        AND counted_at IS NULL
        AND COALESCE(actual_quantity, 0) = 0
        AND COALESCE(system_quantity, 0) > 0
    LOOP
      FOR v_tx IN
        SELECT it.id AS tx_id, it.batch_id, it.quantity, it.warehouse_id
        FROM public.inventory_transactions it
        WHERE it.ref_id = v_check_code
          AND it.type = 'out_adjust'
          AND it.action_group = 'ADJUST'
          AND it.product_id = v_item.product_id
          AND it.quantity < 0
      LOOP
        UPDATE public.inventory_batches
        SET quantity = quantity + ABS(v_tx.quantity), updated_at = NOW()
        WHERE warehouse_id = v_tx.warehouse_id
          AND product_id = v_item.product_id
          AND batch_id = v_tx.batch_id;

        DELETE FROM public.inventory_transactions WHERE id = v_tx.tx_id;

        v_revert_count := v_revert_count + 1;
        v_total_restored := v_total_restored + ABS(v_tx.quantity);
      END LOOP;
    END LOOP;

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

    UPDATE public.inventory_checks
    SET note = COALESCE(note, '') || E'\n[ROLLBACK 2026-04-25 batch-old] Hoàn ' || v_total_restored ||
               ' ĐVCS từ ' || v_revert_count || ' tx xuất oan (bug "Đủ/OK" pre-hotfix).',
        status = 'DRAFT',
        completed_at = NULL,
        verified_by = NULL,
        updated_at = NOW()
    WHERE id = v_check_id;

    RAISE NOTICE '   → % tx, % ĐVCS hoàn kho. Reset DRAFT.', v_revert_count, v_total_restored;
    v_grand_revert := v_grand_revert + v_revert_count;
    v_grand_restored := v_grand_restored + v_total_restored;
  END LOOP;

  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'TỔNG: % phiếu, % giao dịch revert, % ĐVCS hoàn kho.',
    v_phieu_count, v_grand_revert, v_grand_restored;
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END
$rollback$;

NOTIFY pgrst, 'reload schema';
COMMIT;
