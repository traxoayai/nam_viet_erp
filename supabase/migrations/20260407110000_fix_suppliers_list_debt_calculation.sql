-- Fix: get_suppliers_list công nợ luôn = 0
-- Root cause: migration 20260405100000 fix empty filter nhưng xóa mất logic tính debt
-- Khôi phục 3 CTEs: po_total, opening_debt, paid_total + giữ fix empty filter

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
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH
    -- A. Tổng giá trị nhập hàng (Purchase Orders)
    po_total AS (
        SELECT po.supplier_id,
               SUM(po.final_amount) as amount
        FROM public.purchase_orders po
        WHERE po.status <> 'CANCELLED'
        GROUP BY po.supplier_id
    ),

    -- B. Nợ đầu kỳ (Finance Transactions)
    opening_debt AS (
        SELECT ft.partner_id::BIGINT as supplier_id,
               SUM(ft.amount) as amount
        FROM public.finance_transactions ft
        WHERE ft.partner_type = 'supplier'
          AND ft.business_type = 'opening_balance'
        GROUP BY ft.partner_id
    ),

    -- C. Tổng tiền ĐÃ CHI TRẢ (Finance Transactions)
    paid_total AS (
        SELECT ft.partner_id::BIGINT as supplier_id,
               SUM(ft.amount) as amount
        FROM public.finance_transactions ft
        WHERE ft.partner_type = 'supplier'
          AND ft.flow = 'out'
          AND ft.status = 'completed'
          AND ft.business_type <> 'opening_balance'
        GROUP BY ft.partner_id
    ),

    filtered_suppliers AS (
        SELECT
            s.id,
            s.id::TEXT AS key,
            ('NCC-' || s.id::TEXT) AS code,
            s.name,
            s.contact_person,
            s.phone,
            s.status,
            -- Công thức: nợ = tổng đơn hàng + nợ đầu kỳ - đã trả
            (
                COALESCE(pt.amount, 0) +
                COALESCE(od.amount, 0) -
                COALESCE(pd.amount, 0)
            ) AS debt,
            s.bank_bin,
            s.bank_account,
            s.bank_name,
            s.bank_holder,
            COUNT(*) OVER() as total_count
        FROM public.suppliers s
        LEFT JOIN po_total pt ON s.id = pt.supplier_id
        LEFT JOIN opening_debt od ON s.id = od.supplier_id
        LEFT JOIN paid_total pd ON s.id = pd.supplier_id
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
