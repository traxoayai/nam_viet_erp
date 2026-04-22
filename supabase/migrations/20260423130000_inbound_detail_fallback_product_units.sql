-- Fix get_inbound_detail: fallback qua product_units (wholesale → base → first) khi
-- poi.uom_ordered IS NULL hoặc không match product_units.
-- Trước đây fallback về poi.unit (DEFAULT 'Hộp') → trang Nhập Kho vẫn load 'Hộp'
-- cho 744 PO items đang treo trên PROD (uom_ordered NULL do bug tạo PO cũ).
-- Date: 2026-04-23

BEGIN;

CREATE OR REPLACE FUNCTION public.get_inbound_detail(p_po_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_po_info JSONB;
    v_items JSONB;
BEGIN
    -- A. Header Info
    SELECT jsonb_build_object(
        'id', po.id,
        'code', po.code,
        'supplier_name', COALESCE(s.name, 'N/A'),
        'note', po.note,
        'status', po.delivery_status,
        'expected_date', po.expected_delivery_date,
        'expected_time', po.expected_delivery_time,
        'draft_data', COALESCE(po.receipt_draft, '[]'::jsonb),
        'logistics', jsonb_build_object(
            'total_packages', COALESCE(po.total_packages, 1),
            'carrier_name', COALESCE(po.carrier_name, 'Tự vận chuyển'),
            'carrier_contact', po.carrier_contact,
            'carrier_phone', po.carrier_phone
        )
    ) INTO v_po_info
    FROM public.purchase_orders po
    LEFT JOIN public.suppliers s ON po.supplier_id = s.id
    WHERE po.id = p_po_id;

    IF v_po_info IS NULL THEN RETURN NULL; END IF;

    -- B. Items List
    SELECT jsonb_agg(
        jsonb_build_object(
            'product_id', poi.product_id,
            'product_name', p.name,
            'sku', p.sku,
            'image_url', COALESCE(p.image_url, ''),
            -- [FIX] Ưu tiên uom_ordered → fallback product_units (wholesale → base
            -- → first) → final fallback poi.unit cũ cho legacy không có product_units.
            'unit', COALESCE(
                NULLIF(TRIM(poi.uom_ordered), ''),
                (SELECT pu.unit_name FROM public.product_units pu
                 WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale'
                 LIMIT 1),
                (SELECT pu.unit_name FROM public.product_units pu
                 WHERE pu.product_id = p.id AND pu.is_base = true
                 LIMIT 1),
                (SELECT pu.unit_name FROM public.product_units pu
                 WHERE pu.product_id = p.id
                 ORDER BY pu.id LIMIT 1),
                NULLIF(TRIM(poi.unit), ''),
                'Hộp'
            ),
            'available_units', COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', pu.id,
                            'unit_name', pu.unit_name,
                            'conversion_rate', pu.conversion_rate,
                            'unit_type', pu.unit_type,
                            'is_base', pu.is_base,
                            'price_sell', pu.price_sell
                        )
                        ORDER BY pu.is_base DESC, pu.conversion_rate ASC
                    )
                    FROM public.product_units pu
                    WHERE pu.product_id = p.id
                ),
                '[]'::jsonb
            ),
            'stock_management_type', p.stock_management_type,
            'quantity_ordered', poi.quantity_ordered,
            'quantity_received_prev', COALESCE(poi.quantity_received, 0),
            'quantity_remaining', GREATEST(0, poi.quantity_ordered - COALESCE(poi.quantity_received, 0)),
            'received_batches', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'lot_number', iri.lot_number,
                    'expiry_date', iri.expiry_date,
                    'quantity', FLOOR(iri.quantity::NUMERIC / GREATEST(COALESCE(poi.conversion_factor, 1), 1))::INTEGER
                ))
                FROM public.inventory_receipts ir
                JOIN public.inventory_receipt_items iri ON ir.id = iri.receipt_id
                WHERE ir.po_id = p_po_id AND iri.product_id = poi.product_id
            ), '[]'::jsonb)
        )
    ) INTO v_items
    FROM public.purchase_order_items poi
    JOIN public.products p ON poi.product_id = p.id
    WHERE poi.po_id = p_po_id;

    RETURN jsonb_build_object(
        'po_info', v_po_info,
        'items', COALESCE(v_items, '[]'::jsonb)
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_inbound_detail(bigint) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
