-- Fix: Nhiều hàm RPC lọc sai khi frontend gửi empty string "" thay vì NULL
-- Pattern: (filter IS NULL OR ...) → (filter IS NULL OR filter = '' OR ...)
-- Đảm bảo check = '' TRƯỚC cast enum để tránh lỗi invalid input value
-- Bỏ qua: get_suppliers_list (đã fix ở 20260405100000)

BEGIN;

------------------------------------------------------------------------
-- 1. export_customers_b2b_list
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."export_customers_b2b_list"(
    "search_query" "text",
    "sales_staff_filter" "uuid",
    "status_filter" "text"
) RETURNS TABLE(
    "id" bigint, "customer_code" "text", "name" "text", "phone" "text",
    "email" "text", "tax_code" "text", "contact_person_name" "text",
    "contact_person_phone" "text", "vat_address" "text", "shipping_address" "text",
    "sales_staff_name" "text", "debt_limit" numeric, "payment_term" integer,
    "ranking" "text", "status" "public"."account_status", "loyalty_points" integer
)
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.customer_code,
    c.name,
    c.phone,
    c.email,
    c.tax_code,
    contacts.name AS contact_person_name,
    contacts.phone AS contact_person_phone,
    c.vat_address,
    c.shipping_address,
    (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE auth.users.id = c.sales_staff_id) AS sales_staff_name,
    c.debt_limit,
    c.payment_term,
    c.ranking,
    c.status,
    c.loyalty_points
  FROM
    public.customers_b2b c
  LEFT JOIN LATERAL (
    SELECT cc.name, cc.phone
    FROM public.customer_b2b_contacts cc
    WHERE cc.customer_b2b_id = c.id
    ORDER BY cc.is_primary DESC, cc.id ASC
    LIMIT 1
  ) contacts ON true
  WHERE
    (status_filter IS NULL OR status_filter = '' OR c.status = status_filter::public.account_status)
  AND
    (sales_staff_filter IS NULL OR c.sales_staff_id = sales_staff_filter)
  AND
    (
      search_query IS NULL OR search_query = '' OR
      c.name ILIKE ('%' || search_query || '%') OR
      c.customer_code ILIKE ('%' || search_query || '%') OR
      c.phone ILIKE ('%' || search_query || '%') OR
      c.tax_code ILIKE ('%' || search_query || '%')
    )
  ORDER BY
    c.id DESC;
END;
$$;

------------------------------------------------------------------------
-- 2. export_customers_b2c_list
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."export_customers_b2c_list"(
    "search_query" "text",
    "type_filter" "text",
    "status_filter" "text"
) RETURNS TABLE(
    "key" "text", "id" bigint, "customer_code" "text", "name" "text",
    "type" "public"."customer_b2c_type", "phone" "text",
    "loyalty_points" integer, "status" "public"."account_status",
    "total_count" bigint
)
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
BEGIN
 RETURN QUERY
 WITH filtered_customers AS (
 SELECT
 c.id, c.customer_code, c.name, c.type, c.phone,
 c.loyalty_points, c.status,
 COUNT(*) OVER() AS total_count
 FROM
 public.customers c
 WHERE
 (status_filter IS NULL OR status_filter = '' OR c.status = status_filter::public.account_status)
 AND
 (type_filter IS NULL OR type_filter = '' OR c.type = type_filter::public.customer_b2c_type)
 AND
 (
 search_query IS NULL OR search_query = '' OR
 c.name ILIKE ('%' || search_query || '%') OR
 c.customer_code ILIKE ('%' || search_query || '%') OR
 c.phone ILIKE ('%' || search_query || '%') OR
 c.contact_person_phone ILIKE ('%' || search_query || '%') OR
 c.id IN (
 SELECT cg.customer_id
 FROM public.customer_guardians cg
 JOIN public.customers guardian ON cg.guardian_id = guardian.id
 WHERE guardian.phone ILIKE ('%' || search_query || '%')
 )
 )
 )
 SELECT
 fc.id::TEXT AS key, fc.id, fc.customer_code, fc.name, fc.type,
 fc.phone, fc.loyalty_points, fc.status, fc.total_count
 FROM
 filtered_customers fc
 ORDER BY
 fc.id DESC;
END;
$$;

