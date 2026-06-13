/**
 * Fee Distribution RPC — allocate_invoice_fees()
 *
 * Allocates purchase fees (shipping, handling, customs, etc.) proportionally
 * across invoice line items based on their line_total values.
 *
 * Usage:
 *   SELECT allocate_invoice_fees(
 *     '{"lines": [{"product_id": 1, "line_total": 1000}, {"product_id": 2, "line_total": 2000}]}'::jsonb,
 *     300
 *   )
 *
 * Returns JSONB with allocated_fee added to each line item.
 * Edge cases:
 *   - If p_fee_total = 0, returns items unchanged
 *   - If v_total_value = 0, returns items unchanged
 *   - Null line_total is treated as 0
 *   - Allocated fees are rounded to 2 decimal places
 */
CREATE OR REPLACE FUNCTION allocate_invoice_fees(
  p_items_json JSONB,
  p_fee_total DECIMAL
) RETURNS JSONB AS $$
DECLARE
  v_total_value DECIMAL := 0;
  v_line JSONB;
  v_allocation DECIMAL;
  v_result JSONB := p_items_json;
  v_lines_array JSONB[] := ARRAY[]::JSONB[];
BEGIN
  -- Calculate total line value (before fee allocation)
  FOR v_line IN SELECT jsonb_array_elements(p_items_json -> 'lines')
  LOOP
    v_total_value := v_total_value + COALESCE((v_line->>'line_total')::DECIMAL, 0);
  END LOOP;

  -- If fee is 0 or total value is 0, return unchanged
  IF v_total_value = 0 OR p_fee_total = 0 THEN
    RETURN v_result;
  END IF;

  -- Allocate fees proportionally
  FOR v_line IN SELECT jsonb_array_elements(p_items_json -> 'lines')
  LOOP
    v_allocation := (COALESCE((v_line->>'line_total')::DECIMAL, 0) / v_total_value) * p_fee_total;
    v_lines_array := array_append(
      v_lines_array,
      v_line || jsonb_build_object('allocated_fee', ROUND(v_allocation, 2))
    );
  END LOOP;

  v_result := jsonb_set(v_result, '{lines}', to_jsonb(v_lines_array));
  RETURN v_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
