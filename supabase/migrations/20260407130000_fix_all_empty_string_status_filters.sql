-- Fix: Tất cả RPC functions bị trả rỗng khi text filter = '' (empty string)
-- Root cause: WHERE check IS NULL nhưng thiếu check = ''
-- Pattern: (p_param IS NULL OR column = p_param) → (p_param IS NULL OR p_param = '' OR column = p_param)
-- Functions: get_po_logistics_stats, get_b2b_orders_view, get_vaccination_templates, get_prescription_templates

-- === 1. get_po_logistics_stats ===
-- GIỮ NGUYÊN: SECURITY DEFINER, search_path, GROUP BY, ORDER BY, toàn bộ SELECT logic
-- SỬA: thêm OR p_status_delivery = '' và OR p_status_payment = ''

CREATE OR REPLACE FUNCTION "public"."get_po_logistics_stats"("p_search" "text" DEFAULT NULL::"text", "p_status_delivery" "text" DEFAULT NULL::"text", "p_status_payment" "text" DEFAULT NULL::"text", "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("method" "text", "total_cartons" bigint, "order_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    BEGIN
        RETURN QUERY
        SELECT
            COALESCE(po.delivery_method, 'other') AS method,
            COALESCE(SUM(po.total_packages), 0)::BIGINT AS total_cartons,
            COUNT(po.id)::BIGINT AS order_count
        FROM public.purchase_orders po
        LEFT JOIN public.suppliers s ON po.supplier_id = s.id
        WHERE
            (p_status_delivery IS NULL OR p_status_delivery = '' OR po.delivery_status = p_status_delivery)
            AND (p_status_payment IS NULL OR p_status_payment = '' OR po.payment_status = p_status_payment)
            AND (p_date_from IS NULL OR po.created_at >= p_date_from)
            AND (p_date_to IS NULL OR po.created_at <= p_date_to)
            AND (
                p_search IS NULL OR p_search = ''
                OR po.code ILIKE ('%' || p_search || '%')
                OR s.name ILIKE ('%' || p_search || '%')
            )
        GROUP BY po.delivery_method
        ORDER BY total_cartons DESC;
    END;
    $$;


-- === 2. get_b2b_orders_view ===
-- GIỮ NGUYÊN: SECURITY DEFINER, auth.uid() RLS logic, stats, pagination, JSON response
-- SỬA: thêm OR p_status = '' và OR p_search = ''

CREATE OR REPLACE FUNCTION "public"."get_b2b_orders_view"("p_page" integer DEFAULT 1, "p_page_size" integer DEFAULT 10, "p_search" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT NULL::"text", "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_uid uuid := auth.uid();
        v_offset int := (p_page - 1) * p_page_size;
        v_result JSONB;
        v_stats JSONB;
    BEGIN
        SELECT jsonb_build_object(
            'sales_this_month', COALESCE(SUM(o.final_amount) FILTER (WHERE o.created_at >= date_trunc('month', now())), 0),
            'draft_count', COUNT(*) FILTER (WHERE o.status IN ('DRAFT', 'QUOTE')),
            'pending_payment', COUNT(*) FILTER (WHERE o.paid_amount < o.final_amount AND o.status NOT IN ('DRAFT', 'CANCELLED'))
        ) INTO v_stats
        FROM public.orders o
        JOIN public.customers_b2b c ON o.customer_id = c.id
        WHERE (o.creator_id = v_uid OR c.sales_staff_id = v_uid);

        WITH filtered_orders AS (
            SELECT
                o.id,
                o.code,
                c.name as customer_name,
                o.status,
                CASE
                    WHEN o.paid_amount >= o.final_amount THEN 'paid'
                    WHEN o.paid_amount > 0 THEN 'partial'
                    ELSE 'unpaid'
                END as payment_status,
                o.final_amount,
                o.paid_amount,
                o.created_at
            FROM public.orders o
            JOIN public.customers_b2b c ON o.customer_id = c.id
            WHERE
                (o.creator_id = v_uid OR c.sales_staff_id = v_uid)
                AND (p_status IS NULL OR p_status = '' OR o.status = p_status)
                AND (p_date_from IS NULL OR o.created_at >= p_date_from)
                AND (p_date_to IS NULL OR o.created_at <= p_date_to)
                AND (
                    p_search IS NULL OR p_search = ''
                    OR o.code ILIKE '%' || p_search || '%'
                    OR c.name ILIKE '%' || p_search || '%'
                )
        ),
        paginated_orders AS (
            SELECT * FROM filtered_orders
            ORDER BY created_at DESC
            LIMIT p_page_size OFFSET v_offset
        )
        SELECT
            jsonb_build_object(
                'data', COALESCE(jsonb_agg(to_jsonb(t.*)), '[]'::jsonb),
                'total', (SELECT COUNT(*) FROM filtered_orders),
                'stats', v_stats
            ) INTO v_result
        FROM paginated_orders t;

        RETURN COALESCE(v_result, jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'stats', v_stats));
    END;
    $$;


-- === 3. get_vaccination_templates ===
-- GIỮ NGUYÊN: item_count subquery, ORDER BY
-- SỬA: thêm OR p_status = '' và OR p_search = ''

CREATE OR REPLACE FUNCTION "public"."get_vaccination_templates"("p_search" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT NULL::"text") RETURNS TABLE("id" bigint, "name" "text", "description" "text", "min_age_months" integer, "max_age_months" integer, "status" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "item_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.name,
        t.description,
        t.min_age_months,
        t.max_age_months,
        t.status,
        t.created_at,
        t.updated_at,
        (SELECT COUNT(*) FROM public.vaccination_template_items i WHERE i.template_id = t.id) AS item_count
    FROM public.vaccination_templates t
    WHERE
        (p_status IS NULL OR p_status = '' OR t.status = p_status)
        AND
        (p_search IS NULL OR p_search = '' OR t.name ILIKE '%' || p_search || '%')
    ORDER BY t.created_at DESC;
END;
$$;


-- === 4. get_prescription_templates ===
-- GIỮ NGUYÊN: RETURNS SETOF, ORDER BY
-- SỬA: thêm OR p_status = '' và OR p_search = ''

CREATE OR REPLACE FUNCTION "public"."get_prescription_templates"("p_search" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."prescription_templates"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.prescription_templates
    WHERE
        (p_status IS NULL OR p_status = '' OR status = p_status)
        AND
        (p_search IS NULL OR p_search = '' OR name ILIKE '%' || p_search || '%' OR diagnosis ILIKE '%' || p_search || '%')
    ORDER BY created_at DESC;
END;
$$;
