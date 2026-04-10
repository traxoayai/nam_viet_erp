-- Thêm total_stock và avg_monthly_sold vào search_products_for_purchase
-- Giúp user ra quyết định mua số lượng chính xác khi tạo đơn mua hàng

DROP FUNCTION IF EXISTS public.search_products_for_purchase(text);

CREATE OR REPLACE FUNCTION "public"."search_products_for_purchase"(
  "p_keyword" "text" DEFAULT ''::"text"
) RETURNS TABLE(
  "id" bigint, "name" "text", "sku" "text", "barcode" "text",
  "image_url" "text", "wholesale_unit" "text", "retail_unit" "text",
  "items_per_carton" integer, "actual_cost" numeric,
  "latest_purchase_price" numeric,
  "total_stock" integer,
  "avg_monthly_sold" numeric
)
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $_$
DECLARE
    v_sql TEXT;
    v_term TEXT;
    v_search_arr TEXT[];
    v_where_clauses TEXT[] := ARRAY['p.status = ''active'''];
BEGIN
    IF p_keyword IS NOT NULL AND TRIM(p_keyword) != '' THEN
        v_search_arr := string_to_array(TRIM(p_keyword), ' ');
        FOREACH v_term IN ARRAY v_search_arr
        LOOP
            IF TRIM(v_term) != '' THEN
                v_where_clauses := array_append(v_where_clauses, format(
                    '(p.name ILIKE %1$L OR p.sku ILIKE %1$L OR COALESCE(p.barcode, '''') ILIKE %1$L OR COALESCE(p.active_ingredient, '''') ILIKE %1$L)',
                    '%' || TRIM(v_term) || '%'
                ));
            END IF;
        END LOOP;
    END IF;

    v_sql := format($q$
        SELECT
            p.id,
            p.name,
            p.sku,
            p.barcode,
            p.image_url,

            COALESCE(
                (SELECT unit_name FROM public.product_units pu WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1),
                (SELECT unit_name FROM public.product_units pu WHERE pu.product_id = p.id AND pu.conversion_rate > 1 ORDER BY pu.conversion_rate DESC LIMIT 1),
                p.wholesale_unit,
                'Hộp'
            ) AS wholesale_unit,

            COALESCE(
                (SELECT unit_name FROM public.product_units pu WHERE pu.product_id = p.id AND pu.is_base = true LIMIT 1),
                (SELECT unit_name FROM public.product_units pu WHERE pu.product_id = p.id AND pu.unit_type = 'retail' LIMIT 1),
                p.retail_unit,
                'Vỉ'
            ) AS retail_unit,

            COALESCE(
                (SELECT conversion_rate FROM public.product_units pu WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1),
                (SELECT conversion_rate FROM public.product_units pu WHERE pu.product_id = p.id AND pu.conversion_rate > 1 ORDER BY pu.conversion_rate DESC LIMIT 1),
                p.items_per_carton,
                1
            )::integer AS items_per_carton,

            COALESCE(p.actual_cost, 0) AS actual_cost,

            COALESCE(
                (
                    SELECT poi.unit_price
                    FROM public.purchase_order_items poi
                    JOIN public.purchase_orders po ON poi.po_id = po.id
                    WHERE poi.product_id = p.id
                    AND po.status <> 'CANCELLED'
                    ORDER BY po.created_at DESC
                    LIMIT 1
                ),
                0
            ) AS latest_purchase_price,

            -- Tồn kho tổng (tất cả kho)
            COALESCE(
                (SELECT SUM(pi.stock_quantity)::integer FROM public.product_inventory pi WHERE pi.product_id = p.id),
                0
            ) AS total_stock,

            -- Trung bình bán/tháng (3 tháng gần nhất, tính theo base unit)
            COALESCE(
                (
                    SELECT ROUND(SUM(oi.quantity * COALESCE(oi.conversion_factor, 1)) / 3.0, 1)
                    FROM public.order_items oi
                    JOIN public.orders o ON oi.order_id = o.id
                    WHERE oi.product_id = p.id
                      AND o.status NOT IN ('CANCELLED', 'DRAFT')
                      AND o.created_at >= NOW() - INTERVAL '3 months'
                ),
                0
            ) AS avg_monthly_sold

        FROM
            public.products p
        WHERE
            %1$s
        ORDER BY
            p.created_at DESC
        LIMIT 20;
    $q$,
    array_to_string(v_where_clauses, ' AND ')
    );

    RETURN QUERY EXECUTE v_sql;
END;
$_$;
