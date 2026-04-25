-- Migration: verify_promotion_code thêm FOR UPDATE lock để tránh race condition
-- ============================================================================
-- BUG: create_sales_order và update_sales_order gọi verify_promotion_code
--      rồi increment usage_count không có lock → concurrent requests có thể
--      cùng pass check (usage_count < total_usage_limit) rồi cùng increment
--      → vượt giới hạn sử dụng voucher.
-- FIX: SELECT ... FOR UPDATE sớm trong function, trước khi check usage_count.
--      Postgres sẽ block transaction thứ 2 tại SELECT đến khi transaction
--      thứ nhất COMMIT → serialized check + increment.
-- Date: 2026-04-25
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION "public"."verify_promotion_code"(
    "p_code" "text",
    "p_customer_id" bigint,
    "p_order_value" numeric
) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_promo RECORD;
    v_user_usage_count INTEGER;
    v_discount_amount NUMERIC := 0;
BEGIN
    -- [CHANGED] SELECT FOR UPDATE sớm để lock row trước khi check usage_count.
    -- Serializes concurrent verify calls → ngăn race condition vượt quota.
    SELECT * INTO v_promo
    FROM public.promotions
    WHERE code = p_code
    FOR UPDATE;

    -- Các bước kiểm tra cơ bản
    IF v_promo IS NULL THEN
        RETURN json_build_object('valid', false, 'message', 'Mã không tồn tại.');
    END IF;
    IF v_promo.status <> 'active' THEN
        RETURN json_build_object('valid', false, 'message', 'Mã ngưng hoạt động.');
    END IF;
    IF now() < v_promo.valid_from OR now() > v_promo.valid_to THEN
        RETURN json_build_object('valid', false, 'message', 'Mã hết hạn.');
    END IF;
    -- [CHANGED] Dùng row đã locked (v_promo) để check usage — không đọc lại DB
    IF v_promo.total_usage_limit IS NOT NULL AND v_promo.usage_count >= v_promo.total_usage_limit THEN
        RETURN json_build_object('valid', false, 'message', 'Mã đã hết lượt toàn sàn.');
    END IF;
    IF p_order_value < v_promo.min_order_value THEN
        RETURN json_build_object('valid', false, 'message', 'Chưa đạt giá trị đơn hàng tối thiểu.');
    END IF;

    -- Kiểm tra sở hữu (Nếu là mã riêng)
    IF v_promo.type IN ('personal', 'point_exchange')
       AND v_promo.customer_id IS NOT NULL
       AND v_promo.customer_id <> p_customer_id
    THEN
        RETURN json_build_object('valid', false, 'message', 'Mã này không áp dụng cho tài khoản của bạn.');
    END IF;

    -- Kiểm tra giới hạn số lần dùng của người này
    SELECT count(*) INTO v_user_usage_count
    FROM public.promotion_usages
    WHERE promotion_id = v_promo.id AND customer_id = p_customer_id;

    IF v_promo.usage_limit_per_user IS NOT NULL AND v_user_usage_count >= v_promo.usage_limit_per_user THEN
        RETURN json_build_object('valid', false, 'message', 'Bạn đã dùng hết số lần cho phép của mã này.');
    END IF;

    -- Tính toán tiền giảm
    IF v_promo.discount_type = 'fixed' THEN
        v_discount_amount := v_promo.discount_value;
    ELSE
        v_discount_amount := (p_order_value * v_promo.discount_value) / 100;
        IF v_promo.max_discount_value IS NOT NULL AND v_discount_amount > v_promo.max_discount_value THEN
            v_discount_amount := v_promo.max_discount_value;
        END IF;
    END IF;

    IF v_discount_amount > p_order_value THEN v_discount_amount := p_order_value; END IF;

    RETURN json_build_object(
        'valid', true,
        'message', 'Áp dụng thành công!',
        'discount_amount', v_discount_amount,
        'promotion', row_to_json(v_promo)
    );
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
