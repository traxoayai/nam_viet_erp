-- Migration: Auto-deduct stock khi → CONFIRMED, auto-restock khi → CANCELLED
-- ============================================================================
-- GOAL:
--   1. CONFIRMED: đơn B2B chuyển từ status khác → CONFIRMED sẽ tự trừ kho
--      (fix bug flow DRAFT → updateStatus('CONFIRMED') không trừ, đơn khác lấy mất)
--   2. CANCELLED: đơn chuyển sang CANCELLED sẽ tự hoàn kho nếu đã trừ trước đó
--      (tránh thiếu kho do cancel không hoàn)
-- IDEMPOTENT:
--   - Helper check inventory_transactions trước khi làm → an toàn retry
--   - Nếu cancel flow cũ đã hoàn (có txn RETURN), trigger không làm thêm
-- SCOPE:
--   - CONFIRMED trigger: chỉ order_type='B2B' (POS/CLINICAL giữ flow cũ)
--   - CANCELLED trigger: mọi order_type (cancel phải hoàn kho nếu đã trừ)
-- Date: 2026-04-17
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Helper _confirm_deduct_stock: trừ kho idempotent khi đơn chuyển CONFIRMED
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._confirm_deduct_stock(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code TEXT;
  v_warehouse_id BIGINT;
  v_partner_id TEXT;
  v_item RECORD;
  v_already_deducted BOOLEAN;
BEGIN
  SELECT code, warehouse_id, COALESCE(customer_id::TEXT, customer_b2c_id::TEXT)
  INTO v_code, v_warehouse_id, v_partner_id
  FROM public.orders WHERE id = p_order_id;

  IF v_code IS NULL OR v_warehouse_id IS NULL THEN RETURN; END IF;

  -- Idempotent guard: skip nếu đã có txn SALE cho đơn này
  SELECT EXISTS (
    SELECT 1 FROM public.inventory_transactions
    WHERE ref_id = v_code
      AND action_group IN ('sale', 'SALE')
      AND quantity < 0
      AND COALESCE(description, '') NOT LIKE '[REVERTED-DOUBLE-DEDUCT%'
  ) INTO v_already_deducted;

  IF v_already_deducted THEN RETURN; END IF;

  -- FEFO deduct từng item (throw exception nếu thiếu hàng)
  FOR v_item IN
    SELECT oi.product_id,
           (oi.quantity * COALESCE(oi.conversion_factor, 1))::NUMERIC AS base_qty,
           oi.unit_price
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    PERFORM public._deduct_stock_fefo(
      v_warehouse_id, v_item.product_id, v_item.base_qty,
      v_item.unit_price, v_code, v_partner_id
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Helper _cancel_restock: hoàn kho idempotent khi đơn chuyển CANCELLED
-- ---------------------------------------------------------------------------
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
  FOR v_txn IN
    SELECT warehouse_id, product_id, batch_id,
           SUM(ABS(quantity))::INTEGER AS total_deducted
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

-- ---------------------------------------------------------------------------
-- 3. Trigger functions
-- ---------------------------------------------------------------------------

-- Fire khi status chuyển sang CONFIRMED (chỉ đơn B2B)
CREATE OR REPLACE FUNCTION public.trg_orders_deduct_on_confirm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'CONFIRMED'
     AND OLD.status IS DISTINCT FROM 'CONFIRMED'
     AND NEW.order_type = 'B2B' THEN
    PERFORM public._confirm_deduct_stock(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Fire khi status chuyển sang CANCELLED (mọi loại đơn)
CREATE OR REPLACE FUNCTION public.trg_orders_restock_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'CANCELLED'
     AND OLD.status IS DISTINCT FROM 'CANCELLED' THEN
    PERFORM public._cancel_restock(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Attach triggers (idempotent replace)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS orders_deduct_on_confirm ON public.orders;
CREATE TRIGGER orders_deduct_on_confirm
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_orders_deduct_on_confirm();

DROP TRIGGER IF EXISTS orders_restock_on_cancel ON public.orders;
CREATE TRIGGER orders_restock_on_cancel
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_orders_restock_on_cancel();

COMMIT;

-- ============================================================================
-- ROLLBACK (chạy thủ công nếu cần):
-- ============================================================================
-- BEGIN;
-- DROP TRIGGER IF EXISTS orders_deduct_on_confirm ON public.orders;
-- DROP TRIGGER IF EXISTS orders_restock_on_cancel ON public.orders;
-- DROP FUNCTION IF EXISTS public.trg_orders_deduct_on_confirm();
-- DROP FUNCTION IF EXISTS public.trg_orders_restock_on_cancel();
-- DROP FUNCTION IF EXISTS public._confirm_deduct_stock(UUID);
-- DROP FUNCTION IF EXISTS public._cancel_restock(UUID);
-- COMMIT;
-- ============================================================================
