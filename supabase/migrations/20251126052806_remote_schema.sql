drop function if exists "public"."get_purchase_orders_master"(p_page integer, p_page_size integer, p_search text, p_status_delivery text, p_status_payment text, p_date_from timestamp with time zone, p_date_to timestamp with time zone);

alter table "public"."purchase_orders" add column "shipping_fee" numeric default 0;

alter table "public"."purchase_orders" add column "shipping_partner_id" bigint;

alter table "public"."purchase_orders" add constraint "purchase_orders_shipping_partner_id_fkey" FOREIGN KEY (shipping_partner_id) REFERENCES public.shipping_partners(id) not valid;

alter table "public"."purchase_orders" validate constraint "purchase_orders_shipping_partner_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.confirm_purchase_order(p_po_id bigint, p_status text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE public.purchase_orders
    SET 
        status = p_status,
        updated_at = NOW()
    WHERE id = p_po_id;
    
    RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_purchase_order(p_po_id bigint, p_supplier_id bigint, p_expected_date timestamp with time zone, p_note text, p_items jsonb, p_delivery_method text DEFAULT 'internal'::text, p_shipping_partner_id bigint DEFAULT NULL::bigint, p_shipping_fee numeric DEFAULT 0, p_status text DEFAULT 'DRAFT'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_item JSONB;
    v_product_record RECORD;
    v_conversion_factor INTEGER;
    v_base_quantity INTEGER;
    v_total_amount NUMERIC := 0;
    v_current_status TEXT;
BEGIN
    SELECT status INTO v_current_status FROM public.purchase_orders WHERE id = p_po_id;
    
    IF v_current_status NOT IN ('DRAFT', 'PENDING', 'REJECTED') THEN
        RAISE EXCEPTION 'Không thể sửa đơn hàng đã được Duyệt hoặc Đang nhập kho.';
    END IF;

    UPDATE public.purchase_orders
    SET
        supplier_id = p_supplier_id,
        expected_delivery_date = p_expected_date,
        note = p_note,
        delivery_method = p_delivery_method,
        shipping_partner_id = p_shipping_partner_id,
        shipping_fee = COALESCE(p_shipping_fee, 0),
        status = p_status,
        updated_at = NOW()
    WHERE id = p_po_id;

    DELETE FROM public.purchase_order_items WHERE po_id = p_po_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT items_per_carton, wholesale_unit 
        INTO v_product_record
        FROM public.products
        WHERE id = (v_item->>'product_id')::BIGINT;

        IF (v_item->>'uom') = v_product_record.wholesale_unit THEN
            v_conversion_factor := COALESCE(v_product_record.items_per_carton, 1);
        ELSE
            v_conversion_factor := 1;
        END IF;

        v_base_quantity := (v_item->>'quantity')::INTEGER * v_conversion_factor;

        INSERT INTO public.purchase_order_items (
            po_id,
            product_id,
            quantity_ordered,
            uom_ordered,
            unit_price,
            conversion_factor,
            base_quantity
        )
        VALUES (
            p_po_id,
            (v_item->>'product_id')::BIGINT,
            (v_item->>'quantity')::INTEGER,
            v_item->>'uom',
            (v_item->>'unit_price')::NUMERIC,
            v_conversion_factor,
            v_base_quantity
        );

        v_total_amount := v_total_amount + ((v_item->>'quantity')::INTEGER * (v_item->>'unit_price')::NUMERIC);
    END LOOP;

    UPDATE public.purchase_orders
    SET 
        total_amount = v_total_amount,
        final_amount = v_total_amount + COALESCE(p_shipping_fee, 0) - COALESCE(discount_amount, 0)
    WHERE id = p_po_id;

    RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_purchase_order_detail(p_po_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
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
            'delivery_method', po.delivery_method,         -- Thêm
            'shipping_fee', po.shipping_fee,               -- Thêm
            'shipping_partner_id', po.shipping_partner_id, -- Thêm

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
                            'wholesale_unit', p.wholesale_unit
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_purchase_orders_master(p_page integer DEFAULT 1, p_page_size integer DEFAULT 10, p_search text DEFAULT NULL::text, p_status_delivery text DEFAULT NULL::text, p_status_payment text DEFAULT NULL::text, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(id bigint, code text, supplier_id bigint, supplier_name text, delivery_method text, shipping_partner_name text, delivery_status text, payment_status text, status text, final_amount numeric, total_quantity bigint, total_cartons numeric, expected_delivery_date timestamp with time zone, created_at timestamp with time zone, full_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH po_metrics AS (
        SELECT 
            po.id,
            COALESCE(SUM(poi.quantity_ordered), 0) as total_qty,
            ROUND(SUM(poi.quantity_ordered::NUMERIC / COALESCE(NULLIF(poi.conversion_factor, 0), 1)), 1) AS calc_total_cartons
        FROM public.purchase_orders po
        LEFT JOIN public.purchase_order_items poi ON po.id = poi.po_id
        GROUP BY po.id
    )
    SELECT 
        po.id, 
        po.code, 
        po.supplier_id, 
        s.name as supplier_name,
        po.delivery_method,
        sp.name as shipping_partner_name,
        po.delivery_status, 
        po.payment_status,
        po.status,
        po.final_amount, 
        pm.total_qty,
        pm.calc_total_cartons,
        po.expected_delivery_date, 
        po.created_at,
        COUNT(*) OVER() AS full_count
    FROM public.purchase_orders po
    JOIN po_metrics pm ON po.id = pm.id
    LEFT JOIN public.suppliers s ON po.supplier_id = s.id
    LEFT JOIN public.shipping_partners sp ON po.shipping_partner_id = sp.id
    WHERE 
        (p_status_delivery IS NULL OR po.delivery_status = p_status_delivery)
        AND (p_status_payment IS NULL OR po.payment_status = p_status_payment)
        AND (p_search IS NULL OR po.code ILIKE '%' || p_search || '%')
        AND (p_date_from IS NULL OR po.created_at >= p_date_from)
        AND (p_date_to IS NULL OR po.created_at <= p_date_to)
    ORDER BY po.created_at DESC
    LIMIT p_page_size OFFSET (p_page - 1) * p_page_size;
END;
$function$
;


