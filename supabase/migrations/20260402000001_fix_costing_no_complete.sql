-- Migration: Fix confirm_purchase_costing
-- 1. Thêm cột costing_confirmed_at để track việc đã chốt giá vốn (thay vì đổi status COMPLETED)
-- 2. RPC không đổi status = 'COMPLETED' nữa, chỉ set costing_confirmed_at
-- 3. RPC không cộng shipping fee vào final_amount

-- A. Thêm cột costing_confirmed_at
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS costing_confirmed_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.purchase_orders.costing_confirmed_at
  IS 'Thời điểm chốt giá vốn. NULL = chưa chốt. Khi đã set thì không cho chốt lại.';

-- B. Cập nhật RPC confirm_purchase_costing
DROP FUNCTION IF EXISTS public.confirm_purchase_costing(bigint, jsonb, jsonb, numeric);

CREATE OR REPLACE FUNCTION public.confirm_purchase_costing(
  p_po_id BIGINT,
  p_items_data JSONB,
  p_gifts_data JSONB,
  p_total_shipping_fee NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
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
                COALESCE(v_gift->>'code', 'GIFT-' || floor(random() * 100000)::text),
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
$fn$;

-- E. Update get_purchase_order_detail to return costing_confirmed_at
CREATE OR REPLACE FUNCTION public.get_purchase_order_detail(p_po_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT
        jsonb_build_object(
            'id', po.id,
            'code', po.code,
            'status', po.status,
            'delivery_status', po.delivery_status,
            'payment_status', po.payment_status,
            'expected_delivery_date', po.expected_delivery_date,
            'created_at', po.created_at,
            'note', po.note,
            'total_amount', po.total_amount,
            'final_amount', po.final_amount,
            'discount_amount', po.discount_amount,
            'delivery_method', po.delivery_method,
            'shipping_fee', po.shipping_fee,
            'shipping_partner_id', po.shipping_partner_id,
            'costing_confirmed_at', po.costing_confirmed_at,

            'supplier', jsonb_build_object(
                'id', s.id,
                'name', s.name,
                'phone', s.phone,
                'address', s.address,
                'tax_code', s.tax_code,
                'debt', 0
            ),

            'items', COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'key', poi.id,
                            'id', poi.id,
                            'quantity_ordered', poi.quantity_ordered,
                            'uom_ordered', poi.uom_ordered,
                            'unit_price', poi.unit_price,
                            'total_line', (poi.quantity_ordered * poi.unit_price),
                            'conversion_factor', poi.conversion_factor,
                            'base_quantity', poi.base_quantity,
                            'product_id', p.id,
                            'product_name', p.name,
                            'sku', p.sku,
                            'image_url', p.image_url,
                            'items_per_carton', p.items_per_carton,
                            'retail_unit', p.retail_unit,
                            'wholesale_unit', p.wholesale_unit
                        )
                        ORDER BY poi.id ASC
                    )
                    FROM public.purchase_order_items poi
                    JOIN public.products p ON poi.product_id = p.id
                    WHERE poi.po_id = po.id
                ),
                '[]'::jsonb
            )
        )
    INTO v_result
    FROM public.purchase_orders po
    LEFT JOIN public.suppliers s ON po.supplier_id = s.id
    WHERE po.id = p_po_id;

    IF v_result IS NULL THEN RETURN NULL; END IF;
    RETURN v_result;
END;
$$;
