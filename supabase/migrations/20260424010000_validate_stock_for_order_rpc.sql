-- Expose stock validation như RPC trả jsonb detail (thay vì throw)
-- AUDIT FINDING #3 + #10 + #17: Portal đang so UOM qty với BASE qty silent
-- → oversell. RPC mới return structured result để Portal hiển thị UI rõ ràng.
-- Date: 2026-04-24

BEGIN;

CREATE OR REPLACE FUNCTION public.validate_stock_for_order(
  p_warehouse_id bigint,
  p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item jsonb;
  v_factor numeric;
  v_requested_base numeric;
  v_available numeric;
  v_product record;
  v_insufficient jsonb := '[]'::jsonb;
BEGIN
  IF p_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'validate_stock_for_order: p_warehouse_id required';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'insufficient', '[]'::jsonb);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_factor := public._resolve_conversion_factor(
      (v_item->>'product_id')::bigint,
      v_item->>'uom',
      COALESCE((v_item->>'conversion_factor')::numeric, 0)
    );
    v_requested_base := (v_item->>'quantity')::numeric * v_factor;

    SELECT COALESCE(SUM(quantity), 0) INTO v_available
    FROM public.inventory_batches
    WHERE product_id = (v_item->>'product_id')::bigint
      AND quantity > 0
      AND warehouse_id = p_warehouse_id;

    SELECT id, name INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::bigint;

    IF v_available < v_requested_base THEN
      v_insufficient := v_insufficient || jsonb_build_array(jsonb_build_object(
        'product_id', (v_item->>'product_id')::bigint,
        'product_name', COALESCE(v_product.name, 'SP #' || (v_item->>'product_id')),
        'uom', v_item->>'uom',
        'conversion_factor', v_factor,
        'requested_uom', (v_item->>'quantity')::numeric,
        'requested_base', v_requested_base,
        'available_base', v_available,
        'deficit_base', v_requested_base - v_available,
        'reason', CASE WHEN v_available = 0 THEN 'out_of_stock' ELSE 'not_enough' END
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', jsonb_array_length(v_insufficient) = 0,
    'insufficient', v_insufficient
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_stock_for_order(bigint, jsonb)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
