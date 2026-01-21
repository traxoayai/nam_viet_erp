-- Migration: 20260121_create_bulk_price_update.sql
-- Description: Cập nhật giá hàng loạt thông minh, tự động đồng bộ giá vốn theo hệ số quy đổi.

BEGIN;

CREATE OR REPLACE FUNCTION "public"."bulk_update_product_prices"(
    "p_data" jsonb 
    -- Format: [{product_id: 1, actual_cost: 1000, retail_price: 1500, wholesale_price: 14000}, ...]
) 
RETURNS "void"
LANGUAGE "plpgsql" SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item jsonb;
    v_product_id BIGINT;
    v_new_cost NUMERIC;
    v_retail_price NUMERIC;
    v_wholesale_price NUMERIC;
    
    v_wholesale_unit_name TEXT;
    v_retail_unit_name TEXT;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(p_data)
    LOOP
        v_product_id := (item->>'product_id')::BIGINT;
        v_new_cost := COALESCE((item->>'actual_cost')::NUMERIC, 0);
        v_retail_price := COALESCE((item->>'retail_price')::NUMERIC, 0);
        v_wholesale_price := COALESCE((item->>'wholesale_price')::NUMERIC, 0);

        -- 1. Lấy thông tin đơn vị mặc định của sản phẩm
        SELECT wholesale_unit, retail_unit 
        INTO v_wholesale_unit_name, v_retail_unit_name
        FROM public.products WHERE id = v_product_id;

        -- 2. Cập nhật Giá Vốn vào bảng PRODUCTS
        UPDATE public.products 
        SET actual_cost = v_new_cost,
            updated_at = NOW()
        WHERE id = v_product_id;

        -- 3. [SMART] Đồng bộ Giá Vốn cho TẤT CẢ đơn vị (price_cost = base_cost * conversion_rate)
        -- Điều này đảm bảo khi bán đơn vị nào thì lãi gộp cũng tính đúng trên nền tảng giá vốn mới.
        UPDATE public.product_units
        SET price_cost = v_new_cost * conversion_rate,
            updated_at = NOW()
        WHERE product_id = v_product_id;

        -- 4. Cập nhật Giá Bán Lẻ (cho đơn vị Retail Unit)
        -- Tìm đơn vị có tên trùng với retail_unit của sản phẩm
        UPDATE public.product_units
        SET price_sell = v_retail_price,
            updated_at = NOW()
        WHERE product_id = v_product_id 
          AND unit_name = v_retail_unit_name;

        -- 5. Cập nhật Giá Bán Buôn (cho đơn vị Wholesale Unit)
        -- Tìm đơn vị có tên trùng với wholesale_unit của sản phẩm
        IF v_wholesale_price > 0 THEN
            UPDATE public.product_units
            SET price_sell = v_wholesale_price,
                updated_at = NOW()
            WHERE product_id = v_product_id 
              AND unit_name = v_wholesale_unit_name;
        END IF;

    END LOOP;
END;
$$;

COMMIT;