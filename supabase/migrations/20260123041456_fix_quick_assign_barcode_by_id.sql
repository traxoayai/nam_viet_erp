-- Migration: 20260123_fix_quick_assign_barcode_by_id.sql
-- Description: Chuyển sang dùng Unit ID để gán mã vạch (Fix lỗi trùng tên). Đồng bộ thông minh lên bảng Products.

BEGIN;

-- 1. Drop hàm cũ (Bắt buộc vì thay đổi kiểu dữ liệu tham số từ TEXT sang BIGINT)
DROP FUNCTION IF EXISTS "public"."quick_assign_barcode"(BIGINT, TEXT, TEXT);

-- 2. Tạo hàm mới nhận Unit ID
CREATE OR REPLACE FUNCTION "public"."quick_assign_barcode"(
    "p_product_id" BIGINT,
    "p_unit_id" BIGINT, -- [CORE FIX] Dùng ID để định danh duy nhất
    "p_barcode" TEXT
) 
RETURNS "jsonb"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
    v_clean_barcode TEXT;
    v_exists BOOLEAN;
    
    -- Biến để hứng dữ liệu sau update
    v_unit_name TEXT;
    v_is_base BOOLEAN;
    v_price NUMERIC;
    
    -- Biến để check logic đồng bộ bảng cha
    v_product_retail_unit TEXT;
BEGIN
    v_clean_barcode := TRIM(p_barcode);
    
    IF v_clean_barcode IS NULL OR v_clean_barcode = '' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mã vạch không được để trống!');
    END IF;

    -- A. CHECK TRÙNG LẶP (An toàn tuyệt đối)
    -- Check 1: Trùng với Unit khác (không tính chính nó)
    SELECT EXISTS(SELECT 1 FROM product_units WHERE barcode = v_clean_barcode AND id <> p_unit_id)
    INTO v_exists;
    
    IF v_exists THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mã vạch này đang thuộc về một đơn vị khác!');
    END IF;

    -- Check 2: Trùng với Product khác
    SELECT EXISTS(SELECT 1 FROM products WHERE barcode = v_clean_barcode AND id <> p_product_id)
    INTO v_exists;

    IF v_exists THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mã vạch này đang là mã chính của sản phẩm khác!');
    END IF;

    -- B. LẤY THÔNG TIN SẢN PHẨM (Để phục vụ logic đồng bộ)
    SELECT retail_unit INTO v_product_retail_unit
    FROM products WHERE id = p_product_id;

    -- C. CẬP NHẬT BẢNG CON (Product Units) - Dùng ID
    UPDATE public.product_units
    SET barcode = v_clean_barcode, 
        updated_at = NOW()
    WHERE id = p_unit_id
    RETURNING unit_name, is_base, price_sell INTO v_unit_name, v_is_base, v_price;

    IF v_unit_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy ID đơn vị này! Có thể đã bị xóa.');
    END IF;

    -- D. ĐỒNG BỘ BẢNG CHA (Products) - Logic thông minh
    -- Cập nhật bảng cha nếu:
    -- 1. Unit vừa gán là Base (Viên)
    -- 2. HOẶC Unit vừa gán trùng tên với Retail Unit (Vỉ)
    IF v_is_base = true OR v_unit_name = v_product_retail_unit THEN
        UPDATE public.products 
        SET barcode = v_clean_barcode, updated_at = NOW() 
        WHERE id = p_product_id;
    END IF;

    -- E. TRẢ VỀ DỮ LIỆU (Để FE auto-add vào giỏ hàng)
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Đã gán mã vạch thành công!',
        'data', (
            SELECT jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'sku', p.sku,
                'unit', v_unit_name, 
                'barcode', v_clean_barcode,
                'price', v_price
            )
            FROM public.products p
            WHERE p.id = p_product_id
        )
    );
END;
$$;

COMMIT;