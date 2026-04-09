-- ============================================================
-- Fix B2B Inventory Deduction: Chốt đơn (CONFIRMED) không trừ kho
-- Phiên bản tích hợp tính năng bỏ chặn hạn mức (từ 20260411000000)
-- Ngày: 2026-04-09 22:00
-- ============================================================

BEGIN;

-- 1. Cập nhật Trigger Function để không trừ kho khi status = CONFIRMED cho B2B
CREATE OR REPLACE FUNCTION "public"."handle_order_inventory_deduction"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
        v_item RECORD;
        v_warehouse_id BIGINT;
        v_deduct_qty NUMERIC;
        v_batch_record RECORD;
        v_remaining_qty_needed NUMERIC;
        v_deduct_amount NUMERIC;
        v_unit_cost NUMERIC; 
        v_partner_id BIGINT; 
        v_agg_batch_no TEXT;
        v_min_expiry DATE;
    BEGIN
        -- [FIX 2026-04-09]: Không trừ kho khi status = CONFIRMED (trừ khi là POS)
        -- Điều kiện: Nếu status mới là các trạng thái xuất kho thực tế (PACKED/SHIPPING/DELIVERED)
        -- HOẶC là POS chốt đơn ngay.
        -- ĐỒNG THỜI trạng thái cũ không nằm trong nhóm đã xuất kho.
        
        IF (
            (NEW.status IN ('DELIVERED', 'POS_COMPLETED', 'PACKED', 'SHIPPING'))
            OR (NEW.order_type = 'POS' AND NEW.status = 'CONFIRMED')
           )
           AND (OLD.status IS NULL OR OLD.status NOT IN ('DELIVERED', 'POS_COMPLETED', 'PACKED', 'SHIPPING')) 
        THEN

            v_warehouse_id := NEW.warehouse_id;
            IF v_warehouse_id IS NULL THEN v_warehouse_id := 1; END IF;
            
            v_partner_id := NEW.customer_id; 

            FOR v_item IN SELECT * FROM public.order_items WHERE order_id = NEW.id
            LOOP
                -- Nếu dòng đã được gán lô (đã trừ từ bước khác/RPC khác) thì bỏ qua
                IF v_item.batch_no IS NOT NULL AND v_item.batch_no <> '' THEN
                    CONTINUE;
                END IF;

                v_deduct_qty := v_item.quantity * COALESCE(v_item.conversion_factor, 1);

                SELECT COALESCE(actual_cost, 0) INTO v_unit_cost
                FROM public.products
                WHERE id = v_item.product_id;

                v_remaining_qty_needed := v_deduct_qty;
                v_agg_batch_no := '';
                v_min_expiry := NULL;

                FOR v_batch_record IN 
                    SELECT b.id, b.quantity, batch_info.batch_code, batch_info.expiry_date, batch_info.id as batch_id, batch_info.inbound_price
                    FROM public.inventory_batches b
                    JOIN public.batches batch_info ON b.batch_id = batch_info.id
                    WHERE b.warehouse_id = v_warehouse_id
                      AND b.product_id = v_item.product_id
                      AND b.quantity > 0
                    ORDER BY batch_info.expiry_date ASC NULLS LAST, batch_info.created_at ASC
                    FOR UPDATE
                LOOP
                    IF v_remaining_qty_needed <= 0 THEN EXIT; END IF;

                    IF v_batch_record.quantity >= v_remaining_qty_needed THEN
                        v_deduct_amount := v_remaining_qty_needed;
                        UPDATE public.inventory_batches SET quantity = quantity - v_remaining_qty_needed, updated_at = NOW() WHERE id = v_batch_record.id;
                        v_remaining_qty_needed := 0;
                    ELSE
                        v_deduct_amount := v_batch_record.quantity;
                        UPDATE public.inventory_batches SET quantity = 0, updated_at = NOW() WHERE id = v_batch_record.id;
                        v_remaining_qty_needed := v_remaining_qty_needed - v_batch_record.quantity;
                    END IF;

                    INSERT INTO public.inventory_transactions (
                        warehouse_id, product_id, quantity, type, ref_id, description, 
                        created_at, action_group, unit_price, partner_id, batch_id
                    ) VALUES (
                        v_warehouse_id, v_item.product_id, -v_deduct_amount, 'sale_order', 
                        NEW.code, 'Xuất bán đơn hàng ' || NEW.code, NOW(), 'SALE', 
                        COALESCE(v_batch_record.inbound_price, v_unit_cost), v_partner_id, v_batch_record.batch_id
                    );

                    IF v_agg_batch_no = '' THEN 
                        v_agg_batch_no := v_batch_record.batch_code; 
                        v_min_expiry := v_batch_record.expiry_date;
                    ELSE 
                        v_agg_batch_no := v_agg_batch_no || ', ' || v_batch_record.batch_code;
                    END IF;
                END LOOP;

                UPDATE public.order_items 
                SET batch_no = v_agg_batch_no, expiry_date = v_min_expiry, quantity_picked = (v_item.quantity * COALESCE(v_item.conversion_factor, 1))
                WHERE id = v_item.id;

                UPDATE public.product_inventory
                SET stock_quantity = stock_quantity - v_deduct_qty, updated_at = NOW()
                WHERE warehouse_id = v_warehouse_id AND product_id = v_item.product_id;
            END LOOP;
        END IF;

        RETURN NEW;
    END;
    $$;

