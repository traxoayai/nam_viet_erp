drop function if exists "public"."get_purchase_orders_master"(p_page integer, p_page_size integer, p_search text, p_status_delivery text, p_status_payment text, p_date_from timestamp with time zone, p_date_to timestamp with time zone);

alter table "public"."purchase_order_items" add column "base_quantity" integer;

alter table "public"."purchase_order_items" add column "conversion_factor" integer default 1;

alter table "public"."purchase_order_items" add column "uom_ordered" text;

alter table "public"."purchase_orders" add column "status" text default 'DRAFT'::text;

alter table "public"."purchase_order_items" add constraint "check_conversion_factor_positive" CHECK ((conversion_factor > 0)) not valid;

alter table "public"."purchase_order_items" validate constraint "check_conversion_factor_positive";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_draft_po(p_supplier_id bigint, p_expected_date timestamp with time zone, p_note text, p_items jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_po_id BIGINT;
    v_item JSONB;
    v_product_record RECORD;
    v_conversion_factor INTEGER;
    v_base_quantity INTEGER;
    v_total_amount NUMERIC := 0;
    v_items_per_carton_db INTEGER;
    v_wholesale_unit_db TEXT;
BEGIN
    -- 1. Tạo Header PO (Trạng thái DRAFT)
    INSERT INTO public.purchase_orders (
        code,
        supplier_id,
        creator_id,
        status,             -- Mới: DRAFT
        delivery_status,    -- Mặc định: pending
        payment_status,     -- Mặc định: unpaid
        expected_delivery_date,
        note,
        total_amount,
        final_amount
    )
    VALUES (
        'PO-' || to_char(now(), 'YYMMDD') || '-' || floor(random() * 10000)::text,
        p_supplier_id,
        auth.uid(),
        'DRAFT',
        'pending',
        'unpaid',
        p_expected_date,
        p_note,
        0, -- Sẽ cập nhật sau
        0
    )
    RETURNING id INTO v_po_id;

    -- 2. Duyệt qua từng sản phẩm để xử lý logic quy đổi
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- a. Lấy thông tin quy cách từ bảng Products (Snapshot dữ liệu gốc)
        SELECT 
            items_per_carton, 
            wholesale_unit, -- Đơn vị sỉ (Ví dụ: Thùng)
            retail_unit     -- Đơn vị lẻ (Ví dụ: Hộp)
        INTO v_product_record
        FROM public.products
        WHERE id = (v_item->>'product_id')::BIGINT;

        -- b. Xác định Hệ số quy đổi (Conversion Factor)
        -- Logic:
        -- Nếu đơn vị đặt hàng khớp với Đơn vị sỉ (Thùng) -> Lấy items_per_carton
        -- Các trường hợp còn lại (Lẻ, hoặc khác) -> Lấy 1
        
        v_items_per_carton_db := COALESCE(v_product_record.items_per_carton, 1);
        v_wholesale_unit_db := v_product_record.wholesale_unit;

        IF (v_item->>'uom_ordered') = v_wholesale_unit_db THEN
            v_conversion_factor := v_items_per_carton_db;
        ELSE
            v_conversion_factor := 1;
        END IF;

        -- c. Tính Base Quantity (Số lượng cơ sở)
        v_base_quantity := (v_item->>'quantity_ordered')::INTEGER * v_conversion_factor;

        -- d. Insert vào dòng chi tiết
        INSERT INTO public.purchase_order_items (
            po_id,
            product_id,
            quantity_ordered,
            uom_ordered,
            unit, -- Giữ tương thích ngược với code cũ nếu cần
            unit_price,
            conversion_factor, -- Cột mới: Lưu cứng quy cách lúc mua
            base_quantity      -- Cột mới: Số lượng thực nhập kho
        )
        VALUES (
            v_po_id,
            (v_item->>'product_id')::BIGINT,
            (v_item->>'quantity_ordered')::INTEGER,
            v_item->>'uom_ordered',
            v_item->>'uom_ordered', -- Map tạm vào cột unit cũ
            (v_item->>'unit_price')::NUMERIC,
            v_conversion_factor,
            v_base_quantity
        );

        -- e. Cộng dồn tổng tiền
        v_total_amount := v_total_amount + ((v_item->>'quantity_ordered')::INTEGER * (v_item->>'unit_price')::NUMERIC);
    END LOOP;

    -- 3. Cập nhật lại tổng tiền cho Header
    UPDATE public.purchase_orders
    SET total_amount = v_total_amount, final_amount = v_total_amount
    WHERE id = v_po_id;

    RETURN v_po_id;
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
            -- 1. THÔNG TIN CHUNG (HEADER)
            'id', po.id,
            'code', po.code,
            'status', po.status,               -- Trạng thái quy trình (DRAFT, APPROVED...)
            'delivery_status', po.delivery_status, -- Trạng thái giao hàng
            'payment_status', po.payment_status,   -- Trạng thái thanh toán
            'expected_delivery_date', po.expected_delivery_date,
            'created_at', po.created_at,
            'note', po.note,
            'total_amount', po.total_amount,
            'final_amount', po.final_amount,
            'discount_amount', po.discount_amount,

            -- 2. THÔNG TIN NHÀ CUNG CẤP (SUPPLIER)
            'supplier', jsonb_build_object(
                'id', s.id,
                'name', s.name,
                'phone', s.phone,
                'address', s.address,
                'tax_code', s.tax_code,
                -- Tính công nợ tạm thời = 0 (Sẽ cập nhật khi có module Tài chính)
                'debt', 0 
            ),

            -- 3. DANH SÁCH HÀNG HÓA (ITEMS ARRAY)
            'items', COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            -- Thông tin dòng mua hàng
                            'key', poi.id, -- Dùng làm key cho React list
                            'id', poi.id,
                            'quantity_ordered', poi.quantity_ordered,
                            'uom_ordered', poi.uom_ordered,
                            'unit_price', poi.unit_price,
                            'total_line', (poi.quantity_ordered * poi.unit_price),
                            'conversion_factor', poi.conversion_factor, -- Hệ số quy đổi lúc mua
                            'base_quantity', poi.base_quantity,         -- Số lượng thực nhập (đơn vị lẻ)

                            -- Thông tin sản phẩm (Lookup từ bảng Products)
                            'product_id', p.id,
                            'product_name', p.name,
                            'sku', p.sku,
                            'image_url', p.image_url,
                            'items_per_carton', p.items_per_carton, -- Quy cách hiện tại
                            'retail_unit', p.retail_unit,
                            'wholesale_unit', p.wholesale_unit
                        ) 
                        ORDER BY poi.id ASC
                    )
                    FROM public.purchase_order_items poi
                    JOIN public.products p ON poi.product_id = p.id
                    WHERE poi.po_id = po.id
                ),
                '[]'::jsonb -- Trả về mảng rỗng nếu không có item nào
            )
        )
    INTO v_result
    FROM public.purchase_orders po
    LEFT JOIN public.suppliers s ON po.supplier_id = s.id
    WHERE po.id = p_po_id;

    -- Trả về null nếu không tìm thấy đơn hàng
    IF v_result IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_supplier_quick_info(p_supplier_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_supplier RECORD;
    v_current_debt NUMERIC := 0;
BEGIN
    -- 1. Lấy thông tin tĩnh từ bảng suppliers
    SELECT id, name, contact_person, phone, address, lead_time
    INTO v_supplier
    FROM public.suppliers
    WHERE id = p_supplier_id;

    IF v_supplier IS NULL THEN
        RETURN NULL;
    END IF;

    -- 2. Tính công nợ hiện tại (Real-time calculation)
    -- Công thức: Tổng tiền các đơn hàng (Final Amount) - Tổng tiền đã thanh toán (Total Paid)
    -- Chỉ tính các đơn có trạng thái thanh toán chưa hoàn tất (unpaid, partial) và không bị hủy
    SELECT COALESCE(SUM(final_amount - total_paid), 0)
    INTO v_current_debt
    FROM public.purchase_orders
    WHERE supplier_id = p_supplier_id
      AND status <> 'CANCELLED'
      AND payment_status IN ('unpaid', 'partial');

    -- 3. Trả về JSON đầy đủ
    RETURN jsonb_build_object(
        'id', v_supplier.id,
        'name', v_supplier.name,
        'contact_person', COALESCE(v_supplier.contact_person, 'Chưa cập nhật'),
        'phone', COALESCE(v_supplier.phone, ''),
        'address', v_supplier.address,
        'lead_time', COALESCE(v_supplier.lead_time, 0), -- Số ngày giao hàng dự kiến
        'current_debt', v_current_debt
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.search_products_for_purchase(p_keyword text)
 RETURNS TABLE(id bigint, name text, sku text, barcode text, image_url text, wholesale_unit text, retail_unit text, items_per_carton integer, actual_cost numeric, latest_purchase_price numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.sku,
        p.barcode,
        p.image_url,
        COALESCE(p.wholesale_unit, 'Hộp') AS wholesale_unit,
        COALESCE(p.retail_unit, 'Vỉ') AS retail_unit,
        COALESCE(p.items_per_carton, 1) AS items_per_carton,
        COALESCE(p.actual_cost, 0) AS actual_cost,
        
        -- LOGIC LẤY GIÁ NHẬP GẦN NHẤT (Subquery tối ưu)
        COALESCE(
            (
                SELECT poi.unit_price
                FROM public.purchase_order_items poi
                JOIN public.purchase_orders po ON poi.po_id = po.id
                WHERE poi.product_id = p.id
                -- Chỉ tính các đơn chưa bị hủy
                AND po.status <> 'CANCELLED'
                ORDER BY po.created_at DESC
                LIMIT 1
            ),
            0 
        ) AS latest_purchase_price

    FROM
        public.products p
    WHERE
        p.status = 'active' -- Chỉ lấy hàng đang kinh doanh
        AND (
            p_keyword IS NULL 
            OR p_keyword = '' 
            OR p.name ILIKE '%' || p_keyword || '%' 
            OR p.sku ILIKE '%' || p_keyword || '%'
            OR p.barcode ILIKE '%' || p_keyword || '%' -- Tìm theo Barcode
        )
    ORDER BY
        p.created_at DESC
    LIMIT 20; 
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_purchase_orders_master(p_page integer DEFAULT 1, p_page_size integer DEFAULT 10, p_search text DEFAULT NULL::text, p_status_delivery text DEFAULT NULL::text, p_status_payment text DEFAULT NULL::text, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(id bigint, code text, supplier_id bigint, supplier_name text, delivery_method text, delivery_status text, payment_status text, status text, final_amount numeric, total_quantity bigint, total_cartons numeric, total_paid numeric, expected_delivery_date timestamp with time zone, created_at timestamp with time zone, progress_delivery numeric, progress_payment numeric, full_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH po_metrics AS (
        SELECT 
            po.id,
            -- Tính % Hàng về
            COALESCE(ROUND((SUM(poi.quantity_received)::NUMERIC / NULLIF(SUM(poi.quantity_ordered), 0)) * 100, 2), 0) AS calc_delivery_progress,
            
            -- Tính Tổng số lượng lẻ
            COALESCE(SUM(poi.quantity_ordered), 0) as total_qty,

            -- TÍNH TỔNG SỐ THÙNG (Logic Logistics V2)
            ROUND(
                SUM(
                    poi.quantity_ordered::NUMERIC / 
                    COALESCE(NULLIF(poi.conversion_factor, 0), 1) 
                ), 
                1 
            ) AS calc_total_cartons
        FROM public.purchase_orders po
        LEFT JOIN public.purchase_order_items poi ON po.id = poi.po_id
        GROUP BY po.id
    )
    SELECT 
        po.id, 
        po.code, 
        po.supplier_id, 
        s.name as supplier_name,
        COALESCE(po.delivery_method, s.delivery_method, 'Unknown') as delivery_method,
        po.delivery_status, 
        po.payment_status,
        COALESCE(po.status, 'DRAFT') as status, -- Trả về status quy trình
        po.final_amount, -- Đã có sẵn trong bảng purchase_orders
        pm.total_qty as total_quantity,
        pm.calc_total_cartons as total_cartons,
        po.total_paid, 
        po.expected_delivery_date, 
        po.created_at,
        pm.calc_delivery_progress AS progress_delivery,
        COALESCE(ROUND((po.total_paid / NULLIF(po.final_amount, 0)) * 100, 2), 0) AS progress_payment,
        COUNT(*) OVER() AS full_count
    FROM public.purchase_orders po
    JOIN po_metrics pm ON po.id = pm.id
    LEFT JOIN public.suppliers s ON po.supplier_id = s.id
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


