-- Rollback batch 6 phiếu KK bị bug "Đủ/OK" không commit (22-24/04/2026)
-- ============================================================================
-- Cùng pattern với KK-20260424-032754: items có counted_at IS NULL nhưng đã
-- COMPLETED → complete_inventory_check (v3 cũ) tính diff = 0 - system_quantity
-- → tạo out_adjust transaction xuất oan.
--
-- Scope: 6 phiếu gần nhất chưa qua kế toán (ngày user phát hiện bug Salbutamol).
--   608 KK-20260424-035509  (9 items)
--   605 KK-20260424-034300  (4 items)
--   603 KK-20260424-031120  (3 items)
--   602 KK-20260424-030057  (2 items)
--   598 KK-20260424-024718  (2 items)
--   589 KK-20260422-080421  (1 item)
--
-- Action per check:
--   1. Loop items có counted_at IS NULL + actual=0 + system>0
--   2. Tìm out_adjust tx matching (ref_id=check_code, type=out_adjust, qty<0)
--   3. Cộng lại inventory_batches.quantity
--   4. DELETE tx oan
--   5. Sync product_inventory
--   6. Reset phiếu DRAFT + note
--
-- Idempotent: chỉ rollback nếu transaction còn tồn tại.
-- Phiếu cũ hơn (1-3/2026) KHÔNG rollback ở đây — cần kế toán review.
-- Date: 2026-04-25
-- ============================================================================

BEGIN;

DO $rollback$
DECLARE
  v_check_codes TEXT[] := ARRAY[
    'KK-20260424-035509',
    'KK-20260424-034300',
    'KK-20260424-031120',
    'KK-20260424-030057',
    'KK-20260424-024718',
    'KK-20260422-080421'
  ];
  v_check_code TEXT;
  v_check_id BIGINT;
  v_warehouse_id BIGINT;
  v_item RECORD;
  v_tx RECORD;
  v_revert_count INT;
  v_total_restored NUMERIC;
  v_grand_revert INT := 0;
  v_grand_restored NUMERIC := 0;
BEGIN
  FOREACH v_check_code IN ARRAY v_check_codes LOOP
    SELECT id, warehouse_id INTO v_check_id, v_warehouse_id
    FROM public.inventory_checks WHERE code = v_check_code;

    IF v_check_id IS NULL THEN
      RAISE NOTICE 'SKIP: phiếu % không tồn tại', v_check_code;
      CONTINUE;
    END IF;

    v_revert_count := 0;
    v_total_restored := 0;

    RAISE NOTICE '── Rollback % (id=%, warehouse=%)', v_check_code, v_check_id, v_warehouse_id;

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
    SET note = COALESCE(note, '') || E'\n[ROLLBACK 2026-04-25] Đã hoàn ' || v_total_restored ||
               ' ĐVCS từ ' || v_revert_count || ' giao dịch xuất oan (counted_at IS NULL).',
        status = 'DRAFT',
        completed_at = NULL,
        verified_by = NULL,
        updated_at = NOW()
    WHERE id = v_check_id;

    RAISE NOTICE '   → % tx revert, % ĐVCS hoàn kho. Reset DRAFT.', v_revert_count, v_total_restored;
    v_grand_revert := v_grand_revert + v_revert_count;
    v_grand_restored := v_grand_restored + v_total_restored;
  END LOOP;

  RAISE NOTICE '════ TỔNG: % giao dịch revert, % ĐVCS hoàn kho across % phiếu', v_grand_revert, v_grand_restored, array_length(v_check_codes, 1);
END
$rollback$;

NOTIFY pgrst, 'reload schema';
COMMIT;