------------------------------------------------------------------------
-- 3. export_products_list
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."export_products_list"(
    "search_query" "text",
    "category_filter" "text",
    "manufacturer_filter" "text",
    "status_filter" "text"
) RETURNS TABLE(
    "key" "text", "id" bigint, "name" "text", "sku" "text",
    "image_url" "text", "category_name" "text", "manufacturer_name" "text",
    "status" "text", "inventory_b2b" integer, "inventory_pkdh" integer,
    "inventory_ntdh1" integer, "inventory_ntdh2" integer,
    "inventory_potec" integer, "total_count" bigint
)
LANGUAGE "plpgsql"
AS $$
BEGIN
    RETURN QUERY
    WITH filtered_products AS (
        SELECT
            p.id, p.name, p.sku, p.image_url, p.category_name, p.manufacturer_name, p.status,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 1) AS inventory_b2b,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 2) AS inventory_pkdh,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 3) AS inventory_ntdh1,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 4) AS inventory_ntdh2,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 5) AS inventory_potec
        FROM public.products p
        WHERE
            (search_query IS NULL OR search_query = '' OR p.fts @@ to_tsquery('simple', search_query || ':*'))
        AND
            (category_filter IS NULL OR category_filter = '' OR p.category_name = category_filter)
        AND
            (manufacturer_filter IS NULL OR manufacturer_filter = '' OR p.manufacturer_name = manufacturer_filter)
        AND
            (status_filter IS NULL OR status_filter = '' OR p.status = status_filter)
    ),
    counted_products AS (
        SELECT *, COUNT(*) OVER() as total_count FROM filtered_products
    )
    SELECT
        cp.id::TEXT AS key, cp.id, cp.name, cp.sku, cp.image_url,
        cp.category_name, cp.manufacturer_name, cp.status,
        cp.inventory_b2b::INT, cp.inventory_pkdh::INT, cp.inventory_ntdh1::INT,
        cp.inventory_ntdh2::INT, cp.inventory_potec::INT,
        cp.total_count
    FROM counted_products cp
    ORDER BY cp.id DESC;
END;
$$;

------------------------------------------------------------------------
-- 4. get_assets_list
--    type_filter (bigint) và branch_filter (bigint) không cần check ''
--    status_filter (text, cast to asset_status) cần check ''
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_assets_list"(
    "search_query" "text",
    "type_filter" bigint,
    "branch_filter" bigint,
    "status_filter" "text"
) RETURNS TABLE(
    "key" "text", "id" bigint, "asset_code" "text", "name" "text",
    "image_url" "text", "asset_type_name" "text", "branch_name" "text",
    "user_name" "text", "purchase_date" "date", "cost" numeric,
    "depreciation_months" integer, "depreciation_per_month" numeric,
    "remaining_value" numeric, "status" "public"."asset_status",
    "total_count" bigint
)
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_assets AS (
    SELECT
      a.id,
      a.asset_code,
      a.name,
      a.image_url,
      aty.name AS asset_type_name,
      w.name AS branch_name,
      (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE auth.users.id = a.user_id) AS user_name,
      a.purchase_date,
      a.cost,
      a.depreciation_months,
      a.status,
      COUNT(*) OVER() AS total_count
    FROM public.assets a
    LEFT JOIN public.asset_types aty ON a.asset_type_id = aty.id
    LEFT JOIN public.warehouses w ON a.branch_id = w.id
    WHERE
      (search_query IS NULL OR search_query = '' OR (
        a.name ILIKE ('%' || search_query || '%') OR
        a.asset_code ILIKE ('%' || search_query || '%') OR
        a.serial_number ILIKE ('%' || search_query || '%')
      ))
    AND (type_filter IS NULL OR a.asset_type_id = type_filter)
    AND (branch_filter IS NULL OR a.branch_id = branch_filter)
    AND (status_filter IS NULL OR status_filter = '' OR a.status::text = status_filter)
  )
  SELECT
    f.id::TEXT AS key,
    f.id,
    f.asset_code,
    f.name,
    f.image_url,
    f.asset_type_name,
    f.branch_name,
    f.user_name,
    f.purchase_date,
    f.cost,
    f.depreciation_months,
    (CASE
      WHEN f.depreciation_months > 0 THEN round(f.cost / f.depreciation_months)
      ELSE 0
    END) AS depreciation_per_month,
    (CASE
      WHEN f.purchase_date IS NULL THEN f.cost
      ELSE GREATEST(0,
        f.cost - (
          (CASE WHEN f.depreciation_months > 0 THEN round(f.cost / f.depreciation_months) ELSE 0 END)
          * GREATEST(0, date_part('month', age(now(), f.purchase_date))::INT)
        )
      )
    END) AS remaining_value,
    f.status,
    f.total_count
  FROM filtered_assets f
  ORDER BY f.id DESC;
END;
$$;

