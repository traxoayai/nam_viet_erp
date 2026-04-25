-- Harden update_sales_order: đồng bộ với create_sales_order hotfix 20260425060000
-- ============================================================================
-- BUG CRITICAL (3 vấn đề):
-- 1. v_conversion_factor INTEGER → truncate decimal conversion_rate (ví dụ 1.5 → 1).
--    Fix: đổi sang NUMERIC, dùng _resolve_conversion_factor_strict() thay vì
--    SELECT/COALESCE=1 silent.
-- 2. Thiếu PERFORM check_rpc_access('update_sales_order') → bypass auth gate.
-- 3. Thiếu _check_b2b_credit_exposure khi update B2B → khách B2B có thể vượt
--    credit limit bằng cách edit đơn thay vì tạo mới.
--
-- Tổng tiền (v_total_amount trừ line discount) đã đúng trong gốc — giữ nguyên.
-- Merge-not-replace: giữ toàn bộ logic delete-old-insert-new, header update,
-- status guard. Chỉ thêm 3 patch nhỏ mô tả ở trên.
--
-- Date: 2026-04-25
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.update_sales_order(
    "p_order_id" uuid,
    "p_customer_id" bigint,
    "p_delivery_address" text,
    "p_delivery_time" text,
    "p_note" text,
    "p_discount_amount" numeric,
    "p_shipping_fee" numeric,
    "p_items" jsonb,
    "p_status" text DEFAULT 'DRAFT'::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
    v_current_status TEXT;
    v_item JSONB;
    v_total_amount NUMERIC := 0;
    v_final_amount NUMERIC := 0;
    v_conversion_factor NUMERIC;     -- [FIX] INTEGER → NUMERIC (tránh truncate decimal)
    v_final_b2b_id BIGINT;           -- [ADD] dùng cho credit exposure check
    v_safe_order_type TEXT;          -- [ADD] dùng cho credit exposure check
BEGIN
    -- [ADD] Kiểm tra quyền truy cập RPC (đồng bộ với create_sales_order)
    PERFORM public.check_rpc_access('update_sales_order');

    -- 1. Kiểm tra quyền sửa (Chỉ cho sửa khi còn Nháp/Báo giá)
    SELECT status INTO v_current_status FROM public.orders WHERE id = p_order_id;

    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Đơn hàng không tồn tại.';
    END IF;

    IF v_current_status != 'DRAFT' AND v_current_status != 'QUOTE' THEN
        RAISE EXCEPTION 'Không thể sửa đơn hàng này (Trạng thái hiện tại: %)', v_current_status;
    END IF;

    -- [ADD] Lấy thông tin B2B và order_type từ đơn hiện tại để credit check
    SELECT customer_id, order_type
    INTO v_final_b2b_id, v_safe_order_type
    FROM public.orders
    WHERE id = p_order_id;

    -- Nếu caller truyền p_customer_id mới thì ưu tiên dùng (update khách)
    IF p_customer_id IS NOT NULL THEN
        v_final_b2b_id := p_customer_id;
    END IF;

    -- 2. Update Header (Thông tin chung)
    UPDATE public.orders
    SET
        customer_id = p_customer_id, -- Cập nhật khách hàng (B2B)
        delivery_address = p_delivery_address,
        delivery_time = p_delivery_time,
        note = p_note,
        discount_amount = COALESCE(p_discount_amount, 0),
        shipping_fee = COALESCE(p_shipping_fee, 0),
        status = p_status,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 3. Update Items (Chiến thuật: Xóa cũ -> Thêm mới)
    DELETE FROM public.order_items WHERE order_id = p_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- [FIX] Dùng _resolve_conversion_factor_strict thay vì SELECT/COALESCE=1 silent
        v_conversion_factor := public._resolve_conversion_factor_strict(
            (v_item->>'product_id')::BIGINT,
            v_item->>'uom',
            COALESCE((v_item->>'conversion_factor')::NUMERIC, 0)
        );

        -- Insert dòng mới
        INSERT INTO public.order_items (
            order_id, product_id, quantity, uom, conversion_factor,
            unit_price, discount, is_gift, note
        ) VALUES (
            p_order_id,
            (v_item->>'product_id')::BIGINT,
            (v_item->>'quantity')::NUMERIC,
            v_item->>'uom',
            v_conversion_factor,
            (v_item->>'unit_price')::NUMERIC,
            COALESCE((v_item->>'discount')::NUMERIC, 0),
            COALESCE((v_item->>'is_gift')::BOOLEAN, false),
            (v_item->>'note') -- [Optional] Ghi chú từng dòng
        );

        -- Cộng dồn tổng tiền (trừ line-level discount, đồng bộ create_sales_order)
        v_total_amount := v_total_amount
            + ((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC)
            - GREATEST(COALESCE((v_item->>'discount')::NUMERIC, 0), 0);
    END LOOP;

    -- 4. Tính lại Tổng tiền cuối cùng (Final Amount)
    v_final_amount := v_total_amount - COALESCE(p_discount_amount, 0) + COALESCE(p_shipping_fee, 0);
    IF v_final_amount < 0 THEN v_final_amount := 0; END IF;

    -- [ADD] Kiểm tra credit limit B2B trước khi lưu (đồng bộ create_sales_order)
    IF v_final_b2b_id IS NOT NULL THEN
        PERFORM public._check_b2b_credit_exposure(v_final_b2b_id, v_safe_order_type, v_final_amount);
    END IF;

    -- Update lại số tiền vào Header
    UPDATE public.orders
    SET total_amount = v_total_amount, final_amount = v_final_amount
    WHERE id = p_order_id;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
