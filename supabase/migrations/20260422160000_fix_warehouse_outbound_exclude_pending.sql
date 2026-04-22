-- Migration: Kho chỉ thấy đơn đã CONFIRMED trở lên (ẩn PENDING/DRAFT/QUOTE)
-- ============================================================================
-- BUG:
--   `get_warehouse_outbound_tasks` chỉ loại `('DRAFT', 'QUOTE')` khiến đơn Portal
--   ở trạng thái PENDING (chưa thanh toán, chưa xác nhận) vẫn lọt vào danh sách
--   xuất kho. Nếu kho lỡ đóng đơn và khách không thanh toán, cron auto-cancel 24h
--   sẽ hủy đơn ⇒ sai lệch tồn kho (đã trừ FEFO cho đơn đã hủy).
--
-- ROOT CAUSE:
--   Filter dùng blacklist `NOT IN ('DRAFT', 'QUOTE')` — thiếu PENDING, QUOTE_EXPIRED.
--
-- FIX:
--   Chuyển sang whitelist các status hợp lệ cho kho:
--   CONFIRMED, PACKED, SHIPPING, DELIVERED, COMPLETED, CANCELLED.
--   (CANCELLED giữ lại vì UI có tab "Đã hủy".)
--
-- Giữ NGUYÊN toàn bộ logic khác của function (CTEs, JOINs, ORDER BY, pagination).
-- Date: 2026-04-22
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION "public"."get_warehouse_outbound_tasks"(
    "p_page" integer DEFAULT 1,
    "p_page_size" integer DEFAULT 20,
    "p_search" "text" DEFAULT NULL::"text",
    "p_status" "text" DEFAULT NULL::"text",
    "p_type" "text" DEFAULT NULL::"text",
    "p_date_from" "date" DEFAULT NULL::"date",
    "p_date_to" "date" DEFAULT NULL::"date",
    "p_warehouse_id" bigint DEFAULT 1,
    "p_shipping_partner_id" bigint DEFAULT NULL::bigint
)
RETURNS TABLE(
    "task_id" "uuid",
    "code" "text",
    "task_type" "text",
    "customer_name" "text",
    "created_at" timestamp with time zone,
    "delivery_deadline" timestamp with time zone,
    "priority" "text",
    "status" "text",
    "shipping_partner_name" "text",
    "shipping_contact_name" "text",
    "shipping_contact_phone" "text",
    "package_count" integer,
    "progress_picked" integer,
    "progress_total" integer,
    "status_label" "text",
    "total_count" bigint
)
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
    v_offset INTEGER;