------------------------------------------------------------------------
-- 5. get_customers_b2b_list (paginated)
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_customers_b2b_list"(
    "search_query" "text",
    "sales_staff_filter" "uuid",
    "status_filter" "text",
    "page_num" integer,
    "page_size" integer
) RETURNS TABLE(
    "key" "text", "id" bigint, "customer_code" "text", "name" "text",
    "phone" "text", "sales_staff_name" "text", "debt_limit" numeric,
    "current_debt" numeric, "status" "public"."account_status",
    "total_count" bigint
)
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_customers AS (
    SELECT
      c.id,
      c.customer_code,
      c.name,
      c.phone,
      (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE auth.users.id = c.sales_staff_id) AS sales_staff_name,
      c.debt_limit,
      0::NUMERIC AS current_debt,
      c.status,
      COUNT(*) OVER() AS total_count
    FROM
      public.customers_b2b c
    WHERE
      (status_filter IS NULL OR status_filter = '' OR c.status = status_filter::public.account_status)
    AND
      (sales_staff_filter IS NULL OR c.sales_staff_id = sales_staff_filter)
    AND
      (
        search_query IS NULL OR search_query = '' OR
        c.name ILIKE ('%' || search_query || '%') OR
        c.customer_code ILIKE ('%' || search_query || '%') OR
        c.phone ILIKE ('%' || search_query || '%') OR
        c.tax_code ILIKE ('%' || search_query || '%')
      )
  )
  SELECT
    fc.id::TEXT AS key,
    fc.id,
    fc.customer_code,
    fc.name,
    fc.phone,
    fc.sales_staff_name,
    fc.debt_limit,
    fc.current_debt,
    fc.status,
    fc.total_count
  FROM
    filtered_customers fc
  ORDER BY
    fc.id DESC
  LIMIT page_size
  OFFSET (page_num - 1) * page_size;
END;
$$;

------------------------------------------------------------------------
-- 6. get_customers_b2c_list (3-param, no pagination)
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_customers_b2c_list"(
    "search_query" "text",
    "type_filter" "text",
    "status_filter" "text"
) RETURNS TABLE(
    "key" "text", "id" bigint, "customer_code" "text", "name" "text",
    "type" "public"."customer_b2c_type", "phone" "text",
    "loyalty_points" integer, "status" "public"."account_status",
    "total_count" bigint
)
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
BEGIN
 RETURN QUERY
 WITH filtered_customers AS (
 SELECT
 c.id, c.customer_code, c.name, c.type, c.phone,
 c.loyalty_points, c.status,
 COUNT(*) OVER() AS total_count
 FROM
 public.customers c
 WHERE
 (status_filter IS NULL OR status_filter = '' OR c.status = status_filter::public.account_status)
 AND
 (type_filter IS NULL OR type_filter = '' OR c.type = type_filter::public.customer_b2c_type)
 AND
 (
  search_query IS NULL OR search_query = '' OR
  c.name ILIKE ('%' || search_query || '%') OR
  c.customer_code ILIKE ('%' || search_query || '%') OR
  c.phone ILIKE ('%' || search_query || '%') OR
  c.contact_person_phone ILIKE ('%' || search_query || '%') OR
  c.id IN (
  SELECT cg.customer_id
  FROM public.customer_guardians cg
  JOIN public.customers guardian ON cg.guardian_id = guardian.id
  WHERE guardian.phone ILIKE ('%' || search_query || '%')
  )
 )
 )
 SELECT
 fc.id::TEXT AS key, fc.id, fc.customer_code, fc.name, fc.type,
 fc.phone, fc.loyalty_points, fc.status, fc.total_count
 FROM
 filtered_customers fc
 ORDER BY
 fc.id DESC;
END;
$$;

