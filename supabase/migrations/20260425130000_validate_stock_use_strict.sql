-- Migration: _validate_stock_availability dùng _resolve_conversion_factor_strict
-- ============================================================================
-- BUG: _validate_stock_availability gọi _resolve_conversion_factor (non-strict)
--      → khi UOM không tồn tại, fallback về conversion_factor do client truyền
--      → client độc hại có thể truyền factor=1 cho UOM "Hộp 10" → bỏ qua
--        nhân hệ số → kiểm tra tồn kho sai (cần 10 × 40 = 400 nhưng check 40).
-- FIX: Thay _resolve_conversion_factor → _resolve_conversion_factor_strict
--      (migration 20260424030000) sẽ RAISE EXCEPTION nếu UOM không khớp DB.
-- Date: 2026-04-25
-- ============================================================================

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
    -- [CHANGED] Dùng _strict variant: RAISE nếu UOM không tồn tại trong product_units
    v_factor := public._resolve_conversion_factor_strict(
      (v_item->>'product_id')::BIGINT,
      v_item->>'uom',
      COALESCE((v_item->>'conversion_factor')::NUMERIC, 0)
    );
    v_base_qty := (v_item->>'quantity')::NUMERIC * v_factor;

    -- Filter theo kho xuất hàng (không SUM toàn hệ thống)
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

NOTIFY pgrst, 'reload schema';

COMMIT;
