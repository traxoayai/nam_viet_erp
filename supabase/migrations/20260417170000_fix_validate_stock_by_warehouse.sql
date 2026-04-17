-- Migration: _validate_stock_availability filter tồn theo p_warehouse_id
-- Bug cũ: SUM toàn hệ thống (không filter kho) → đơn Portal đặt được qty > tồn kho B2B thật
--         vì tính gộp cả kho retail → bug thiếu hàng lúc đóng gói
-- Fix: filter warehouse_id = p_warehouse_id (đã được Task 2 ép = kho B2B với đơn B2B)
-- Date: 2026-04-17

BEGIN;

CREATE OR REPLACE FUNCTION public._validate_stock_availability(
  p_warehouse_id BIGINT,
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
  v_item JSONB;
  v_factor NUMERIC;
  v_base_qty NUMERIC;
  v_available NUMERIC;
  v_product_name TEXT;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_factor := public._resolve_conversion_factor(
      (v_item->>'product_id')::BIGINT,
      v_item->>'uom',
      COALESCE((v_item->>'conversion_factor')::NUMERIC, 0)
    );
    v_base_qty := (v_item->>'quantity')::NUMERIC * v_factor;

    -- [CHANGED] Filter theo kho xuất hàng (không SUM toàn hệ thống)
    SELECT COALESCE(SUM(quantity), 0) INTO v_available
    FROM public.inventory_batches
    WHERE product_id = (v_item->>'product_id')::BIGINT
      AND quantity > 0
      AND warehouse_id = p_warehouse_id;

    IF v_available < v_base_qty THEN
      SELECT name INTO v_product_name FROM public.products WHERE id = (v_item->>'product_id')::BIGINT;
      RAISE EXCEPTION 'Không đủ tồn kho cho "%". Cần: %, Tồn: %',
        COALESCE(v_product_name, 'SP #' || (v_item->>'product_id')), v_base_qty, v_available;
    END IF;
  END LOOP;
END;
$fn$;

COMMIT;
