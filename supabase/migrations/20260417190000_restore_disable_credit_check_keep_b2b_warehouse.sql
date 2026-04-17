-- Migration: Fix regression credit check + tách ra helper để tránh regress lần nữa
-- ============================================================================
-- BUG: Migration 20260417110000 copy body từ 20260416100000 (credit check ACTIVE)
--      thay vì 20260416120000 (credit check commented out)
--      → Chặn tạo đơn B2B khi khách chưa có hạn mức.
-- FIX (2 phần):
--   1. Tách credit check thành helper _check_b2b_credit_exposure (có thể
--      disable/enable qua 1 file riêng, không phải copy full create_sales_order).
--   2. Refactor create_sales_order → gọi helper thay cho block inline.
-- Khi cần BẬT credit check: tạo migration mới CREATE OR REPLACE _check_b2b_credit_exposure
--      với logic uncommented — không đụng create_sales_order.
-- Date: 2026-04-17
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Helper _check_b2b_credit_exposure (hiện DISABLED — RETURN VOID ngay)
-- ---------------------------------------------------------------------------
-- Để BẬT lại: tạo migration mới CREATE OR REPLACE function này, uncomment block.
CREATE OR REPLACE FUNCTION public._check_b2b_credit_exposure(
  p_customer_id BIGINT,
  p_order_type TEXT,
  p_final_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_available_credit NUMERIC;
BEGIN
  -- [DISABLED 2026-04-17] Data hạn mức công nợ chưa chuẩn.
  -- Để bật lại: tạo migration mới override function này, bỏ RETURN sau đây
  -- và bỏ comment block IF dưới.
  RETURN;

  -- IF p_customer_id IS NOT NULL AND p_order_type = 'B2B' THEN
  --   PERFORM id FROM public.customers_b2b WHERE id = p_customer_id FOR UPDATE;
  --   SELECT available_credit INTO v_available_credit
  --   FROM public.get_customer_exposure_summary(p_customer_id);
  --   IF (COALESCE(v_available_credit, 0) - p_final_amount) < 0 THEN
  --     RAISE EXCEPTION 'Vượt hạn mức công nợ khả dụng. Khả dụng: %đ, Đơn: %đ',
  --       COALESCE(v_available_credit, 0)::BIGINT, p_final_amount::BIGINT;
  --   END IF;
  -- END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public._check_b2b_credit_exposure(BIGINT, TEXT, NUMERIC)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. create_sales_order — refactor dùng helper, giữ mọi logic khác nguyên văn
-- ---------------------------------------------------------------------------
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
  p_voucher_code TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'erp'
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

  -- A. SETUP ORDER TYPE
  IF p_order_type IS NULL OR p_order_type = '' THEN
    IF p_customer_b2c_id IS NOT NULL THEN v_safe_order_type := 'POS'; ELSE v_safe_order_type := 'B2B'; END IF;
  ELSE
    v_safe_order_type := p_order_type;
  END IF;

  -- B. B2B WAREHOUSE OVERRIDE (đơn B2B luôn xuất từ kho B2B tổng)
  IF v_safe_order_type = 'B2B' THEN
    p_warehouse_id := public.get_b2b_warehouse_id();
  END IF;

  -- C. VALIDATE WAREHOUSE
  IF p_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Bắt buộc phải chọn Kho xuất hàng (p_warehouse_id).';
  END IF;

  v_final_b2b_id := COALESCE(p_customer_b2b_id, p_customer_id);

  IF v_safe_order_type = 'POS' THEN v_prefix := 'POS-'; ELSE v_prefix := 'SO-'; END IF;
  v_code := v_prefix || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  -- D. CALCULATE TOTALS
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total_amount := v_total_amount + ((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC);
  END LOOP;

  -- E. STOCK CHECK
  IF p_status IN ('CONFIRMED', 'COMPLETED', 'PACKED', 'SHIPPING', 'DELIVERED', 'DONE') THEN
    PERFORM public._validate_stock_availability(p_warehouse_id, p_items);
  END IF;

  -- F. VOUCHER VALIDATION
  IF p_voucher_code IS NOT NULL AND p_voucher_code <> '' THEN
    v_voucher_check := public.verify_promotion_code(p_voucher_code, v_final_b2b_id, v_total_amount);
    IF (v_voucher_check->>'valid')::BOOLEAN = false THEN
      RAISE EXCEPTION 'Voucher không hợp lệ: %', (v_voucher_check->>'message');
    END IF;
    v_voucher_discount := (v_voucher_check->>'discount_amount')::NUMERIC;
  END IF;

  v_final_amount := v_total_amount - COALESCE(p_discount_amount, 0) - v_voucher_discount + COALESCE(p_shipping_fee, 0);

  -- G. CREDIT EXPOSURE CHECK (via helper — sửa helper để bật/tắt, không đụng function này)
  PERFORM public._check_b2b_credit_exposure(v_final_b2b_id, v_safe_order_type, v_final_amount);

  -- H. INSERT ORDER HEADER
  INSERT INTO public.orders (
    code, customer_id, customer_b2c_id, creator_id, status, order_type,
    payment_method, remittance_status, delivery_address, delivery_time, note,
    discount_amount, shipping_fee, shipping_partner_id, delivery_method, warehouse_id,
    total_amount, final_amount, paid_amount, payment_status, created_at, updated_at,
    source
  ) VALUES (
    v_code, v_final_b2b_id, p_customer_b2c_id, auth.uid(), p_status, v_safe_order_type,
    p_payment_method, CASE WHEN p_payment_method = 'cash' THEN 'pending' ELSE 'skipped' END,
    COALESCE(p_delivery_address, ''), p_delivery_time, p_note,
    COALESCE(p_discount_amount, 0) + v_voucher_discount, COALESCE(p_shipping_fee, 0), p_shipping_partner_id, p_delivery_method, p_warehouse_id,
    v_total_amount, v_final_amount, 0, 'unpaid', NOW(), NOW(),
    COALESCE(p_source, 'erp')
  ) RETURNING id INTO v_order_id;

  -- I. PROCESS ITEMS & STOCK DEDUCTION
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

    IF p_status IN ('CONFIRMED', 'COMPLETED', 'PACKED', 'SHIPPING', 'DELIVERED', 'DONE') THEN
      PERFORM public._deduct_stock_fefo(p_warehouse_id, (v_item->>'product_id')::BIGINT, v_base_quantity_needed, v_unit_price, v_code, v_final_b2b_id::TEXT);
    END IF;
  END LOOP;

  -- J. RECORD VOUCHER USAGE
  IF v_voucher_discount > 0 THEN
    INSERT INTO public.promotion_usages (promotion_id, customer_id, order_id, discount_amount)
    VALUES ((v_voucher_check->'promotion'->>'id')::UUID, v_final_b2b_id, v_order_id, v_voucher_discount);
    UPDATE public.promotions SET usage_count = usage_count + 1 WHERE id = (v_voucher_check->'promotion'->>'id')::UUID;
  END IF;

  -- K. AUTO FINANCE TRANSACTION (cash payments only)
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

COMMIT;

-- ============================================================================
-- KHI CẦN BẬT LẠI CREDIT CHECK (tương lai):
-- Tạo migration mới, chỉ CREATE OR REPLACE _check_b2b_credit_exposure với logic uncommented.
-- KHÔNG CẦN đụng create_sales_order.
-- ============================================================================
