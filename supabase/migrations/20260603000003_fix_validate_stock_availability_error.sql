-- Nâng cấp câu thông báo _validate_stock_availability
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
  v_product_sku TEXT;
  v_req_unit TEXT;
  v_req_qty NUMERIC;
  v_avail_qty NUMERIC;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Lấy thông tin đơn vị yêu cầu
    v_req_unit := v_item->>'uom';
    
    -- Dùng _strict variant để lấy conversion_factor
    v_factor := public._resolve_conversion_factor_strict(
      (v_item->>'product_id')::BIGINT,
      v_req_unit,
      COALESCE((v_item->>'conversion_factor')::NUMERIC, 0)
    );
    
    v_req_qty := (v_item->>'quantity')::NUMERIC;
    v_base_qty := v_req_qty * v_factor;

    -- Lấy tổng tồn kho (base unit) theo kho
    SELECT COALESCE(SUM(quantity), 0) INTO v_available
    FROM public.inventory_batches
    WHERE product_id = (v_item->>'product_id')::BIGINT
      AND quantity > 0
      AND warehouse_id = p_warehouse_id;

    IF v_available < v_base_qty THEN
      -- Lấy thông tin SP
      SELECT name, sku INTO v_product_name, v_product_sku FROM public.products WHERE id = (v_item->>'product_id')::BIGINT;
      
      -- Tính số lượng tồn kho theo đơn vị sỉ/lẻ đang yêu cầu
      v_avail_qty := ROUND(v_available / NULLIF(COALESCE(v_factor, 1), 0), 2);
      
      RAISE EXCEPTION 'Không đủ tồn kho cho SP % (SKU: %). Cần: % %, Tồn: % %',
        COALESCE(v_product_name, 'SP #' || (v_item->>'product_id')), v_product_sku, v_req_qty, COALESCE(v_req_unit, 'Đơn vị'), v_avail_qty, COALESCE(v_req_unit, 'Đơn vị');
    END IF;
  END LOOP;
END;
$fn$;
