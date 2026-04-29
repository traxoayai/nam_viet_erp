-- Migration: get_outbound_order_detail SORT items theo shelf_location ASC
-- Mục đích: Phiếu nhặt hàng + UI đóng hàng theo đúng đường kệ kho xuất
-- Diff so V5 (20260417120000): chỉ thêm ORDER BY shelf_location ở subquery items.
-- Logic FEFO + filter warehouse_id giữ nguyên 100%.
-- Date: 2026-04-29

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
  -- Đọc warehouse_id thật từ orders
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

  -- B. Items + FEFO suggestion (sort theo shelf_location ASC để đi đúng đường kệ)
  SELECT jsonb_agg(item_obj ORDER BY shelf_loc ASC NULLS LAST, oi_id ASC)
  INTO v_items
  FROM (
    SELECT
      oi.id AS oi_id,
      COALESCE((
        SELECT pi.shelf_location
        FROM public.product_inventory pi
        WHERE pi.product_id = p.id AND pi.warehouse_id = v_warehouse_id
        LIMIT 1
      ), 'Chưa xếp') AS shelf_loc,
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
      ) AS item_obj
    FROM public.order_items oi
    JOIN public.products p ON oi.product_id = p.id
    WHERE oi.order_id = p_order_id
  ) sorted;

  RETURN jsonb_build_object(
    'order_info', v_order_info,
    'items', COALESCE(v_items, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.get_outbound_order_detail(UUID) IS
  'V6 (2026-04-29): Sort items theo shelf_location ASC. Giữ V5 logic FEFO + filter warehouse_id.';

NOTIFY pgrst, 'reload schema';

COMMIT;
