-- Fix PO Detail: trả thêm available_units (mảng từ product_units)
-- Trước đây dropdown UOM chỉ thấy wholesale_unit/retail_unit từ bảng products
-- → khi product_units có "Tub", "Lon"... user không chọn được, Save lại bị về "Hộp"
-- Date: 2026-04-23

BEGIN;

CREATE OR REPLACE FUNCTION public.get_purchase_order_detail(p_po_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_result JSONB;
BEGIN
    SELECT
        jsonb_build_object(
            'id', po.id,
            'code', po.code,
            'status', po.status,
            'delivery_status', po.delivery_status,
            'payment_status', po.payment_status,
            'expected_delivery_date', po.expected_delivery_date,
            'created_at', po.created_at,
            'note', po.note,
            'total_amount', po.total_amount,
            'final_amount', po.final_amount,
            'discount_amount', po.discount_amount,
            'delivery_method', po.delivery_method,
            'shipping_fee', po.shipping_fee,
            'shipping_partner_id', po.shipping_partner_id,
            'costing_confirmed_at', po.costing_confirmed_at,

            'supplier', jsonb_build_object(
                'id', s.id,
                'name', s.name,
                'phone', s.phone,
                'address', s.address,
                'tax_code', s.tax_code,
                'debt', 0
            ),

            'items', COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'key', poi.id,
                            'id', poi.id,
                            'quantity_ordered', poi.quantity_ordered,
                            'uom_ordered', poi.uom_ordered,
                            'unit_price', poi.unit_price,
                            'total_line', (poi.quantity_ordered * poi.unit_price),
                            'conversion_factor', poi.conversion_factor,
                            'base_quantity', poi.base_quantity,
                            'product_id', p.id,
                            'product_name', p.name,
                            'sku', p.sku,
                            'image_url', p.image_url,
                            'items_per_carton', p.items_per_carton,
                            'retail_unit', p.retail_unit,
                            'wholesale_unit', p.wholesale_unit,
                            -- [NEW] Mảng đơn vị thực tế từ product_units
                            -- Nếu product chưa có row product_units → fallback array rỗng
                            -- (frontend sẽ fall back sang wholesale_unit/retail_unit cũ).
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
                            )
                        )
                        ORDER BY poi.id ASC
                    )
                    FROM public.purchase_order_items poi
                    JOIN public.products p ON poi.product_id = p.id
                    WHERE poi.po_id = po.id
                ),
                '[]'::jsonb
            )
        )
    INTO v_result
    FROM public.purchase_orders po
    LEFT JOIN public.suppliers s ON po.supplier_id = s.id
    WHERE po.id = p_po_id;

    IF v_result IS NULL THEN RETURN NULL; END IF;
    RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_purchase_order_detail(bigint) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