------------------------------------------------------------------------
-- 7. get_customers_b2c_list (5-param, with pagination)
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_customers_b2c_list"(
    "search_query" "text",
    "type_filter" "text",
    "status_filter" "text",
    "page_num" integer,
    "page_size" integer
) RETURNS TABLE(
    "key" "text", "id" bigint, "customer_code" "text", "name" "text",
    "type" "public"."customer_b2c_type", "phone" "text",
    "loyalty_points" integer, "status" "public"."account_status",
    "total_count" bigint
)
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
BEGIN
 RETURN QUERY
 WITH filtered_customers AS (
  SELECT
 c.id, c.customer_code, c.name, c.type, c.phone,
 c.loyalty_points, c.status,
 COUNT(*) OVER() AS total_count
  FROM
 public.customers c
  WHERE
 (status_filter IS NULL OR status_filter = '' OR c.status = status_filter::public.account_status)
  AND
 (type_filter IS NULL OR type_filter = '' OR c.type = type_filter::public.customer_b2c_type)
  AND
 (
 search_query IS NULL OR search_query = '' OR
 c.name ILIKE ('%' || search_query || '%') OR
 c.customer_code ILIKE ('%' || search_query || '%') OR
 c.phone ILIKE ('%' || search_query || '%') OR
 c.contact_person_phone ILIKE ('%' || search_query || '%') OR
 c.id IN (
 SELECT cg.customer_id
 FROM public.customer_guardians cg
 JOIN public.customers guardian ON cg.guardian_id = guardian.id
 WHERE guardian.phone ILIKE ('%' || search_query || '%')
 )
 )
 )
 SELECT
  fc.id::TEXT AS key, fc.id, fc.customer_code, fc.name, fc.type,
  fc.phone, fc.loyalty_points, fc.status, fc.total_count
 FROM
  filtered_customers fc
 ORDER BY
  fc.id DESC
 LIMIT page_size
 OFFSET (page_num - 1) * page_size;
END;
$$;

------------------------------------------------------------------------
-- 8. get_products_list (paginated)
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_products_list"(
    "search_query" "text",
    "category_filter" "text",
    "manufacturer_filter" "text",
    "status_filter" "text",
    "page_num" integer,
    "page_size" integer
) RETURNS TABLE(
    "key" "text", "id" bigint, "name" "text", "sku" "text",
    "image_url" "text", "category_name" "text", "manufacturer_name" "text",
    "status" "text", "inventory_b2b" integer, "inventory_pkdh" integer,
    "inventory_ntdh1" integer, "inventory_ntdh2" integer,
    "inventory_potec" integer, "total_count" bigint
)
LANGUAGE "plpgsql"
AS $$
BEGIN
    RETURN QUERY
    WITH filtered_products AS (
        SELECT
            p.id,
            p.name,
            p.sku,
            p.image_url,
            p.category_name,
            p.manufacturer_name,
            p.status,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 1) AS inventory_b2b,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 2) AS inventory_pkdh,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 3) AS inventory_ntdh1,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 4) AS inventory_ntdh2,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 5) AS inventory_potec
        FROM
            public.products p
        WHERE
            (search_query IS NULL OR search_query = '' OR p.fts @@ to_tsquery('simple', search_query || ':*'))
        AND
            (category_filter IS NULL OR category_filter = '' OR p.category_name = category_filter)
        AND
            (manufacturer_filter IS NULL OR manufacturer_filter = '' OR p.manufacturer_name = manufacturer_filter)
        AND
            (status_filter IS NULL OR status_filter = '' OR p.status = status_filter)
    ),
    counted_products AS (
        SELECT *, COUNT(*) OVER() as total_count FROM filtered_products
    )
    SELECT
        cp.id::TEXT AS key,
        cp.id,
        cp.name,
        cp.sku,
        cp.image_url,
        cp.category_name,
        cp.manufacturer_name,
        cp.status,
        cp.inventory_b2b::INT,
        cp.inventory_pkdh::INT,
        cp.inventory_ntdh1::INT,
        cp.inventory_ntdh2::INT,
        cp.inventory_potec::INT,
        cp.total_count
    FROM
        counted_products cp
    ORDER BY
        cp.id DESC
    LIMIT
        page_size
    OFFSET
        (page_num - 1) * page_size;
END;
$$;

------------------------------------------------------------------------
-- 9. get_service_packages_list (DROP + CREATE vì return type khác prod)
------------------------------------------------------------------------
DROP FUNCTION IF EXISTS "public"."get_service_packages_list"("text","text","text",integer,integer);
CREATE FUNCTION "public"."get_service_packages_list"(
    "p_search_query" "text",
    "p_type_filter" "text",
    "p_status_filter" "text",
    "p_page_num" integer,
    "p_page_size" integer
) RETURNS TABLE(
    "key" "text", "id" bigint, "name" "text", "sku" "text",
    "type" "public"."service_package_type", "price" numeric,
    "total_cost_price" numeric, "valid_from" "date", "valid_to" "date",
    "status" "public"."account_status", "clinical_category" "text",
    "total_count" bigint
)
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_data AS (
    SELECT
      s.id,
      s.name,
      s.sku,
      s.type,
      s.price,
      s.total_cost_price,
      s.valid_from,
      s.valid_to,
      s.status,
      s.clinical_category,
      COUNT(*) OVER() AS total_count
    FROM
      public.service_packages s
    WHERE
      (p_type_filter IS NULL OR p_type_filter = '' OR s.type = p_type_filter::public.service_package_type)
    AND
      (p_status_filter IS NULL OR p_status_filter = '' OR s.status = p_status_filter::public.account_status)
    AND
      (p_search_query IS NULL OR p_search_query = '' OR
        s.name ILIKE ('%' || p_search_query || '%') OR
        s.sku ILIKE ('%' || p_search_query || '%')
      )
  )
  SELECT
    fd.id::TEXT AS key,
    fd.*
  FROM
    filtered_data fd
  ORDER BY
    fd.id DESC
  LIMIT p_page_size
  OFFSET (p_page_num - 1) * p_page_size;
