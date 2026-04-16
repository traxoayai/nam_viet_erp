-- Fix: _validate_stock_availability check tồn toàn hệ thống (không filter warehouse)
-- Lý do: Chỉ có 1 kho, catalog hiện tồn toàn hệ thống → stock check cũng phải giống
-- Date: 2026-04-16

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

    -- Check tồn toàn hệ thống (không filter warehouse — hiện chỉ có 1 kho)
    SELECT COALESCE(SUM(quantity), 0) INTO v_available
    FROM public.inventory_batches
    WHERE product_id = (v_item->>'product_id')::BIGINT
      AND quantity > 0;

    IF v_available < v_base_qty THEN
      SELECT name INTO v_product_name FROM public.products WHERE id = (v_item->>'product_id')::BIGINT;
      RAISE EXCEPTION 'Không đủ tồn kho cho "%". Cần: %, Tồn: %',
        COALESCE(v_product_name, 'SP #' || (v_item->>'product_id')), v_base_qty, v_available;
    END IF;
  END LOOP;
END;
$fn$;

COMMIT;
