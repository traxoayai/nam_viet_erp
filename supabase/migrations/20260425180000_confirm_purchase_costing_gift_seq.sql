-- Fix confirm_purchase_costing: thay GIFT-random bằng _gen_finance_tx_code('GIFT')
-- Version mới nhất: 20260422030847_remote_schema.sql (đã có check_rpc_access)
-- 2026-04-25

BEGIN;

CREATE OR REPLACE FUNCTION public.confirm_purchase_costing(p_po_id bigint, p_items_data jsonb, p_gifts_data jsonb, p_total_shipping_fee numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_item JSONB;
    v_gift JSONB;
    v_supplier_id BIGINT;
    v_total_rebate NUMERIC := 0;
    v_po_code TEXT;
    v_item_total NUMERIC;
    v_final_cost_per_purchase_unit NUMERIC;
    v_actual_base_cost NUMERIC;
    v_product_id BIGINT;
    v_uom_ordered TEXT;
    v_anchor_rate NUMERIC;
    v_already_confirmed TIMESTAMPTZ;
BEGIN
    PERFORM public.check_rpc_access('confirm_purchase_costing');

    -- Check if already confirmed (chỉ cho chốt 1 lần)
    SELECT costing_confirmed_at INTO v_already_confirmed
    FROM public.purchase_orders WHERE id = p_po_id;

    IF v_already_confirmed IS NOT NULL THEN
        RAISE EXCEPTION 'Don hang nay da chot gia von luc %. Khong the chot lai.',
            to_char(v_already_confirmed, 'DD/MM/YYYY HH24:MI');
    END IF;

    SELECT supplier_id, code INTO v_supplier_id, v_po_code FROM public.purchase_orders WHERE id = p_po_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_data)
    LOOP
        v_final_cost_per_purchase_unit := COALESCE((v_item->>'final_unit_cost')::NUMERIC, 0);
        v_product_id := (v_item->>'product_id')::BIGINT;

        -- Lookup unit from PO item
        SELECT poi.uom_ordered INTO v_uom_ordered
        FROM public.purchase_order_items poi
        WHERE poi.id = (v_item->>'id')::BIGINT;

        -- Find conversion_rate
        SELECT COALESCE(pu.conversion_rate, 1) INTO v_anchor_rate
        FROM public.product_units pu
        WHERE pu.product_id = v_product_id AND pu.unit_name = v_uom_ordered
        LIMIT 1;
        v_anchor_rate := COALESCE(v_anchor_rate, 1);

        -- Base unit cost = purchase unit cost / conversion_rate
        v_actual_base_cost := v_final_cost_per_purchase_unit / v_anchor_rate;

        -- 1. Snapshot into PO Item
        UPDATE public.purchase_order_items
        SET
            final_unit_cost = v_final_cost_per_purchase_unit,
            rebate_rate = COALESCE((v_item->>'rebate_rate')::NUMERIC, 0),
            vat_rate = COALESCE((v_item->>'vat_rate')::NUMERIC, 0),
            quantity_received = COALESCE((v_item->>'quantity_received')::INTEGER, quantity_received),
            bonus_quantity = COALESCE((v_item->>'bonus_quantity')::INTEGER, 0)
        WHERE id = (v_item->>'id')::BIGINT;

        -- 2. Calculate Rebate
        SELECT (unit_price * quantity_ordered) INTO v_item_total
        FROM public.purchase_order_items WHERE id = (v_item->>'id')::BIGINT;
        v_total_rebate := v_total_rebate + (v_item_total * COALESCE((v_item->>'rebate_rate')::NUMERIC, 0) / 100.0);

        -- 3. products.actual_cost = BASE UNIT cost
        UPDATE public.products
        SET actual_cost = v_actual_base_cost, updated_at = NOW()
        WHERE id = v_product_id;

        -- 4. product_units.price_cost = base_cost * conversion_rate (per unit)
        UPDATE public.product_units
        SET price_cost = v_actual_base_cost * COALESCE(conversion_rate, 1), updated_at = NOW()
        WHERE product_id = v_product_id;
    END LOOP;

    -- B. GIFTS
    FOR v_gift IN SELECT * FROM jsonb_array_elements(p_gifts_data)
    LOOP
        IF EXISTS (SELECT 1 FROM public.promotion_gifts
                   WHERE supplier_id = v_supplier_id
                     AND ((code IS NOT NULL AND code = (v_gift->>'code')) OR name = (v_gift->>'name'))) THEN
            UPDATE public.promotion_gifts
            SET stock_quantity = stock_quantity + (v_gift->>'quantity')::INT,
                received_from_po_id = p_po_id,
                estimated_value = COALESCE((v_gift->>'estimated_value')::NUMERIC, estimated_value),
                image_url = COALESCE(v_gift->>'image_url', image_url),
                updated_at = NOW()
            WHERE supplier_id = v_supplier_id
              AND ((code IS NOT NULL AND code = (v_gift->>'code')) OR name = (v_gift->>'name'));
        ELSE
            INSERT INTO public.promotion_gifts (
                name, code, type, quantity, stock_quantity, estimated_value,
                received_from_po_id, supplier_id, status, image_url, unit_name
            ) VALUES (
                v_gift->>'name',
                -- [FIX 2026-04-25] Dùng sequence-based code thay RANDOM để tránh collision
                COALESCE(v_gift->>'code', public._gen_finance_tx_code('GIFT')),
                'other', (v_gift->>'quantity')::INT, (v_gift->>'quantity')::INT,
                COALESCE((v_gift->>'estimated_value')::NUMERIC, 0),
                p_po_id, v_supplier_id, 'active', v_gift->>'image_url',
                COALESCE(v_gift->>'unit_name', 'Cai')
            );
        END IF;
    END LOOP;

    -- C. SUPPLIER WALLET
    IF v_total_rebate > 0 THEN
        INSERT INTO public.supplier_wallets (supplier_id, balance, total_earned, updated_at)
        VALUES (v_supplier_id, v_total_rebate, v_total_rebate, NOW())
        ON CONFLICT (supplier_id)
        DO UPDATE SET
            balance = public.supplier_wallets.balance + EXCLUDED.balance,
            total_earned = public.supplier_wallets.total_earned + EXCLUDED.total_earned,
            updated_at = NOW();

        INSERT INTO public.supplier_wallet_transactions (
            supplier_id, amount, type, reference_id, description
        ) VALUES (
            v_supplier_id, v_total_rebate, 'credit', v_po_code, 'Tich luy Rebate tu don nhap ' || v_po_code
        );
    END IF;

    -- D. KHOA COSTING (KHONG doi status, KHONG cong shipping vao final_amount)
    UPDATE public.purchase_orders
    SET costing_confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_po_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Da chot gia von thanh cong. Don hang van o trang thai hien tai.',
        'rebate_earned', v_total_rebate
    );
END;
$function$
;

NOTIFY pgrst, 'reload schema';

COMMIT;
