-- Migration: 20260123_create_quick_assign_barcode.sql
-- Description: Gán mã vạch tức thời tại POS. Kiểm tra trùng lặp chặt chẽ. Đồng bộ logic với V13.

BEGIN;

CREATE OR REPLACE FUNCTION "public"."quick_assign_barcode"(
    "p_product_id" BIGINT,
    "p_unit_name" TEXT, -- Tên đơn vị được chọn (VD: Hộp, Vỉ...)
    "p_barcode" TEXT
) 
RETURNS "jsonb"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
    v_clean_barcode TEXT;
    v_exists BOOLEAN;
    v_retail_unit_name TEXT;
    v_is_base BOOLEAN;
    v_updated_unit_id BIGINT;
BEGIN
    -- 1. Chuẩn hóa dữ liệu đầu vào
    v_clean_barcode := TRIM(p_barcode);
    
    IF v_clean_barcode IS NULL OR v_clean_barcode = '' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mã vạch không được để trống!');
    END IF;

    -- 2. KIỂM TRA TRÙNG LẶP (Duplicate Check)
    -- Check 1: Trùng trong bảng đơn vị (của sản phẩm KHÁC)
    SELECT EXISTS(SELECT 1 FROM product_units WHERE barcode = v_clean_barcode AND product_id <> p_product_id)
    INTO v_exists;
    
    IF v_exists THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mã vạch này [' || v_clean_barcode || '] đang thuộc về một sản phẩm khác!');
    END IF;

    -- Check 2: Trùng trong bảng sản phẩm gốc (của sản phẩm KHÁC)
    SELECT EXISTS(SELECT 1 FROM products WHERE barcode = v_clean_barcode AND id <> p_product_id)
    INTO v_exists;

    IF v_exists THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mã vạch này [' || v_clean_barcode || '] đang là mã chính của sản phẩm khác!');
    END IF;

    -- 3. Lấy thông tin cấu hình của sản phẩm hiện tại
    SELECT retail_unit 
    INTO v_retail_unit_name
    FROM public.products WHERE id = p_product_id;

    -- 4. CẬP NHẬT BẢNG CON (Product Units)
    UPDATE public.product_units
    SET barcode = v_clean_barcode, 
        updated_at = NOW()
    WHERE product_id = p_product_id AND unit_name = p_unit_name
    RETURNING id, is_base INTO v_updated_unit_id, v_is_base;

    IF v_updated_unit_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy đơn vị ' || p_unit_name || ' trong sản phẩm này!');
    END IF;

    -- 5. ĐỒNG BỘ BẢNG CHA (Products) - Logic nhất quán với V13
    -- Nếu đơn vị vừa gán là Đơn vị Lẻ (Retail) HOẶC là Base -> Update luôn mã cha
    IF p_unit_name = v_retail_unit_name OR v_is_base = true THEN
        UPDATE public.products 
        SET barcode = v_clean_barcode, updated_at = NOW() 
        WHERE id = p_product_id;
    END IF;

    -- 6. TRẢ VỀ DỮ LIỆU (Để FE auto-add vào giỏ hàng)
    -- Trả về đúng cấu trúc mà POS cần
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Đã gán mã vạch thành công!',
        'data', (
            SELECT jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'sku', p.sku,
                'unit', p_unit_name, -- Đơn vị vừa gán
                'barcode', v_clean_barcode,
                'price', (SELECT price_sell FROM product_units WHERE id = v_updated_unit_id)
            )
            FROM public.products p
            WHERE p.id = p_product_id
        )
    );
END;
$$;

COMMIT;
