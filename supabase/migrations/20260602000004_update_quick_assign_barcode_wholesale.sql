CREATE OR REPLACE FUNCTION public.quick_assign_barcode(p_product_id bigint, p_unit_id bigint, p_barcode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_clean_barcode TEXT;
    v_exists BOOLEAN;
    v_unit_name TEXT;
    v_is_base BOOLEAN;
    v_price NUMERIC;
    v_product_wholesale_unit TEXT;
BEGIN
    v_clean_barcode := TRIM(p_barcode);

    IF v_clean_barcode IS NULL OR v_clean_barcode = '' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mã vạch không được để trống!');
    END IF;

    -- A. CHECK DUPLICATES
    SELECT EXISTS(SELECT 1 FROM product_units WHERE barcode = v_clean_barcode AND id <> p_unit_id)
    INTO v_exists;

    IF v_exists THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mã vạch này đang thuộc về một đơn vị khác!');
    END IF;

    SELECT EXISTS(SELECT 1 FROM products WHERE barcode = v_clean_barcode AND id <> p_product_id)
    INTO v_exists;

    IF v_exists THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mã vạch này đang là mã chính của sản phẩm khác!');
    END IF;

    -- B. GET PRODUCT INFO (Lấy thông tin Wholesale Unit thay vì Retail)
    SELECT wholesale_unit INTO v_product_wholesale_unit
    FROM products WHERE id = p_product_id;

    -- C. UPDATE product_units BY ID
    UPDATE public.product_units
    SET barcode = v_clean_barcode,
        updated_at = NOW()
    WHERE id = p_unit_id
    RETURNING unit_name, is_base, price_sell INTO v_unit_name, v_is_base, v_price;

    IF v_unit_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy ID đơn vị này! Có thể đã bị xóa.');
    END IF;

    -- D. SYNC PARENT TABLE (Update parent if Wholesale OR Base)
    IF v_is_base = true OR v_unit_name = v_product_wholesale_unit THEN
        UPDATE public.products
        SET barcode = v_clean_barcode, updated_at = NOW()
        WHERE id = p_product_id;
    END IF;

    -- E. RETURN DATA
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
            FROM products p WHERE p.id = p_product_id
        )
    );
END;
$function$;
