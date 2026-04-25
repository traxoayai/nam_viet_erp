-- Migration: _cancel_restock — đổi ::INTEGER → ::NUMERIC để tránh truncate phần lẻ
-- ============================================================================
-- Bug: SUM(ABS(quantity))::INTEGER cắt phần thập phân khi quantity là NUMERIC
--       (VD: 2.5 hộp → 2 sau khi cast → hoàn thiếu 0.5 hộp).
-- Fix: cast sang NUMERIC thay INTEGER; logic restock giữ nguyên.
-- Idempotent: CREATE OR REPLACE — an toàn chạy lại.
-- Date: 2026-04-25
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public._cancel_restock(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code TEXT;
  v_txn RECORD;
  v_already_restocked BOOLEAN;
BEGIN
  SELECT code INTO v_code FROM public.orders WHERE id = p_order_id;
  IF v_code IS NULL THEN RETURN; END IF;

  -- Idempotent guard: skip nếu đã có txn RETURN cho đơn này
  SELECT EXISTS (
    SELECT 1 FROM public.inventory_transactions
    WHERE ref_id = v_code
      AND action_group = 'RETURN'
      AND quantity > 0
  ) INTO v_already_restocked;

  IF v_already_restocked THEN RETURN; END IF;

  -- Aggregate lượng đã trừ từ TẤT CẢ txn SALE (không tính txn đã REVERTED)
  -- group theo (warehouse, product, batch) để hoàn đúng lô
  -- FIX: dùng ::NUMERIC thay ::INTEGER để giữ phần thập phân (tránh truncate)
  FOR v_txn IN
    SELECT warehouse_id, product_id, batch_id,
           SUM(ABS(quantity))::NUMERIC AS total_deducted
    FROM public.inventory_transactions
    WHERE ref_id = v_code
      AND action_group IN ('sale', 'SALE')
      AND quantity < 0
      AND COALESCE(description, '') NOT LIKE '[REVERTED-DOUBLE-DEDUCT%'
    GROUP BY warehouse_id, product_id, batch_id
    HAVING SUM(ABS(quantity)) > 0
  LOOP
    -- Cộng lại inventory_batches (nếu batch record tồn tại)
    UPDATE public.inventory_batches
    SET quantity = quantity + v_txn.total_deducted, updated_at = NOW()
    WHERE warehouse_id = v_txn.warehouse_id
      AND product_id = v_txn.product_id
      AND batch_id = v_txn.batch_id;

    -- Log txn RETURN
    INSERT INTO public.inventory_transactions (
      warehouse_id, product_id, batch_id,
      type, action_group, quantity,
      ref_id, description, created_at, created_by
    ) VALUES (
      v_txn.warehouse_id, v_txn.product_id, v_txn.batch_id,
      'import', 'RETURN', v_txn.total_deducted,
      v_code, 'Hoàn kho do hủy đơn ' || v_code, NOW(), auth.uid()
    );
  END LOOP;
END;
$$;

-- Notify PostgREST reload schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