BEGIN
    v_offset := (p_page - 1) * p_page_size;

    RETURN QUERY
    WITH task_metrics AS (
        SELECT
            oi.order_id,
            COALESCE(SUM(oi.quantity), 0) AS _total_qty,
            COALESCE(SUM(oi.quantity_picked), 0) AS _picked_qty
        FROM public.order_items oi
        GROUP BY oi.order_id
    ),
    raw_data AS (
        SELECT
            o.id AS _internal_id,
            o.code AS _internal_code,
            o.status AS _internal_status,
            o.created_at AS _internal_created_at,
            o.package_count AS _internal_package_count,

            CASE
                WHEN o.customer_id IS NOT NULL THEN 'Bán hàng'
                WHEN o.delivery_method = 'internal' THEN 'Chuyển kho'
                ELSE 'Khác'
            END::TEXT AS _internal_type,

            COALESCE(c.name, 'Khách lẻ') AS _internal_cust_name,
            (o.created_at + interval '24 hours')::TIMESTAMPTZ AS _internal_deadline,

            CASE
                WHEN o.status IN ('DELIVERED', 'CANCELLED') THEN 'Normal'
                WHEN NOW() > (o.created_at + interval '24 hours') THEN 'High'
                ELSE 'Normal'
            END AS _internal_priority,

            COALESCE(sp.name, 'Tự vận chuyển') AS _internal_ship_partner,
            COALESCE(sp.contact_person, 'N/A') AS _internal_ship_contact,
            COALESCE(sp.phone, 'N/A') AS _internal_ship_phone,

            COALESCE(tm._picked_qty, 0) AS _internal_picked,
            COALESCE(tm._total_qty, 0) AS _internal_total

        FROM public.orders o
        LEFT JOIN public.customers_b2b c ON o.customer_id = c.id
        LEFT JOIN public.shipping_partners sp ON o.shipping_partner_id = sp.id
        LEFT JOIN task_metrics tm ON o.id = tm.order_id
        WHERE
            -- [FIXED 2026-04-22] Whitelist: kho chỉ thấy đơn đã xác nhận trở lên.
            -- Loại PENDING (Portal chưa thanh toán), DRAFT, QUOTE, QUOTE_EXPIRED.
            o.status IN ('CONFIRMED', 'PACKED', 'SHIPPING', 'DELIVERED', 'COMPLETED', 'CANCELLED')
            AND (p_status IS NULL OR o.status = p_status)
            AND (p_shipping_partner_id IS NULL OR o.shipping_partner_id = p_shipping_partner_id)
            AND (p_date_from IS NULL OR date(o.created_at) >= p_date_from)
            AND (p_date_to IS NULL OR date(o.created_at) <= p_date_to)
            AND (
                p_search IS NULL OR p_search = ''
                OR o.code ILIKE ('%' || p_search || '%')
                OR c.name ILIKE ('%' || p_search || '%')
                OR EXISTS (
                    SELECT 1 FROM public.order_items sub_oi
                    JOIN public.products sub_p ON sub_oi.product_id = sub_p.id
                    WHERE sub_oi.order_id = o.id AND sub_p.name ILIKE ('%' || p_search || '%')
                )
            )
    )
    SELECT
        rd._internal_id AS task_id,
        rd._internal_code AS code,
        rd._internal_type AS task_type,
        rd._internal_cust_name AS customer_name,
        rd._internal_created_at AS created_at,
        rd._internal_deadline AS delivery_deadline,
        rd._internal_priority AS priority,
        rd._internal_status AS status,
        rd._internal_ship_partner AS shipping_partner_name,
        rd._internal_ship_contact AS shipping_contact_name,
        rd._internal_ship_phone AS shipping_contact_phone,
        COALESCE(rd._internal_package_count, 1) AS package_count,
        rd._internal_picked::INTEGER AS progress_picked,
        rd._internal_total::INTEGER AS progress_total,
        CASE
            WHEN rd._internal_status = 'CANCELLED' THEN 'Đã hủy'
            WHEN rd._internal_status = 'DELIVERED' THEN 'Hoàn tất'
            WHEN rd._internal_status = 'SHIPPING' THEN 'Đang giao'
            WHEN rd._internal_picked = 0 THEN 'Chờ xử lý'
            WHEN rd._internal_picked < rd._internal_total THEN 'Đang nhặt'
            WHEN rd._internal_picked >= rd._internal_total THEN 'Chờ giao'
            ELSE 'Chờ xử lý'
        END AS status_label,
        COUNT(*) OVER() AS total_count
    FROM raw_data rd
    WHERE (p_type IS NULL OR p_type = '' OR rd._internal_type = p_type)
    ORDER BY
        -- 1. Ưu tiên NHÓM THEO NGÀY (Ngày mới nhất lên đầu)
        DATE(rd._internal_created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') DESC,

        -- 2. Trong cùng 1 ngày -> Ưu tiên trạng thái (Cần làm trước)
        CASE
            WHEN rd._internal_status = 'CONFIRMED' THEN 1
            WHEN rd._internal_status = 'PACKED' THEN 2
            WHEN rd._internal_status = 'SHIPPING' THEN 3
            WHEN rd._internal_status IN ('DELIVERED', 'COMPLETED') THEN 4
            WHEN rd._internal_status = 'CANCELLED' THEN 5
            ELSE 6
        END ASC,

        -- 3. Trong cùng Ngày + Cùng Trạng thái -> Ưu tiên giờ/phút mới nhất
        rd._internal_created_at DESC

    LIMIT p_page_size OFFSET v_offset;
END;
$$;

ALTER FUNCTION "public"."get_warehouse_outbound_tasks"(
    "p_page" integer, "p_page_size" integer, "p_search" "text",
    "p_status" "text", "p_type" "text", "p_date_from" "date",
    "p_date_to" "date", "p_warehouse_id" bigint, "p_shipping_partner_id" bigint
) OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."get_warehouse_outbound_tasks"(
    "p_page" integer, "p_page_size" integer, "p_search" "text",
    "p_status" "text", "p_type" "text", "p_date_from" "date",
    "p_date_to" "date", "p_warehouse_id" bigint, "p_shipping_partner_id" bigint
) TO "anon";

GRANT ALL ON FUNCTION "public"."get_warehouse_outbound_tasks"(
    "p_page" integer, "p_page_size" integer, "p_search" "text",
    "p_status" "text", "p_type" "text", "p_date_from" "date",
    "p_date_to" "date", "p_warehouse_id" bigint, "p_shipping_partner_id" bigint
) TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_warehouse_outbound_tasks"(
    "p_page" integer, "p_page_size" integer, "p_search" "text",
    "p_status" "text", "p_type" "text", "p_date_from" "date",
    "p_date_to" "date", "p_warehouse_id" bigint, "p_shipping_partner_id" bigint
) TO "service_role";

COMMENT ON FUNCTION "public"."get_warehouse_outbound_tasks"(
    "p_page" integer, "p_page_size" integer, "p_search" "text",
    "p_status" "text", "p_type" "text", "p_date_from" "date",
    "p_date_to" "date", "p_warehouse_id" bigint, "p_shipping_partner_id" bigint
) IS 'V2 (2026-04-22): Whitelist status (CONFIRMED/PACKED/SHIPPING/DELIVERED/COMPLETED/CANCELLED). Ẩn PENDING để kho không đóng nhầm đơn Portal chưa thanh toán.';

NOTIFY pgrst, 'reload schema';

COMMIT;
