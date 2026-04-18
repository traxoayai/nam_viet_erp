-- Migration: process_inbound_receipt fail-fast khi unit không khớp product_units
-- ============================================================================
-- BUG: Khi FE truyền unit_name không tồn tại trong product_units (ví dụ 'Lọ'
--      nhưng product chỉ có 'Chai'), BE silent fallback conversion_rate=1
--      → cộng kho thô (vd 40 thay vì 40×400=16000) → kho bị thiếu nghiêm trọng.
-- FIX: RAISE EXCEPTION nếu không tìm thấy unit cho product_id.
--      Base unit (is_base=true) vẫn được accept bình thường vì rate=1.
-- Giữ nguyên TOÀN BỘ logic khác.
-- Date: 2026-04-18
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.process_inbound_receipt(
  p_po_id BIGINT,
  p_warehouse_id BIGINT,
  p_items JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_receipt_id BIGINT;
  v_item JSONB;
  v_product_id BIGINT;
  v_qty_input NUMERIC;
  v_qty_base INTEGER;
  v_conversion_rate INTEGER;
  v_unit_name TEXT;
  v_unit_price NUMERIC;
  v_product_name TEXT;
  v_available_units TEXT;

  v_lot_no TEXT;
  v_exp_date DATE;
  v_batch_id BIGINT;
  v_po_code TEXT;
  v_po_supplier_id BIGINT;

  v_total_ordered NUMERIC;
  v_total_received NUMERIC;
  v_new_status TEXT;
BEGIN
  SELECT code, supplier_id INTO v_po_code, v_po_supplier_id
  FROM public.purchase_orders WHERE id = p_po_id;

  INSERT INTO public.inventory_receipts (
    code, po_id, warehouse_id, receipt_date, status, creator_id, created_at
  ) VALUES (
    'PNK-' || to_char(now(), 'YYMMDD') || '-' || floor(random() * 10000)::text,
    p_po_id, p_warehouse_id, now(), 'completed', auth.uid(), now()
  ) RETURNING id INTO v_receipt_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::BIGINT;
    v_qty_input  := COALESCE((v_item->>'quantity')::NUMERIC, 0);
    v_unit_name  := v_item->>'unit';
    v_lot_no     := NULLIF(trim(v_item->>'lot_number'), '');
    v_exp_date   := (v_item->>'expiry_date')::DATE;
    v_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, 0);

    IF v_qty_input <= 0 THEN CONTINUE; END IF;

    -- [FIXED] Lookup conversion_rate — nếu không khớp → fail-fast với error rõ ràng
    SELECT conversion_rate INTO v_conversion_rate
    FROM public.product_units
    WHERE product_id = v_product_id AND unit_name = v_unit_name
    LIMIT 1;

    IF v_conversion_rate IS NULL THEN
      -- Gom tên các unit hợp lệ để hiển thị cho user
      SELECT string_agg(unit_name, ', ' ORDER BY is_base DESC, conversion_rate ASC),
             COALESCE(name, 'SP #' || v_product_id)
      INTO v_available_units, v_product_name
      FROM public.product_units pu
      LEFT JOIN public.products p ON p.id = pu.product_id
      WHERE pu.product_id = v_product_id
      GROUP BY p.name;

      RAISE EXCEPTION
        'Đơn vị "%" không hợp lệ cho sản phẩm "%". Đơn vị hợp lệ: %. Vui lòng cập nhật cấu hình product_units trước khi nhập kho.',
        COALESCE(v_unit_name, '(trống)'),
        COALESCE(v_product_name, 'SP #' || v_product_id),
        COALESCE(v_available_units, '(chưa cấu hình)');
    END IF;

    v_qty_base := (v_qty_input * v_conversion_rate)::INTEGER;

    IF v_lot_no IS NULL THEN v_lot_no := 'DEFAULT-' || to_char(now(), 'YYYYMMDD'); END IF;

    SELECT id INTO v_batch_id FROM public.batches
    WHERE product_id = v_product_id AND batch_code = v_lot_no;

    IF v_batch_id IS NULL THEN
      INSERT INTO public.batches (product_id, batch_code, expiry_date, inbound_price, created_at)
      VALUES (v_product_id, v_lot_no, COALESCE(v_exp_date, '2099-12-31'::DATE), (v_unit_price / v_conversion_rate), NOW())
      RETURNING id INTO v_batch_id;
    ELSE
      UPDATE public.batches SET inbound_price = (v_unit_price / v_conversion_rate) WHERE id = v_batch_id;
    END IF;

    INSERT INTO public.inventory_batches (warehouse_id, product_id, batch_id, quantity)
    VALUES (p_warehouse_id, v_product_id, v_batch_id, v_qty_base)
    ON CONFLICT (warehouse_id, product_id, batch_id)
    DO UPDATE SET quantity = inventory_batches.quantity + EXCLUDED.quantity, updated_at = now();

    INSERT INTO public.inventory_transactions (
      warehouse_id, product_id, batch_id, type, action_group, quantity, unit_price, ref_id, description, partner_id, created_by
    ) VALUES (
      p_warehouse_id, v_product_id, v_batch_id, 'purchase_order', 'IMPORT',
      v_qty_base, (v_unit_price / v_conversion_rate),
      v_po_code, 'Nhập kho PO', v_po_supplier_id, auth.uid()
    );

    INSERT INTO public.inventory_receipt_items (
      receipt_id, product_id, quantity, lot_number, expiry_date, unit_price
    ) VALUES (
      v_receipt_id, v_product_id, v_qty_base, v_lot_no, v_exp_date, (v_unit_price / v_conversion_rate)
    );

    UPDATE public.purchase_order_items
    SET quantity_received = COALESCE(quantity_received, 0) + v_qty_input
    WHERE po_id = p_po_id AND product_id = v_product_id;

  END LOOP;

  SELECT SUM(quantity_ordered), SUM(COALESCE(quantity_received, 0))
  INTO v_total_ordered, v_total_received
  FROM public.purchase_order_items WHERE po_id = p_po_id;

  IF v_total_received >= v_total_ordered THEN v_new_status := 'delivered';
  ELSIF v_total_received > 0 THEN v_new_status := 'partial';
  ELSE v_new_status := 'pending'; END IF;

  UPDATE public.purchase_orders SET delivery_status = v_new_status, updated_at = now() WHERE id = p_po_id;

  RETURN jsonb_build_object('success', true, 'receipt_id', v_receipt_id);
END;
$$;

COMMIT;
