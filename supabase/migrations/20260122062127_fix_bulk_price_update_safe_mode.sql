-- Migration: 20260121_fix_bulk_price_update_safe_mode.sql
-- Description: Cập nhật giá thông minh (Safe Mode): Nếu input NULL thì giữ nguyên giá trị cũ trong DB.

BEGIN;

CREATE OR REPLACE FUNCTION "public"."bulk_update_product_prices"(
    "p_data" jsonb 
) 
RETURNS "void"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
    item jsonb;
    v_product_id BIGINT;
    
    -- Biến lưu giá trị CŨ trong DB
    v_old_cost NUMERIC;
    v_old_retail_margin_val NUMERIC;
    v_old_retail_margin_type TEXT;
    v_old_wholesale_margin_val NUMERIC;
    v_old_wholesale_margin_type TEXT;
    v_wholesale_unit_name TEXT;
    v_retail_unit_name TEXT;

    -- Biến lưu giá trị MỚI (Sau khi merge)
    v_final_cost NUMERIC;
    v_final_retail_price NUMERIC;
    v_final_wholesale_price NUMERIC;
    
    -- Biến tạm để check input
    v_input_retail_price NUMERIC;
    v_input_wholesale_price NUMERIC;

BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(p_data)
    LOOP
        v_product_id := (item->>'product_id')::BIGINT;

        -- 1. Lấy dữ liệu CŨ từ Database (Snapshot hiện tại)
        SELECT 
            actual_cost, 
            retail_margin_value, retail_margin_type,
            wholesale_margin_value, wholesale_margin_type,
            wholesale_unit, retail_unit
        INTO 
            v_old_cost, 
            v_old_retail_margin_val, v_old_retail_margin_type,
            v_old_wholesale_margin_val, v_old_wholesale_margin_type,
            v_wholesale_unit_name, v_retail_unit_name
        FROM public.products 
        WHERE id = v_product_id;

        -- 2. TÍNH TOÁN GIÁ TRỊ CUỐI CÙNG (Merge Input vs Old Data)
        -- Logic: Nếu Input IS NOT NULL thì lấy Input, ngược lại lấy Old Data
        
        v_final_cost := COALESCE((item->>'actual_cost')::NUMERIC, v_old_cost, 0);
        
        -- Các trường Margin
        -- Lưu ý: Type cần COALESCE cẩn thận để tránh lỗi NULL
        
        -- 3. CẬP NHẬT BẢNG PRODUCTS (Chỉ update những gì thay đổi hoặc giữ nguyên cái cũ)
        UPDATE public.products 
        SET 
            actual_cost = v_final_cost,
            
            retail_margin_value = COALESCE((item->>'retail_margin')::NUMERIC, v_old_retail_margin_val, 0),
            retail_margin_type = COALESCE(item->>'retail_margin_type', v_old_retail_margin_type, 'amount'),
            
            wholesale_margin_value = COALESCE((item->>'wholesale_margin')::NUMERIC, v_old_wholesale_margin_val, 0),
            wholesale_margin_type = COALESCE(item->>'wholesale_margin_type', v_old_wholesale_margin_type, 'amount'),
            
            updated_at = NOW()
        WHERE id = v_product_id;

        -- 4. ĐỒNG BỘ GIÁ VỐN CHO TẤT CẢ ĐƠN VỊ (Nếu giá vốn thay đổi)
        -- Luôn chạy cái này để đảm bảo nhất quán
        UPDATE public.product_units
        SET price_cost = v_final_cost * conversion_rate,
            updated_at = NOW()
        WHERE product_id = v_product_id;

        -- 5. XỬ LÝ GIÁ BÁN (Retail Price)
        v_input_retail_price := (item->>'retail_price')::NUMERIC;
        
        -- Chỉ update giá bán lẻ nếu Frontend có gửi giá trị cụ thể
        IF v_input_retail_price IS NOT NULL THEN
            UPDATE public.product_units
            SET price_sell = v_input_retail_price,
                updated_at = NOW()
            WHERE product_id = v_product_id 
              AND (unit_name = v_retail_unit_name OR is_base = true);
              
            -- [Smart Sync] Đồng bộ giá các đơn vị phụ theo giá lẻ mới
            UPDATE public.product_units
            SET price_sell = v_input_retail_price * conversion_rate,
                updated_at = NOW()
            WHERE product_id = v_product_id 
              AND unit_name <> v_retail_unit_name 
              AND unit_name <> v_wholesale_unit_name
              AND price_sell = 0; -- Chỉ auto-fill cái chưa có giá
        END IF;

        -- 6. XỬ LÝ GIÁ BUÔN (Wholesale Price)
        v_input_wholesale_price := (item->>'wholesale_price')::NUMERIC;

        -- Chỉ update giá buôn nếu Frontend có gửi giá trị cụ thể
        IF v_input_wholesale_price IS NOT NULL AND v_input_wholesale_price > 0 THEN
            UPDATE public.product_units
            SET price_sell = v_input_wholesale_price,
                updated_at = NOW()
            WHERE product_id = v_product_id 
              AND unit_name = v_wholesale_unit_name;
        END IF;

    END LOOP;
END;
$$;

COMMIT;