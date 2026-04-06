-- Fix: get_suppliers_list trả về rỗng khi status_filter = ''
-- Root cause: status_filter = '' không match với s.status ('active'/'inactive')

CREATE OR REPLACE FUNCTION "public"."get_suppliers_list"(
    "search_query" "text",
    "status_filter" "text",
    "page_num" integer,
    "page_size" integer
) RETURNS TABLE(
    "id" bigint, "key" "text", "code" "text", "name" "text",
    "contact_person" "text", "phone" "text", "status" "text",
    "debt" numeric, "bank_bin" "text", "bank_account" "text",
    "bank_name" "text", "bank_holder" "text", "total_count" bigint
)
LANGUAGE "plpgsql"
AS $$
BEGIN
    RETURN QUERY
    WITH filtered_suppliers AS (
        SELECT
            s.id,
            s.id::TEXT AS key,
            'NCC-' || s.id::TEXT AS code,
            s.name,
            s.contact_person,
            s.phone,
            s.status,
            0::NUMERIC AS debt,
            s.bank_bin,
            s.bank_account,
            s.bank_name,
            s.bank_holder,
            COUNT(*) OVER() as total_count
        FROM public.suppliers s
        WHERE
            (search_query IS NULL OR search_query = '' OR (
                s.name ILIKE ('%' || search_query || '%') OR
                s.phone ILIKE ('%' || search_query || '%') OR
                s.id::TEXT ILIKE ('%' || search_query || '%')
            ))
        AND
            (status_filter IS NULL OR status_filter = '' OR s.status = status_filter)
    )
    SELECT *
    FROM filtered_suppliers
    ORDER BY id DESC
    LIMIT page_size
    OFFSET (page_num - 1) * page_size;
END;
$$;
