-- Migration: 20260121_upgrade_sales_order_view_v9_2_full_filters.sql
-- Description: Bổ sung bộ lọc Payment Method, Warehouse ID, Customer ID

BEGIN;

    DROP FUNCTION IF EXISTS "public"."get_sales_orders_view";

    CREATE OR REPLACE FUNCTION "public"."get_sales_orders_view"(
        "p_page" integer DEFAULT 1, 
        "p_page_size" integer DEFAULT 10, 
        "p_search" "text" DEFAULT NULL::"text", 
        "p_status" "text" DEFAULT NULL::"text", 
        "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, 
        "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, 
        "p_order_type" "text" DEFAULT NULL::"text", 
        "p_remittance_status" "text" DEFAULT NULL::"text",
        "p_creator_id" "uuid" DEFAULT NULL::"uuid", 
        "p_payment_status" "text" DEFAULT NULL::"text", 
        "p_invoice_status" "text" DEFAULT NULL::"text",
        
        -- [NEW FILTERS V9.2]
        "p_payment_method" "text" DEFAULT NULL::"text", -- Lọc HTTT (cash/transfer/debt)
        "p_warehouse_id" bigint DEFAULT NULL::bigint,   -- Lọc theo Kho
        "p_customer_id" bigint DEFAULT NULL::bigint     -- Lọc theo Khách (B2B hoặc B2C ID)
    ) 
    RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_offset INT := (p_page - 1) * p_page_size;
        v_result JSONB;
        v_stats JSONB;
    BEGIN
        -- A. STATS (Tính toán thống kê theo bộ lọc hiện tại để chính xác hơn)
        -- Lưu ý: Stats này tính trên TOÀN BỘ dữ liệu thỏa mãn filter (không bị paging)
        WITH stats_filter AS (
            SELECT final_amount, paid_amount, remittance_status, payment_method, status
            FROM public.orders o
            WHERE 
                (p_order_type IS NULL OR o.order_type = p_order_type)
                AND (p_status IS NULL OR o.status = p_status)
                AND (p_date_from IS NULL OR o.created_at >= p_date_from)
                AND (p_date_to IS NULL OR o.created_at <= p_date_to)
                AND (p_creator_id IS NULL OR o.creator_id = p_creator_id)
                AND (p_warehouse_id IS NULL OR o.warehouse_id = p_warehouse_id) -- Filter kho
        )
        SELECT jsonb_build_object(
            'total_sales', COALESCE(SUM(final_amount) FILTER (WHERE status NOT IN ('DRAFT', 'CANCELLED')), 0),
            'count_pending_remittance', COUNT(*) FILTER (WHERE remittance_status = 'pending' AND payment_method = 'cash'),
            'total_cash_pending', COALESCE(SUM(paid_amount) FILTER (WHERE remittance_status = 'pending' AND payment_method = 'cash'), 0)
        ) INTO v_stats
        FROM stats_filter;

        -- B. MAIN QUERY
        WITH filtered_data AS (
            SELECT 
                o.id, o.code, o.created_at, o.status, o.order_type,
                o.final_amount, o.paid_amount, o.payment_method, 
                o.remittance_status, o.payment_status, o.invoice_status,
                o.note,
                o.warehouse_id,
                
                COALESCE(w.name, 'Kho mặc định') as warehouse_name,
                
                -- Customer Info
                COALESCE(cb.name, cc.name, 'Khách lẻ') as customer_name,
                COALESCE(cb.phone, cc.phone) as customer_phone,
                COALESCE(cb.tax_code, cc.tax_code) as customer_tax_code,
                COALESCE(cb.email, cc.email) as customer_email,
                
                -- Creator Info
                COALESCE(u.full_name, u.email) as creator_name,
                o.creator_id,

                -- Invoice Info
                (SELECT to_jsonb(inv) FROM public.sales_invoices inv WHERE inv.order_id = o.id ORDER BY inv.created_at DESC LIMIT 1) as sales_invoice,

                -- Items Info
                (
                    SELECT jsonb_agg(jsonb_build_object(
                        'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 
                        'unit_price', oi.unit_price, 'uom', oi.uom, 'discount', oi.discount,
                        'product', jsonb_build_object('id', p.id, 'name', p.name, 'retail_unit', p.retail_unit, 'wholesale_unit', p.wholesale_unit)
                    ))
                    FROM public.order_items oi
                    JOIN public.products p ON oi.product_id = p.id
                    WHERE oi.order_id = o.id
                ) as order_items
                
            FROM public.orders o
            LEFT JOIN public.customers_b2b cb ON o.customer_id = cb.id
            LEFT JOIN public.customers cc ON o.customer_b2c_id = cc.id
            LEFT JOIN public.users u ON o.creator_id = u.id
            LEFT JOIN public.warehouses w ON o.warehouse_id = w.id
            WHERE 
                (p_order_type IS NULL OR o.order_type = p_order_type)
                AND (p_status IS NULL OR o.status = p_status)
                AND (p_remittance_status IS NULL OR o.remittance_status = p_remittance_status)
                AND (p_date_from IS NULL OR o.created_at >= p_date_from)
                AND (p_date_to IS NULL OR o.created_at <= p_date_to)
                AND (p_creator_id IS NULL OR o.creator_id = p_creator_id)
                AND (p_payment_status IS NULL OR o.payment_status = p_payment_status)
                AND (p_invoice_status IS NULL OR o.invoice_status::text = p_invoice_status)
                
                -- [NEW FILTERS V9.2]
                AND (p_payment_method IS NULL OR o.payment_method = p_payment_method)
                AND (p_warehouse_id IS NULL OR o.warehouse_id = p_warehouse_id)
                AND (p_customer_id IS NULL OR (o.customer_id = p_customer_id OR o.customer_b2c_id = p_customer_id))

                -- SEARCH
                AND (
                    p_search IS NULL OR p_search = '' 
                    OR o.code ILIKE '%' || p_search || '%'
                    OR cb.name ILIKE '%' || p_search || '%'
                    OR cc.name ILIKE '%' || p_search || '%'
                    OR cc.phone ILIKE '%' || p_search || '%'
                    OR EXISTS (
                        SELECT 1 FROM public.order_items oi_search
                        JOIN public.products prod ON oi_search.product_id = prod.id 
                        WHERE oi_search.order_id = o.id 
                          AND (prod.name ILIKE '%' || p_search || '%' OR prod.sku ILIKE '%' || p_search || '%')
                    )
                )
        ),
        paginated AS (
            SELECT * FROM filtered_data
            ORDER BY created_at DESC
            LIMIT p_page_size OFFSET v_offset
        )
        SELECT jsonb_build_object(
            'data', COALESCE(jsonb_agg(to_jsonb(t.*)), '[]'::jsonb),
            'total', (SELECT COUNT(*) FROM filtered_data),
            'stats', v_stats
        ) INTO v_result
        FROM paginated t;

        RETURN COALESCE(v_result, jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'stats', v_stats));
    END;
    $$;

COMMIT;