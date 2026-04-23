-- Defensive fixes cho validate_stock_for_order (code review feedback)
-- 1. Inline conversion resolve — reject uom không có trong product_units
--    thay vì silent fallback factor=1 (defeats audit goal).
-- 2. Validate p_items structure — items thiếu key → reason='invalid_payload'.
-- 3. Guard quantity ≤ 0 → reason='invalid_quantity'.
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
  v_product_id bigint;
  v_uom text;
  v_quantity numeric;
  v_explicit_factor numeric;
  v_factor numeric;
  v_requested_base numeric;
  v_available numeric;
  v_product record;
  v_product_name text;
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
    -- Validate structure
    IF NOT (v_item ? 'product_id' AND v_item ? 'quantity' AND v_item ? 'uom') THEN
      v_insufficient := v_insufficient || jsonb_build_array(jsonb_build_object(
        'product_id', NULL,
        'product_name', 'Invalid payload',
        'uom', NULL,
        'conversion_factor', NULL,
        'requested_uom', NULL,
        'requested_base', NULL,
        'available_base', NULL,
        'deficit_base', NULL,
        'reason', 'invalid_payload'
      ));
      CONTINUE;
    END IF;

    v_product_id := (v_item->>'product_id')::bigint;
    v_uom := v_item->>'uom';
    v_quantity := (v_item->>'quantity')::numeric;
    v_explicit_factor := COALESCE((v_item->>'conversion_factor')::numeric, 0);

    -- Guard quantity
    IF v_quantity <= 0 THEN
      SELECT name INTO v_product_name FROM public.products WHERE id = v_product_id;
      v_insufficient := v_insufficient || jsonb_build_array(jsonb_build_object(
        'product_id', v_product_id,
        'product_name', COALESCE(v_product_name, 'SP #' || v_product_id),
        'uom', v_uom,
        'conversion_factor', NULL,
        'requested_uom', v_quantity,
        'requested_base', NULL,
        'available_base', NULL,
        'deficit_base', NULL,
        'reason', 'invalid_quantity'
      ));
      CONTINUE;
    END IF;

    -- Resolve conversion factor inline (reject khi unknown uom)
    IF v_explicit_factor > 0 THEN
      v_factor := v_explicit_factor;
    ELSE
      SELECT conversion_rate INTO v_factor
      FROM public.product_units
      WHERE product_id = v_product_id AND unit_name = v_uom
      LIMIT 1;
    END IF;

    IF v_factor IS NULL OR v_factor <= 0 THEN
      SELECT name INTO v_product_name FROM public.products WHERE id = v_product_id;
      v_insufficient := v_insufficient || jsonb_build_array(jsonb_build_object(
        'product_id', v_product_id,
        'product_name', COALESCE(v_product_name, 'SP #' || v_product_id),
        'uom', v_uom,
        'conversion_factor', NULL,
        'requested_uom', v_quantity,
        'requested_base', NULL,
        'available_base', NULL,
        'deficit_base', NULL,
        'reason', 'unknown_uom'
      ));
      CONTINUE;
    END IF;

    v_requested_base := v_quantity * v_factor;

    SELECT COALESCE(SUM(quantity), 0) INTO v_available
    FROM public.inventory_batches
    WHERE product_id = v_product_id
      AND quantity > 0
      AND warehouse_id = p_warehouse_id;

    SELECT id, name INTO v_product
    FROM public.products
    WHERE id = v_product_id;

    IF v_available < v_requested_base THEN
      v_insufficient := v_insufficient || jsonb_build_array(jsonb_build_object(
        'product_id', v_product_id,
        'product_name', COALESCE(v_product.name, 'SP #' || v_product_id),
        'uom', v_uom,
        'conversion_factor', v_factor,
        'requested_uom', v_quantity,
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
