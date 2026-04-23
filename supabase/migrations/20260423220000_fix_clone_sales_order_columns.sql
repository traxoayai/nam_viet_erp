-- Hotfix: clone_sales_order — 3 column names sai + return type sai
-- ============================================================================
-- BUG:
--   Migration 20260423160000 (catalog_and_clone_no_flashsale) DROP clone_sales_order
--   rồi recreate với 3 tên column KHÔNG tồn tại trong bảng public.orders:
--     - user_id           → actual: creator_id
--     - total_paid        → actual: paid_amount
--     - approval_status   → actual: remittance_status
--   Và đổi RETURN từ jsonb -> uuid, nhưng FE (B2BOrderListPage.tsx:321)
--   đọc {success, new_code, new_order_id} → không chạy sang được trang đơn mới.
--
-- FIX:
--   - Giữ intent của bản 20260423160000: refresh price = wholesale gốc
--     (KHÔNG bake Flash Sale discount vào đơn clone)
--   - Khôi phục column names + return shape khớp remote_schema (20260422030847)
--   - DROP cả 2 overload (uuid, jsonb) trước khi CREATE để không bị overload conflict
-- Date: 2026-04-23
-- ============================================================================

BEGIN;

-- 1. Xoá mọi overload hiện có (uuid return và jsonb return)
DROP FUNCTION IF EXISTS public.clone_sales_order(uuid);

-- 2. Re-create: jsonb return + column names đúng + no-flash-sale refresh price
CREATE OR REPLACE FUNCTION public.clone_sales_order(p_old_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_old_order RECORD;
    v_new_order_id UUID;
    v_new_code TEXT;
    v_prefix TEXT;
    v_item RECORD;
    v_current_price NUMERIC;
    v_total_amount NUMERIC := 0;
    v_final_amount NUMERIC;
BEGIN
    -- 1. Fetch old order
    SELECT * INTO v_old_order FROM public.orders WHERE id = p_old_order_id;
    IF v_old_order IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy đơn hàng gốc để nhân bản.';
    END IF;

    -- 2. Generate new code (POS- hoặc SO-)
    IF v_old_order.order_type = 'POS' THEN
        v_prefix := 'POS-';
    ELSE
        v_prefix := 'SO-';
    END IF;
    v_new_code := v_prefix || to_char(now(), 'YYMMDD') || '-' || LPAD(floor(random() * 10000)::text, 4, '0');

    -- 3. Insert header (amounts recalculated ở bước 5; column names KHỚP schema)
    INSERT INTO public.orders (
        code, order_type, customer_id, customer_b2c_id, warehouse_id,
        delivery_address, delivery_time, delivery_method, shipping_partner_id,
        shipping_fee, discount_amount, total_amount, final_amount,
        status, payment_status, payment_method, remittance_status, paid_amount,
        note, creator_id, created_at, updated_at
    ) VALUES (
        v_new_code, v_old_order.order_type, v_old_order.customer_id, v_old_order.customer_b2c_id, v_old_order.warehouse_id,
        v_old_order.delivery_address, v_old_order.delivery_time, v_old_order.delivery_method, v_old_order.shipping_partner_id,
        v_old_order.shipping_fee, 0, 0, 0,
        'DRAFT', 'unpaid', v_old_order.payment_method,
        CASE WHEN v_old_order.payment_method = 'cash' THEN 'pending' ELSE 'skipped' END,
        0,
        COALESCE(v_old_order.note, '') || E'\n(Nhân bản từ đơn: ' || v_old_order.code || ')',
        auth.uid(), NOW(), NOW()
    ) RETURNING id INTO v_new_order_id;

    -- 4. Copy items WITH REFRESHED WHOLESALE PRICE (KHÔNG áp Flash Sale deal)
    --    Intent từ 20260423160000: khách chọn voucher ở checkout, không bake
    --    discount vào unit_price.
    FOR v_item IN
        SELECT product_id, uom, conversion_factor, quantity, unit_price,
               discount, is_gift, note
        FROM public.order_items
        WHERE order_id = p_old_order_id
    LOOP
        SELECT COALESCE(
            (SELECT pu.price_sell FROM public.product_units pu
             WHERE pu.product_id = v_item.product_id AND pu.unit_type = 'wholesale' AND pu.price_sell > 0 LIMIT 1),
            (SELECT pu.price_sell FROM public.product_units pu
             WHERE pu.product_id = v_item.product_id AND pu.price_sell > 0 LIMIT 1),
            v_item.unit_price  -- fallback giá cũ nếu product không có units
        ) INTO v_current_price;

        INSERT INTO public.order_items (
            order_id, product_id, uom, conversion_factor, quantity, unit_price,
            discount, is_gift, note, quantity_picked, quantity_returned
        ) VALUES (
            v_new_order_id, v_item.product_id, v_item.uom, v_item.conversion_factor, v_item.quantity,
            v_current_price,
            v_item.discount, v_item.is_gift, v_item.note, 0, 0
        );

        v_total_amount := v_total_amount + (v_item.quantity * v_current_price);
    END LOOP;

    -- 5. Update totals
    v_final_amount := v_total_amount + COALESCE(v_old_order.shipping_fee, 0);

    UPDATE public.orders
    SET total_amount = v_total_amount,
        final_amount = v_final_amount
    WHERE id = v_new_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Đã tạo bản sao thành công!',
        'new_order_id', v_new_order_id,
        'new_code', v_new_code
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.clone_sales_order(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
