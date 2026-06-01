-- Migration: add_formatted_monthly_sales
-- Description: Adds format_product_quantity function and updates product_monthly_sales_view

-- 1. Create function format_product_quantity
CREATE OR REPLACE FUNCTION format_product_quantity(p_qty numeric, p_product_id bigint)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    v_result text := '';
    v_rem numeric := p_qty;
    v_unit record;
    v_unit_qty int;
    v_base_unit_name text;
BEGIN
    IF p_qty IS NULL OR p_qty = 0 THEN
        RETURN NULL; -- Nullable theo yêu cầu
    END IF;

    -- Lấy danh sách các đơn vị, sắp xếp theo tỷ lệ chuyển đổi giảm dần
    FOR v_unit IN 
        SELECT unit_name, conversion_rate 
        FROM product_units 
        WHERE product_id = p_product_id 
          AND conversion_rate IS NOT NULL
          AND conversion_rate > 0
        ORDER BY conversion_rate DESC
    LOOP
        IF v_rem >= v_unit.conversion_rate THEN
            v_unit_qty := floor(v_rem / v_unit.conversion_rate);
            v_rem := v_rem - (v_unit_qty * v_unit.conversion_rate);
            
            IF v_result != '' THEN
                v_result := v_result || ' ';
            END IF;
            v_result := v_result || v_unit_qty::text || ' ' || v_unit.unit_name;
        END IF;
    END LOOP;

    -- Xử lý phần dư không tròn một đơn vị nào
    IF v_rem > 0 THEN
        IF v_result != '' THEN
            v_result := v_result || ' ';
        END IF;
        
        -- Thử tìm đơn vị cơ sở (conversion_rate = 1 hoặc is_base = true)
        SELECT unit_name INTO v_base_unit_name FROM product_units
        WHERE product_id = p_product_id AND is_base = true
        LIMIT 1;

        IF FOUND AND v_base_unit_name IS NOT NULL THEN
             v_result := v_result || v_rem::text || ' ' || v_base_unit_name;
        ELSE
             v_result := v_result || v_rem::text;
        END IF;
    END IF;

    IF v_result = '' THEN
        RETURN p_qty::text;
    END IF;

    RETURN v_result;
END;
$$;

-- 2. Update view product_monthly_sales_view
-- NOTE: Dùng CREATE OR REPLACE VIEW (PostgreSQL chấp nhận khi cột mới được APPEND ở cuối).
-- Cột cũ: product_id, monthly_sales_qty -> cột mới thêm formatted_monthly_sales_qty ở cuối.
-- TUYỆT ĐỐI KHÔNG DROP ... CASCADE: sẽ âm thầm phá dependents (RPC, edge function
-- search-products-po, generated types, downstream views) mà không cảnh báo. Bọc trong
-- BEGIN/COMMIT để atomic giữa create function (ở trên) và view; nếu fail thì rollback
-- toàn bộ, PostgREST không thấy state nửa vời.
BEGIN;

CREATE OR REPLACE VIEW product_monthly_sales_view AS
SELECT
  p.id AS product_id,
  COALESCE(SUM(oi.quantity), 0) AS monthly_sales_qty,
  format_product_quantity(COALESCE(SUM(oi.quantity), 0), p.id) AS formatted_monthly_sales_qty
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id
  AND o.created_at >= NOW() - INTERVAL '30 days'
  AND o.status NOT IN ('cancelled', 'draft')
GROUP BY p.id;

-- Cấp quyền tường minh cho PostgREST clients (anon / authenticated) để route đọc được
-- view sau khi recreate; view không tự kế thừa quyền nếu owner khác.
GRANT SELECT ON product_monthly_sales_view TO anon, authenticated, service_role;

COMMIT;

-- Reload PostgREST schema cache để cột mới formatted_monthly_sales_qty khả dụng ngay,
-- không phải chờ pgrst tự refresh.
NOTIFY pgrst, 'reload schema';
