-- Migration: 20260121_fix_bulk_price_update_v2.sql
BEGIN;

CREATE OR REPLACE FUNCTION "public"."bulk_update_product_prices"(
    "p_data" jsonb 
    -- Format: [
    --   {
    --     product_id: 1, 
    --     actual_cost: 1000,          (Giá vốn gốc 1 viên)
    --     retail_price: 1500,         (Giá bán lẻ 1 viên/vỉ)
    --     wholesale_price: 15000,     (Giá bán buôn 1 hộp)
    --     retail_margin: 50,          (Số liệu để hiển thị lại UI)
    --     retail_margin_type: '%',
    --     wholesale_margin: 10,
    --     wholesale_margin_type: 'amount'
    --   }, ...
    -- ]
) 
RETURNS "void"
LANGUAGE "plpgsql" SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item jsonb;
    v_product_id BIGINT;
    v_new_base_cost NUMERIC;
    v_retail_price NUMERIC;
    v_wholesale_price NUMERIC;
    
    v_wholesale_unit_name TEXT;
    v_retail_unit_name TEXT;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(p_data)
    LOOP
        v_product_id := (item->>'product_id')::BIGINT;
        v_new_base_cost := COALESCE((item->>'actual_cost')::NUMERIC, 0);
        v_retail_price := COALESCE((item->>'retail_price')::NUMERIC, 0);
        v_wholesale_price := COALESCE((item->>'wholesale_price')::NUMERIC, 0);

        -- 1. Lấy thông tin đơn vị mặc định
        SELECT wholesale_unit, retail_unit 
        INTO v_wholesale_unit_name, v_retail_unit_name
        FROM public.products WHERE id = v_product_id;

        -- 2. CẬP NHẬT BẢNG PRODUCTS (Lưu cả Giá Vốn và Cấu hình Margin để hiển thị lại)
        UPDATE public.products 
        SET actual_cost = v_new_base_cost,
            retail_margin_value = COALESCE((item->>'retail_margin')::NUMERIC, 0),
            retail_margin_type = COALESCE(item->>'retail_margin_type', 'amount'),
            wholesale_margin_value = COALESCE((item->>'wholesale_margin')::NUMERIC, 0),
            wholesale_margin_type = COALESCE(item->>'wholesale_margin_type', 'amount'),
            updated_at = NOW()
        WHERE id = v_product_id;

        -- 3. ĐỒNG BỘ GIÁ VỐN CHO TẤT CẢ ĐƠN VỊ (Price Cost = Base Cost * Rate)
        UPDATE public.product_units
        SET price_cost = v_new_base_cost * conversion_rate,
            updated_at = NOW()
        WHERE product_id = v_product_id;

        -- 4. CẬP NHẬT GIÁ BÁN LẺ (Cho unit trùng tên với Retail Unit hoặc là Base)
        UPDATE public.product_units
        SET price_sell = v_retail_price,
            updated_at = NOW()
        WHERE product_id = v_product_id 
          AND (unit_name = v_retail_unit_name OR is_base = true);

        -- 5. CẬP NHẬT GIÁ BÁN BUÔN (Cho unit trùng tên với Wholesale Unit)
        IF v_wholesale_price > 0 THEN
            UPDATE public.product_units
            SET price_sell = v_wholesale_price,
                updated_at = NOW()
            WHERE product_id = v_product_id 
              AND unit_name = v_wholesale_unit_name;
        END IF;

        -- [BONUS] TỰ ĐỘNG TÍNH GIÁ CHO CÁC ĐƠN VỊ KHÁC (Tránh bán lỗ)
        -- Logic: Các đơn vị còn lại (không phải lẻ, không phải sỉ chính) sẽ có giá bán = Giá Lẻ * Hệ số
        -- (Để an toàn, ta set giá bán của chúng dựa trên giá lẻ, trừ khi chúng đã được set giá sỉ riêng)
        UPDATE public.product_units
        SET price_sell = v_retail_price * conversion_rate,
            updated_at = NOW()
        WHERE product_id = v_product_id 
          AND unit_name <> v_retail_unit_name 
          AND unit_name <> v_wholesale_unit_name
          AND price_sell = 0; -- Chỉ update nếu chưa có giá (để tránh ghi đè cấu hình tay cũ)

    END LOOP;
END;
$$;

COMMIT;