END;
$$;

------------------------------------------------------------------------
-- 10. get_shipping_partners_list
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_shipping_partners_list"(
    "p_search_query" "text",
    "p_type_filter" "text"
) RETURNS TABLE(
    "key" "text", "id" bigint, "name" "text",
    "type" "public"."shipping_partner_type", "contact_person" "text",
    "phone" "text", "cut_off_time" time without time zone,
    "status" "public"."account_status", "total_count" bigint
)
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_partners AS (
    SELECT
      p.id,
      p.name,
      p.type,
      p.contact_person,
      p.phone,
      p.cut_off_time,
      p.status,
      COUNT(*) OVER() AS total_count
    FROM
      public.shipping_partners p
    WHERE
      (p_type_filter IS NULL OR p_type_filter = '' OR p.type = p_type_filter::public.shipping_partner_type)
    AND
      (
        p_search_query IS NULL OR p_search_query = '' OR
        p.name ILIKE ('%' || p_search_query || '%') OR
        p.contact_person ILIKE ('%' || p_search_query || '%') OR
        p.phone ILIKE ('%' || p_search_query || '%')
      )
  )
  SELECT
    fp.id::TEXT AS key,
    fp.id,
    fp.name,
    fp.type,
    fp.contact_person,
    fp.phone,
    fp.cut_off_time,
    fp.status,
    fp.total_count
  FROM
    filtered_partners fp
  ORDER BY
    fp.name;
END;
$$;

------------------------------------------------------------------------
-- 11. get_transaction_history (8-param overload with p_search + p_status text)
--     p_status là TEXT cast sang transaction_status → cần check ''
--     Overload 6-param và 9-param không bị lỗi này (không có text cast)
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."get_transaction_history"(
    "p_flow" "public"."transaction_flow" DEFAULT NULL::"public"."transaction_flow",
    "p_fund_id" bigint DEFAULT NULL::bigint,
    "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone,
    "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone,
    "p_limit" integer DEFAULT 20,
    "p_offset" integer DEFAULT 0,
    "p_search" "text" DEFAULT NULL::"text",
    "p_status" "text" DEFAULT NULL::"text"
) RETURNS TABLE(
    "id" bigint, "code" "text",
    "transaction_date" timestamp with time zone,
    "flow" "public"."transaction_flow", "amount" numeric,
    "fund_name" "text", "partner_name" "text", "category_name" "text",
    "description" "text", "business_type" "public"."business_type",
    "created_by_name" "text", "status" "public"."transaction_status",
    "ref_advance_id" bigint, "evidence_url" "text", "total_count" bigint
)
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id, t.code, t.transaction_date, t.flow, t.amount,
        f.name as fund_name,
        COALESCE(t.partner_name_cache, 'Khác') as partner_name,
        cat.name as category_name,
        t.description, t.business_type,
        u.full_name as created_by_name,
        t.status, t.ref_advance_id, t.evidence_url,
        COUNT(*) OVER() as total_count
    FROM public.finance_transactions t
    JOIN public.fund_accounts f ON t.fund_account_id = f.id
    LEFT JOIN public.transaction_categories cat ON t.category_id = cat.id
    LEFT JOIN public.users u ON t.created_by = u.id
    WHERE
        (p_flow IS NULL OR t.flow = p_flow)
        AND (p_fund_id IS NULL OR t.fund_account_id = p_fund_id)
        AND (p_date_from IS NULL OR t.transaction_date >= p_date_from)
        AND (p_date_to IS NULL OR t.transaction_date <= p_date_to)
        AND (p_status IS NULL OR p_status = '' OR t.status = p_status::public.transaction_status)
        AND (
            p_search IS NULL OR p_search = '' OR
            t.code ILIKE '%' || p_search || '%' OR
            t.description ILIKE '%' || p_search || '%' OR
            t.partner_name_cache ILIKE '%' || p_search || '%'
        )
    ORDER BY t.transaction_date DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

COMMIT;
