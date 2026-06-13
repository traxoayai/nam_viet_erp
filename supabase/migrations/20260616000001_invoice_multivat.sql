-- Add support for multi-VAT invoice lines with per-item tax rates
-- Task: 2.1 Multi-VAT Rate Invoice Schema

-- 1. Add columns to finance_invoices if not exist
-- items_json: already exists (from earlier migrations), but ensure it's JSONB
-- discount_total: invoice-level discount amount
-- fee_total: additional fees (shipping, handling, etc)
ALTER TABLE finance_invoices
ADD COLUMN IF NOT EXISTS discount_total DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fee_total DECIMAL(15,2) DEFAULT 0;

-- 2. Create RPC: calculate_invoice_value(items_json, discount_total, fee_total)
-- Purpose: Compute total invoice value from items_json structure
-- Input:
--   - p_items_json: JSONB with structure { "lines": [ { product_id, name, qty, unit, unit_price, discount_amount, vat_rate, vat_amount, line_total }, ... ] }
--   - p_discount_total: DECIMAL, invoice-level discount
--   - p_fee_total: DECIMAL, fees/shipping costs
-- Output: DECIMAL representing sum(line.line_total) + fee_total - discount_total
--
-- Note: This RPC is IMMUTABLE (no side effects) and safe for use in computed columns,
-- views, or as a pre-calculation helper for UI.
CREATE OR REPLACE FUNCTION calculate_invoice_value(
  p_items_json JSONB,
  p_discount_total DECIMAL DEFAULT 0,
  p_fee_total DECIMAL DEFAULT 0
)
RETURNS DECIMAL AS $$
DECLARE
  v_subtotal DECIMAL := 0;
  v_result DECIMAL;
BEGIN
  -- Sum line_total from each item in the lines array
  -- Safe to coalesce in case items_json is null or malformed
  SELECT COALESCE(SUM((line->>'line_total')::DECIMAL), 0)
  INTO v_subtotal
  FROM jsonb_array_elements(COALESCE(p_items_json, '{}'::jsonb) -> 'lines') AS line;

  -- Final calculation: subtotal + fees - discount
  v_result := v_subtotal + COALESCE(p_fee_total, 0) - COALESCE(p_discount_total, 0);

  RETURN v_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Grant execution to all roles that might use finance_invoices
GRANT EXECUTE ON FUNCTION calculate_invoice_value(JSONB, DECIMAL, DECIMAL) TO authenticated, anon, service_role;

-- 4. Add comment documenting the structure and usage
COMMENT ON COLUMN finance_invoices.items_json IS
  'JSONB structure: { "lines": [{ "product_id": int, "name": string, "quantity": numeric, "unit": string, "unit_price": numeric, "discount_amount": numeric, "vat_rate": numeric (0.0-1.0), "vat_amount": numeric, "line_total": numeric }, ...], "fees": [{ "type": string, "amount": numeric, "description": string }, ...] }';

COMMENT ON COLUMN finance_invoices.discount_total IS
  'Invoice-level total discount in VND. Use calculate_invoice_value() RPC to compute final total with this discount.';

COMMENT ON COLUMN finance_invoices.fee_total IS
  'Invoice-level fees (shipping, handling, etc.) in VND. Use calculate_invoice_value() RPC to compute final total with these fees.';
