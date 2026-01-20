-- Migration: 20260120_upgrade_sales_order_view_v7.sql
BEGIN;

    -- 1. TẠO HÀM TÍNH DOANH THU TREO (Đã sửa lại tên cột creator_id cho đúng Schema)
    CREATE OR REPLACE FUNCTION "public"."get_user_pending_revenue"("p_user_id" uuid) 
    RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
        v_total numeric;
    BEGIN
        SELECT COALESCE(SUM(final_amount), 0)
        INTO v_total
        FROM public.orders
        WHERE creator_id = p_user_id -- [CORE FIX]: Dùng đúng cột creator_id
          AND payment_method = 'cash' 
          AND remittance_status = 'pending' 
          AND status IN ('COMPLETED', 'DELIVERED', 'SHIPPING', 'PACKED', 'CONFIRMED');
          
        RETURN v_total;
    END;
    $$;

    -- 2. NÂNG CẤP HÀM LẤY DANH SÁCH ĐƠN HÀNG (Đáp ứng 6 yêu cầu lọc/tìm kiếm)
    -- Thêm các tham số: p_creator_id, p_payment_status, p_invoice_status
    
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
        
        -- [NEW PARAMS - YÊU CẦU CỦA SẾP]
        "p_creator_id" "uuid" DEFAULT NULL::"uuid",       -- Lọc theo nhân viên
        "p_payment_status" "text" DEFAULT NULL::"text",   -- Lọc theo trạng thái thanh toán
        "p_invoice_status" "text" DEFAULT NULL::"text"    -- Lọc theo trạng thái VAT
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
        -- A. TÍNH THỐNG KÊ (REAL-TIME STATS)
        SELECT jsonb_build_object(
            'total_sales', COALESCE(SUM(final_amount) FILTER (WHERE status NOT IN ('DRAFT', 'CANCELLED')), 0),
            'count_pending_remittance', COUNT(*) FILTER (WHERE remittance_status = 'pending' AND payment_method = 'cash'),
            'total_cash_pending', COALESCE(SUM(paid_amount) FILTER (WHERE remittance_status = 'pending' AND payment_method = 'cash'), 0)
        ) INTO v_stats
        FROM public.orders o
        WHERE 
            (p_order_type IS NULL OR o.order_type = p_order_type)
            AND (p_date_from IS NULL OR o.created_at >= p_date_from)
            AND (p_date_to IS NULL OR o.created_at <= p_date_to);

        -- B. TRUY VẤN DỮ LIỆU (MAIN QUERY)
        WITH filtered_data AS (
            SELECT 
                o.id,
                o.code,
                o.created_at,
                o.status,
                o.order_type,
                o.final_amount,
                o.paid_amount,
                o.payment_method,      -- 'cash', 'transfer', 'debt'
                o.remittance_status,   -- 'pending', 'confirming', 'deposited', 'skipped'
                o.payment_status,      -- [REQ 5]
                o.invoice_status,      -- [REQ 4]
                
                -- LOGIC TÊN KHÁCH HÀNG
                COALESCE(cb.name, cc.name, 'Khách lẻ') as customer_name,
                COALESCE(cb.phone, cc.phone) as customer_phone,
                
                -- [REQ 2] NHÂN VIÊN BÁN HÀNG
                COALESCE(u.full_name, u.email) as creator_name,
                o.creator_id
                
            FROM public.orders o
            LEFT JOIN public.customers_b2b cb ON o.customer_id = cb.id
            LEFT JOIN public.customers cc ON o.customer_b2c_id = cc.id
            LEFT JOIN public.users u ON o.creator_id = u.id
            WHERE 
                (p_order_type IS NULL OR o.order_type = p_order_type)
                AND (p_status IS NULL OR o.status = p_status)
                AND (p_remittance_status IS NULL OR o.remittance_status = p_remittance_status)
                AND (p_date_from IS NULL OR o.created_at >= p_date_from)
                AND (p_date_to IS NULL OR o.created_at <= p_date_to)
                
                -- [REQ 3] Lọc theo nhân viên
                AND (p_creator_id IS NULL OR o.creator_id = p_creator_id)
                
                -- [REQ 5] Lọc theo thanh toán
                AND (p_payment_status IS NULL OR o.payment_status = p_payment_status)
                
                -- [REQ 4] Lọc theo hóa đơn VAT (So sánh text với enum phải cast)
                AND (p_invoice_status IS NULL OR o.invoice_status::text = p_invoice_status)
                
                -- [REQ 1] TÌM KIẾM SIÊU CẤP (Mã, Tên KH, SĐT, Tên Sản Phẩm)
                AND (
                    p_search IS NULL OR p_search = '' 
                    OR o.code ILIKE '%' || p_search || '%'
                    OR cb.name ILIKE '%' || p_search || '%'
                    OR cc.name ILIKE '%' || p_search || '%'
                    OR cc.phone ILIKE '%' || p_search || '%'
                    -- Tìm sâu vào tên sản phẩm trong đơn hàng (Subquery Exists)
                    OR EXISTS (
                        SELECT 1 
                        FROM public.order_items oi
                        JOIN public.products p ON oi.product_id = p.id
                        WHERE oi.order_id = o.id 
                          AND (p.name ILIKE '%' || p_search || '%' OR p.sku ILIKE '%' || p_search || '%')
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