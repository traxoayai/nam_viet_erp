-- Migration: get_outbound_order_detail đọc orders.warehouse_id thật
-- Mục đích: Đồng bộ UI hiển thị FEFO/shelf với kho thực tế của đơn
-- Bỏ hardcode v_warehouse_id := 1 (comment "V1 tạm thời")
-- Date: 2026-04-17

BEGIN;

CREATE OR REPLACE FUNCTION public.get_outbound_order_detail(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_info JSONB;
  v_items JSONB;
  v_warehouse_id BIGINT;
BEGIN
  -- [CHANGED] Đọc warehouse_id thật từ orders, KHÔNG hardcode
  SELECT warehouse_id INTO v_warehouse_id
  FROM public.orders
  WHERE id = p_order_id;

  -- A. Header + shipping
  SELECT jsonb_build_object(
    'id', o.id,
    'code', o.code,
    'customer_name', COALESCE(c.name, 'Khách lẻ'),
    'delivery_address', o.delivery_address,
    'note', o.note,
    'status', o.status,
    'shipping_partner', COALESCE(sp.name, 'Tự vận chuyển'),
    'shipping_phone', sp.phone,
    'final_amount', COALESCE(o.final_amount, 0),
    'paid_amount', COALESCE(o.paid_amount, 0),
    'customer_phone', c.phone,
    'cutoff_time', TO_CHAR(sp.cut_off_time, 'HH24:MI')
  ) INTO v_order_info
  FROM public.orders o
  LEFT JOIN public.customers_b2b c ON o.customer_id = c.id
  LEFT JOIN public.shipping_partners sp ON o.shipping_partner_id = sp.id
  WHERE o.id = p_order_id;

  IF v_order_info IS NULL THEN RETURN NULL; END IF;

  -- B. Items + FEFO suggestion (dùng v_warehouse_id từ orders)
  SELECT jsonb_agg(
    jsonb_build_object(
      'product_id', oi.product_id,
      'product_name', p.name,
      'sku', p.sku,
      'barcode', p.barcode,
      'unit', COALESCE(oi.uom, p.wholesale_unit, 'Hộp'),
      'quantity_ordered', oi.quantity,
      'quantity_picked', COALESCE(oi.quantity_picked, 0),
      'image_url', COALESCE(p.image_url, ''),
      'shelf_location', COALESCE((
        SELECT pi.shelf_location
        FROM public.product_inventory pi
        WHERE pi.product_id = p.id AND pi.warehouse_id = v_warehouse_id
        LIMIT 1
      ), 'Chưa xếp'),
      'fefo_suggestion', (
        SELECT jsonb_build_object(
          'batch_code', b.batch_code,
          'expiry_date', b.expiry_date,
          'quantity_available', ib.quantity
        )
        FROM public.inventory_batches ib
        JOIN public.batches b ON ib.batch_id = b.id
        WHERE ib.product_id = p.id
          AND ib.warehouse_id = v_warehouse_id
          AND ib.quantity > 0
          AND b.expiry_date >= CURRENT_DATE
        ORDER BY b.expiry_date ASC
        LIMIT 1
      )
    )
  ) INTO v_items
  FROM public.order_items oi
  JOIN public.products p ON oi.product_id = p.id
  WHERE oi.order_id = p_order_id;

  RETURN jsonb_build_object(
    'order_info', v_order_info,
    'items', COALESCE(v_items, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.get_outbound_order_detail(UUID) IS
  'V5 (2026-04-17): Đọc warehouse_id thật từ orders (không hardcode). Đồng bộ với confirm_outbound_packing.';

NOTIFY pgrst, 'reload schema';

COMMIT;
