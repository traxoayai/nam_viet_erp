-- Migration: confirm_outbound_packing idempotent
-- Mục đích: Không trừ kho lần 2 nếu đơn đã trừ lúc tạo (Portal CONFIRMED / ERP CONFIRMED)
-- Strategy:
--   - Check inventory_transactions trước khi FEFO loop
--   - Nếu đã có txn sale cho order này → aggregate batch từ txn để update order_items
--   - Nếu chưa có → giữ logic FEFO + trừ kho như cũ
-- An toàn: Không thay đổi signature, không mất logic cũ, idempotent (retry-safe)
-- Depends on: 20260417100000_b2b_warehouse_helper.sql (dùng get_b2b_warehouse_id làm fallback)
-- Date: 2026-04-17

BEGIN;

CREATE OR REPLACE FUNCTION public.confirm_outbound_packing(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_status TEXT;
  v_warehouse_id BIGINT;
  v_customer_id BIGINT;
  v_order_code TEXT;

  v_item RECORD;
  v_batch RECORD;
  v_qty_needed INTEGER;
  v_deduct_amount INTEGER;
  v_conversion_factor INTEGER;

  v_agg_batch_no TEXT;
  v_min_expiry DATE;

  v_already_deducted BOOLEAN;
BEGIN
  -- A. Lấy thông tin đơn
  SELECT status, warehouse_id, code, customer_id
  INTO v_current_status, v_warehouse_id, v_order_code, v_customer_id
  FROM public.orders WHERE id = p_order_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy đơn hàng.';
  END IF;

  IF v_current_status != 'CONFIRMED' THEN
    RAISE EXCEPTION 'Đơn hàng không ở trạng thái chờ đóng gói (CONFIRMED).';
  END IF;

  IF v_warehouse_id IS NULL THEN
    v_warehouse_id := public.get_b2b_warehouse_id();
  END IF;

  -- [NEW] Check đơn đã trừ kho chưa (qua inventory_transactions)
  SELECT EXISTS (
    SELECT 1 FROM public.inventory_transactions
    WHERE ref_id = v_order_code
      AND action_group = 'SALE'
      AND quantity < 0
  ) INTO v_already_deducted;

  -- B. LOOP per order item
  FOR v_item IN
    SELECT oi.id AS order_item_id, oi.product_id, oi.quantity, oi.uom,
           oi.conversion_factor, p.name AS product_name, p.actual_cost
    FROM public.order_items oi
    JOIN public.products p ON oi.product_id = p.id
    WHERE oi.order_id = p_order_id
  LOOP
    v_conversion_factor := COALESCE(v_item.conversion_factor, 1);
    v_qty_needed := v_item.quantity * v_conversion_factor;

    v_agg_batch_no := NULL;
    v_min_expiry := NULL;

    IF v_already_deducted THEN
      -- [BRANCH 1] Đơn đã trừ — aggregate batch_code/expiry từ txn đã ghi
      SELECT
        string_agg(DISTINCT b.batch_code, ', ' ORDER BY b.batch_code),
        MIN(b.expiry_date)
      INTO v_agg_batch_no, v_min_expiry
      FROM public.inventory_transactions it
      JOIN public.batches b ON b.id = it.batch_id
      WHERE it.ref_id = v_order_code
        AND it.action_group = 'SALE'
        AND it.product_id = v_item.product_id
        AND it.quantity < 0;

      -- KHÔNG trừ kho, KHÔNG ghi thêm txn.
    ELSE
      -- [BRANCH 2] Đơn chưa trừ — FEFO + trừ kho (logic cũ giữ nguyên)
      v_agg_batch_no := '';

      FOR v_batch IN
        SELECT ib.id, ib.batch_id, ib.quantity, b.inbound_price, b.batch_code, b.expiry_date
        FROM public.inventory_batches ib
        JOIN public.batches b ON ib.batch_id = b.id
        WHERE ib.product_id = v_item.product_id
          AND ib.warehouse_id = v_warehouse_id
          AND ib.quantity > 0
        ORDER BY b.expiry_date ASC, b.created_at ASC
        FOR UPDATE
      LOOP
        EXIT WHEN v_qty_needed <= 0;

        IF v_batch.quantity >= v_qty_needed THEN
          v_deduct_amount := v_qty_needed;
        ELSE
          v_deduct_amount := v_batch.quantity;
        END IF;

        UPDATE public.inventory_batches
        SET quantity = quantity - v_deduct_amount, updated_at = NOW()
        WHERE id = v_batch.id;

        INSERT INTO public.inventory_transactions (
          warehouse_id, product_id, batch_id,
          type, action_group,
          quantity, unit_price,
          ref_id, description, partner_id, created_at, created_by
        ) VALUES (
          v_warehouse_id, v_item.product_id, v_batch.batch_id,
          'sale_order', 'SALE',
          -v_deduct_amount, COALESCE(v_batch.inbound_price, v_item.actual_cost, 0),
          v_order_code, 'Xuất kho đơn ' || v_order_code, v_customer_id, NOW(), auth.uid()
        );

        IF v_agg_batch_no = '' THEN
          v_agg_batch_no := v_batch.batch_code;
          v_min_expiry := v_batch.expiry_date;
        ELSE
          v_agg_batch_no := v_agg_batch_no || ', ' || v_batch.batch_code;
          IF v_batch.expiry_date < v_min_expiry THEN
            v_min_expiry := v_batch.expiry_date;
          END IF;
        END IF;

        v_qty_needed := v_qty_needed - v_deduct_amount;
      END LOOP;

      IF v_qty_needed > 0 THEN
        RAISE EXCEPTION 'Kho không đủ hàng xuất cho sản phẩm "%". Thiếu % (đvcs). Vui lòng kiểm tra tồn kho.',
          v_item.product_name, v_qty_needed;
      END IF;
    END IF;

    -- E. Update order_items (cả 2 nhánh)
    UPDATE public.order_items
    SET
      quantity_picked = (v_item.quantity * v_conversion_factor),
      batch_no = COALESCE(NULLIF(v_agg_batch_no, ''), batch_no),
      expiry_date = COALESCE(v_min_expiry, expiry_date)
    WHERE id = v_item.order_item_id;

  END LOOP;

  -- F. Chuyển trạng thái đơn (cả 2 nhánh)
  UPDATE public.orders
  SET status = 'PACKED', updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_deducted', v_already_deducted,
    'message', CASE
      WHEN v_already_deducted THEN 'Đã đóng gói (kho đã trừ khi tạo đơn).'
      ELSE 'Đã xuất kho và đóng gói thành công.'
    END
  );
END;
$$;

COMMENT ON FUNCTION public.confirm_outbound_packing(UUID) IS
  'V2 (2026-04-17): Idempotent. Không trừ kho lần 2 nếu đơn đã có inventory_transactions cho ref_id. Nhánh đã-trừ aggregate batch_code từ txn đã ghi.';

NOTIFY pgrst, 'reload schema';

COMMIT;
