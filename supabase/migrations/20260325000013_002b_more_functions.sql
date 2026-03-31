

-- =====================================================
-- SECTION 5: Stock/Inventory Functions
-- =====================================================

-- DROP functions whose return types changed (CREATE OR REPLACE cannot change return type)
DROP FUNCTION IF EXISTS public.bulk_update_product_barcodes(jsonb);
DROP FUNCTION IF EXISTS public.quick_assign_barcode(bigint, text, text);
DROP FUNCTION IF EXISTS public.quick_assign_barcode(bigint, bigint, text);
DROP FUNCTION IF EXISTS public.get_purchase_orders_master(integer, integer, text, text, text, timestamp with time zone, timestamp with time zone);
DROP FUNCTION IF EXISTS public.match_products_from_excel(jsonb);
DROP FUNCTION IF EXISTS public.delete_purchase_order(bigint);
DROP FUNCTION IF EXISTS public.confirm_purchase_costing(bigint, jsonb, jsonb, numeric);

-- 5a. bulk_update_product_barcodes (FINAL from 007 line 13)
CREATE OR REPLACE FUNCTION public.bulk_update_product_barcodes(p_data JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
    item jsonb;
    v_product_id BIGINT;
    v_base_barcode TEXT;
    v_wholesale_barcode TEXT;
    v_wholesale_unit_name TEXT;
    v_retail_unit_name TEXT;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(p_data)
    LOOP
        v_product_id := (item->>'product_id')::BIGINT;
        v_base_barcode := trim(item->>'base_barcode');
        v_wholesale_barcode := trim(item->>'wholesale_barcode');

        -- 1. Get Unit Names for context
        SELECT wholesale_unit, retail_unit
        INTO v_wholesale_unit_name, v_retail_unit_name
        FROM public.products WHERE id = v_product_id;

        -- 2. Update Retail/Base Barcode
        IF v_base_barcode IS NOT NULL THEN
            UPDATE public.product_units
            SET barcode = v_base_barcode,
                updated_at = NOW()
            WHERE product_id = v_product_id
              AND (is_base = true OR unit_name = v_retail_unit_name OR unit_type = 'retail');
        END IF;

        -- 3. Update Wholesale Barcode
        IF v_wholesale_barcode IS NOT NULL THEN
             UPDATE public.product_units
            SET barcode = v_wholesale_barcode,
                updated_at = NOW()
            WHERE product_id = v_product_id
              AND (unit_name = v_wholesale_unit_name OR unit_type = 'wholesale')
              AND is_base = false;
        END IF;

    END LOOP;
END;
$fn$;


-- 5b. quick_assign_barcode (FINAL from 007 line 152 - canonical BIGINT version)
CREATE OR REPLACE FUNCTION public.quick_assign_barcode(
    p_product_id BIGINT,
    p_unit_id BIGINT,
    p_barcode TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
    v_clean_barcode TEXT;
    v_exists BOOLEAN;
    v_unit_name TEXT;
    v_is_base BOOLEAN;
    v_price NUMERIC;
    v_product_retail_unit TEXT;
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

    -- B. GET PRODUCT INFO
    SELECT retail_unit INTO v_product_retail_unit
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

    -- D. SYNC PARENT TABLE
    IF v_is_base = true OR v_unit_name = v_product_retail_unit THEN
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
            FROM public.products p
            WHERE p.id = p_product_id
        )
    );
END;
$fn$;


-- 5c. get_active_shipping_partners (FINAL from 007 line 246 - fixed ambiguous column)
CREATE OR REPLACE FUNCTION public.get_active_shipping_partners()
RETURNS TABLE(id bigint, name text, phone text, contact_person text, speed_hours integer, base_fee numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
BEGIN
    RETURN QUERY
    SELECT
        sp.id, sp.name, sp.phone, sp.contact_person,
        COALESCE((SELECT sr.speed_hours FROM public.shipping_rules sr WHERE sr.partner_id = sp.id LIMIT 1), 24) as speed_hours,
        COALESCE((SELECT sr.fee FROM public.shipping_rules sr WHERE sr.partner_id = sp.id LIMIT 1), 0) as base_fee
    FROM public.shipping_partners sp
    WHERE sp.status = 'active';
END;
$fn$;


-- =====================================================
-- SECTION 6: Purchase Order Functions
-- =====================================================

-- 6a. confirm_purchase_costing (FINAL from 008 line 225 with SET search_path)
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
BEGIN
    PERFORM public.check_rpc_access('confirm_purchase_costing');

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
                COALESCE(v_gift->>'unit_name', 'Cái')
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

    -- D. COMPLETE PO
    UPDATE public.purchase_orders
    SET status = 'COMPLETED',
        final_amount = final_amount + COALESCE(p_total_shipping_fee, 0),
        updated_at = NOW()
    WHERE id = p_po_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Da cap nhat gia von thanh cong.',
        'rebate_earned', v_total_rebate
    );
END;
$fn$;


-- 6b. cancel_purchase_order (from 008 line 156)
CREATE OR REPLACE FUNCTION public.cancel_purchase_order(p_po_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
BEGIN
  PERFORM public.check_rpc_access('cancel_purchase_order');

  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_orders
    WHERE id = p_po_id AND status IN ('DRAFT', 'NEW', 'APPROVED', 'ORDERING')
  ) THEN
    RAISE EXCEPTION 'Khong the huy don hang: Don khong ton tai hoac da hoan thanh/da huy.';
  END IF;

  UPDATE public.purchase_orders
  SET status = 'CANCELLED',
      updated_at = NOW()
  WHERE id = p_po_id;
END;
$fn$;


