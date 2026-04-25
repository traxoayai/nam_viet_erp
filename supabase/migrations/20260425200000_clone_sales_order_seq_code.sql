-- Fix clone_sales_order: thay random gen code bằng _gen_finance_tx_code(v_prefix)
-- Version mới nhất: 20260423240200_clone_preserve_fields_and_index.sql
-- 2026-04-25

BEGIN;

DROP FUNCTION IF EXISTS public.clone_sales_order(uuid);

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
    SELECT * INTO v_old_order FROM public.orders WHERE id = p_old_order_id;
    IF v_old_order IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy đơn hàng gốc để nhân bản.';
    END IF;

    IF v_old_order.order_type = 'POS' THEN
        v_prefix := 'POS';
    ELSE
        v_prefix := 'SO';
    END IF;

    -- [FIX 2026-04-25] Dùng sequence-based code thay RANDOM 4 digits để tránh collision
    v_new_code := public._gen_finance_tx_code(v_prefix);

    -- [B7] Copy tất cả column từ đơn gốc, override những cái reset
    INSERT INTO public.orders (
        code, order_type, customer_id, customer_b2c_id, warehouse_id,
        delivery_address, delivery_time, delivery_method, shipping_partner_id,
        shipping_fee, discount_amount, total_amount, final_amount,
        status, payment_status, payment_method, remittance_status, paid_amount,
        note, creator_id, created_at, updated_at,
        -- Các field mở rộng (trước đây bị mất)
        source, fee_payer, package_count,
        invoice_status, invoice_request_data,
        quote_expires_at,
        remittance_transaction_id,
        shipping_address_id, transport_vehicle_id,
        custom_vehicle_name, custom_vehicle_phone, custom_vehicle_route
    )
    SELECT
        v_new_code,
        o.order_type, o.customer_id, o.customer_b2c_id, o.warehouse_id,
        o.delivery_address, o.delivery_time, o.delivery_method, o.shipping_partner_id,
        o.shipping_fee, 0, 0, 0,    -- reset amounts
        'DRAFT', 'unpaid', o.payment_method,
        CASE WHEN o.payment_method = 'cash' THEN 'pending' ELSE 'skipped' END,
        0,
        COALESCE(o.note, '') || E'\n(Nhân bản từ đơn: ' || o.code || ')',
        auth.uid(), NOW(), NOW(),
        -- Mở rộng: preserve original
        o.source, o.fee_payer, o.package_count,
        'none'::public.invoice_request_status, NULL,  -- reset invoice vì đơn mới
        NULL,                                          -- reset quote_expires_at
        NULL,                                          -- reset remittance_transaction_id
        o.shipping_address_id, o.transport_vehicle_id,
        o.custom_vehicle_name, o.custom_vehicle_phone, o.custom_vehicle_route
    FROM public.orders o
    WHERE o.id = p_old_order_id
    RETURNING id INTO v_new_order_id;

    -- Copy items với refresh giá wholesale gốc (không bake Flash Sale)
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
            v_item.unit_price
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
