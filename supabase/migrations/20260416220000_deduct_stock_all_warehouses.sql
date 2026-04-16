-- Fix: _deduct_stock_fefo trừ tồn toàn hệ thống (không filter warehouse)
-- Lý do: Chỉ có 1 kho thực tế, nhưng Portal chọn warehouse_id có thể khác kho chứa hàng
-- Giữ nguyên p_warehouse_id param (dùng cho inventory_transactions log)
-- Date: 2026-04-16

BEGIN;

CREATE OR REPLACE FUNCTION public._deduct_stock_fefo(
  p_warehouse_id BIGINT,
  p_product_id BIGINT,
  p_base_quantity NUMERIC,
  p_unit_price NUMERIC,
  p_order_code TEXT,
  p_partner_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
  v_remaining NUMERIC := p_base_quantity;
  v_deduct NUMERIC;
  v_batch RECORD;
BEGIN
  FOR v_batch IN
    SELECT ib.id, ib.warehouse_id, ib.quantity, ib.batch_id, b.batch_code
    FROM public.inventory_batches ib
    JOIN public.batches b ON ib.batch_id = b.id
    WHERE ib.product_id = p_product_id
      AND ib.quantity > 0
    ORDER BY b.expiry_date ASC, ib.id ASC
  LOOP
    IF v_remaining <= 0 THEN EXIT; END IF;
    v_deduct := LEAST(v_batch.quantity, v_remaining);

    UPDATE public.inventory_batches
    SET quantity = quantity - v_deduct, updated_at = NOW()
    WHERE id = v_batch.id;

    INSERT INTO public.inventory_transactions (
      warehouse_id, product_id, batch_id, partner_id,
      type, action_group, quantity, unit_price,
      ref_id, description, created_by, created_at
    ) VALUES (
      v_batch.warehouse_id, p_product_id, v_batch.batch_id, NULLIF(p_partner_id, '')::BIGINT,
      'out', 'sale', (v_deduct * -1), p_unit_price,
      p_order_code, 'Xuất bán (Lô: ' || v_batch.batch_code || ')',
      auth.uid(), NOW()
    );
    v_remaining := v_remaining - v_deduct;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Không đủ tồn kho cho SP #% sau khi trừ FEFO. Còn thiếu: %',
      p_product_id, v_remaining;
  END IF;
END;
$fn$;

COMMIT;