-- 6c. delete_purchase_order (FINAL from 008 line 195 with SET search_path)
CREATE OR REPLACE FUNCTION public.delete_purchase_order(p_po_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
BEGIN
  PERFORM public.check_rpc_access('delete_purchase_order');

  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_orders WHERE id = p_po_id AND status = 'DRAFT'
  ) THEN
    RAISE EXCEPTION 'Chỉ có thể xóa đơn hàng ở trạng thái Nháp.';
  END IF;

  DELETE FROM public.purchase_order_items WHERE purchase_order_id = p_po_id;
  DELETE FROM public.purchase_orders WHERE id = p_po_id;
END;
$fn$;


-- 6d. get_purchase_orders_master (FINAL from 008 line 368 with p_status param, case-insensitive)
CREATE OR REPLACE FUNCTION public.get_purchase_orders_master(
    p_page integer, p_page_size integer, p_search text,
    p_status_delivery text, p_status_payment text, p_status text DEFAULT NULL,
    p_date_from timestamp with time zone DEFAULT NULL, p_date_to timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(id bigint, code text, supplier_id bigint, supplier_name text, delivery_method text, shipping_partner_name text, delivery_status text, payment_status text, status text, final_amount numeric, total_paid numeric, total_quantity numeric, total_cartons numeric, delivery_progress numeric, expected_delivery_date timestamp with time zone, expected_delivery_time timestamp with time zone, created_at timestamp with time zone, carrier_name text, carrier_contact text, carrier_phone text, total_packages integer, full_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
    v_offset INTEGER;
BEGIN
    v_offset := (p_page - 1) * p_page_size;

    RETURN QUERY
    WITH po_metrics AS (
        SELECT
            poi.po_id,
            COALESCE(SUM(poi.quantity_ordered), 0) as _total_qty,
            COALESCE(SUM(poi.quantity_received), 0) as _total_received,
            ROUND(SUM(poi.quantity_ordered::NUMERIC / COALESCE(NULLIF(poi.conversion_factor, 0), 1)), 1) AS _total_cartons
        FROM public.purchase_order_items poi
        GROUP BY poi.po_id
    ),
    base_query AS (
        SELECT
            po.id, po.code, po.supplier_id,
            COALESCE(s.name, 'N/A') as supplier_name,
            po.delivery_method,
            sp.name as shipping_partner_name,
            po.delivery_status, po.payment_status, po.status,
            po.final_amount,
            COALESCE(po.total_paid, 0) as total_paid,
            COALESCE(pm._total_qty, 0)::NUMERIC as total_quantity,
            COALESCE(pm._total_cartons, 0) as total_cartons,
            CASE
                WHEN COALESCE(pm._total_qty, 0) = 0 THEN 0
                ELSE ROUND((COALESCE(pm._total_received, 0)::NUMERIC / pm._total_qty) * 100, 0)
            END as delivery_progress,
            po.expected_delivery_date, po.expected_delivery_time, po.created_at,
            po.carrier_name, po.carrier_contact, po.carrier_phone,
            COALESCE(po.total_packages, 0) as total_packages
        FROM public.purchase_orders po
        LEFT JOIN po_metrics pm ON po.id = pm.po_id
        LEFT JOIN public.suppliers s ON po.supplier_id = s.id
        LEFT JOIN public.shipping_partners sp ON po.shipping_partner_id = sp.id
        WHERE
            (p_status IS NULL OR LOWER(po.status) = LOWER(p_status))
            AND (p_status_delivery IS NULL OR LOWER(po.delivery_status) = LOWER(p_status_delivery))
            AND (p_status_payment IS NULL OR LOWER(po.payment_status) = LOWER(p_status_payment))
            AND (p_date_from IS NULL OR po.created_at >= p_date_from)
            AND (p_date_to IS NULL OR po.created_at <= p_date_to)
            AND (
                p_search IS NULL OR p_search = ''
                OR po.code ILIKE ('%' || p_search || '%')
                OR s.name ILIKE ('%' || p_search || '%')
                OR EXISTS (
                    SELECT 1 FROM public.purchase_order_items sub_poi
                    JOIN public.products sub_p ON sub_poi.product_id = sub_p.id
                    WHERE sub_poi.po_id = po.id
                    AND (sub_p.name ILIKE ('%' || p_search || '%') OR sub_p.sku ILIKE ('%' || p_search || '%'))
                )
            )
    )
    SELECT *, COUNT(*) OVER() AS full_count
    FROM base_query
    ORDER BY created_at DESC
    LIMIT p_page_size OFFSET v_offset;
END;
$fn$;


-- 6e. update_purchase_order_logistics (from 009 line 597)
CREATE OR REPLACE FUNCTION public.update_purchase_order_logistics(
  p_po_id BIGINT,
  p_delivery_method TEXT DEFAULT NULL,
  p_shipping_partner_id BIGINT DEFAULT NULL,
  p_shipping_fee NUMERIC DEFAULT NULL,
  p_total_packages INTEGER DEFAULT NULL,
  p_expected_delivery_date TIMESTAMPTZ DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
BEGIN
    UPDATE public.purchase_orders
    SET
        delivery_method = COALESCE(p_delivery_method, delivery_method),
        shipping_partner_id = COALESCE(p_shipping_partner_id, shipping_partner_id),
        shipping_fee = COALESCE(p_shipping_fee, shipping_fee),
        total_packages = COALESCE(p_total_packages, total_packages),
        expected_delivery_date = COALESCE(p_expected_delivery_date, expected_delivery_date),
        note = COALESCE(p_note, note),
        updated_at = NOW()
    WHERE id = p_po_id;

    RETURN TRUE;
END;
$fn$;