-- 2. Cập nhật RPC create_sales_order (Bao gồm việc tạm bỏ credit check theo 20260411000000)
CREATE OR REPLACE FUNCTION public.create_sales_order(
  p_items JSONB,
  p_customer_id BIGINT DEFAULT NULL,
  p_customer_b2b_id BIGINT DEFAULT NULL,
  p_customer_b2c_id BIGINT DEFAULT NULL,
  p_status TEXT DEFAULT 'CONFIRMED',
  p_payment_method TEXT DEFAULT 'credit',
  p_discount_amount NUMERIC DEFAULT 0,
  p_shipping_fee NUMERIC DEFAULT 0,
  p_shipping_partner_id BIGINT DEFAULT NULL,
  p_delivery_method TEXT DEFAULT NULL,
  p_delivery_address TEXT DEFAULT NULL,
  p_delivery_time TIMESTAMPTZ DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_warehouse_id BIGINT DEFAULT NULL,
  p_order_type TEXT DEFAULT NULL,
  p_voucher_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
  v_order_id UUID;
  v_code TEXT;
  v_ft_code TEXT;
  v_item JSONB;
  v_total_amount NUMERIC := 0;
  v_final_amount NUMERIC := 0;
  v_unit_price NUMERIC;
  v_quantity NUMERIC;
  v_discount NUMERIC;
  v_conversion_factor NUMERIC;
  v_base_quantity_needed NUMERIC;
  v_prefix TEXT;
  v_final_b2b_id BIGINT;
  v_loyalty_points_earned INT := 0;
  v_safe_order_type TEXT;
  v_partner_id BIGINT;
  v_partner_type TEXT;
  v_voucher_discount NUMERIC := 0;
  v_voucher_check JSONB;
BEGIN
  -- 0. PERMISSION GUARD
  PERFORM public.check_rpc_access('create_sales_order');

  -- A. VALIDATION
  IF p_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Bắt buộc phải chọn Kho xuất hàng (p_warehouse_id).';
  END IF;

  IF p_order_type IS NULL OR p_order_type = '' THEN
    IF p_customer_b2c_id IS NOT NULL THEN v_safe_order_type := 'POS'; ELSE v_safe_order_type := 'B2B'; END IF;
  ELSE
    v_safe_order_type := p_order_type;
  END IF;

  v_final_b2b_id := COALESCE(p_customer_b2b_id, p_customer_id);

  IF v_safe_order_type = 'POS' THEN v_prefix := 'POS-'; ELSE v_prefix := 'SO-'; END IF;
  v_code := v_prefix || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  -- B. CALCULATE TOTALS
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total_amount := v_total_amount + ((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC);
  END LOOP;

  -- C. STOCK CHECK
  IF p_status IN ('CONFIRMED', 'COMPLETED', 'PACKED', 'SHIPPING', 'DELIVERED', 'DONE') THEN
    PERFORM public._validate_stock_availability(p_warehouse_id, p_items);
  END IF;

  -- D. VOUCHER VALIDATION
  IF p_voucher_code IS NOT NULL AND p_voucher_code <> '' THEN
      v_voucher_check := public.verify_promotion_code(p_voucher_code, v_final_b2b_id, v_total_amount);
      IF (v_voucher_check->>'valid')::BOOLEAN = false THEN
          RAISE EXCEPTION 'Voucher không hợp lệ: %', (v_voucher_check->>'message');
      END IF;
      v_voucher_discount := (v_voucher_check->>'discount_amount')::NUMERIC;
  END IF;

  v_final_amount := v_total_amount - COALESCE(p_discount_amount, 0) - v_voucher_discount + COALESCE(p_shipping_fee, 0);

  -- E. CREDIT EXPOSURE CHECK (B2B)
  -- [FIX 2026-04-09]: Tạm bỏ credit check tương tự migration 20260411000000

  -- F. INSERT ORDER HEADER
  INSERT INTO public.orders (
    code, customer_id, customer_b2c_id, creator_id, status, order_type,
    payment_method, remittance_status, delivery_address, delivery_time, note,
    discount_amount, shipping_fee, shipping_partner_id, delivery_method, warehouse_id,
    total_amount, final_amount, paid_amount, payment_status, created_at, updated_at
  ) VALUES (
    v_code, v_final_b2b_id, p_customer_b2c_id, auth.uid(), p_status, v_safe_order_type,
    p_payment_method, CASE WHEN p_payment_method = 'cash' THEN 'pending' ELSE 'skipped' END,
    COALESCE(p_delivery_address, ''), p_delivery_time, p_note,
    COALESCE(p_discount_amount, 0) + v_voucher_discount, COALESCE(p_shipping_fee, 0), p_shipping_partner_id, p_delivery_method, p_warehouse_id,
    v_total_amount, v_final_amount, 0, 'unpaid', NOW(), NOW()
  ) RETURNING id INTO v_order_id;

  -- G. PROCESS ITEMS & CONDITIONAL DEDUCTION
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity      := (v_item->>'quantity')::NUMERIC;
    v_unit_price    := (v_item->>'unit_price')::NUMERIC;
    v_discount      := COALESCE((v_item->>'discount')::NUMERIC, 0);

    v_conversion_factor := public._resolve_conversion_factor(
      (v_item->>'product_id')::BIGINT,
      v_item->>'uom',
      COALESCE((v_item->>'conversion_factor')::NUMERIC, 0)
    );
    v_base_quantity_needed := v_quantity * v_conversion_factor;

    INSERT INTO public.order_items (
      order_id, product_id, quantity, uom, conversion_factor,
      unit_price, discount, is_gift, note
    ) VALUES (
      v_order_id, (v_item->>'product_id')::BIGINT, v_quantity, v_item->>'uom', v_conversion_factor,
      v_unit_price, v_discount, COALESCE((v_item->>'is_gift')::BOOLEAN, false), v_item->>'note'
    );

    -- [FIX 2026-04-09]: Không trừ kho cho B2B khi status = CONFIRMED
    IF (p_status IN ('COMPLETED', 'PACKED', 'SHIPPING', 'DELIVERED', 'DONE'))
       OR (v_safe_order_type = 'POS' AND p_status = 'CONFIRMED') 
    THEN
      PERFORM public._deduct_stock_fefo(p_warehouse_id, (v_item->>'product_id')::BIGINT, v_base_quantity_needed, v_unit_price, v_code, v_final_b2b_id::TEXT);
    END IF;
  END LOOP;

  -- H. RECORD VOUCHER USAGE
  IF v_voucher_discount > 0 THEN
      INSERT INTO public.promotion_usages (promotion_id, customer_id, order_id, discount_amount)
      VALUES ((v_voucher_check->'promotion'->>'id')::UUID, v_final_b2b_id, v_order_id, v_voucher_discount);
      UPDATE public.promotions SET usage_count = usage_count + 1 WHERE id = (v_voucher_check->'promotion'->>'id')::UUID;
  END IF;

  -- I. AUTO FINANCE TRANSACTION
  IF p_payment_method = 'cash' AND v_final_amount > 0 THEN
    v_partner_id   := COALESCE(p_customer_b2c_id, v_final_b2b_id);
    v_partner_type := CASE WHEN p_customer_b2c_id IS NOT NULL THEN 'customer' ELSE 'customer_b2b' END;
    v_ft_code := 'FT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    INSERT INTO public.finance_transactions (
      code, amount, flow, business_type, description, ref_type, ref_id, partner_id, partner_type,
      created_by, status, created_at, fund_account_id
    ) VALUES (
      v_ft_code, v_final_amount, 'in', 'trade', 'Thanh toán đơn hàng ' || v_code,
      'order', v_code, v_partner_id::text, v_partner_type, auth.uid(), 'completed', NOW(), 1
    );
    UPDATE public.orders SET paid_amount = v_final_amount, payment_status = 'paid' WHERE id = v_order_id;
  END IF;

  RETURN jsonb_build_object('order_id', v_order_id, 'code', v_code, 'final_amount', v_final_amount);
END;
$fn$;

NOTIFY pgrst, 'reload schema';

COMMIT;
