-- Harden: tạo variant `_resolve_conversion_factor_strict` RAISE khi UOM không tồn
-- tại (thay vì silent fallback=1 của helper gốc). Dùng trong `create_sales_order`
-- canonical 17-param để đảm bảo đơn hàng không bao giờ snapshot factor sai.
--
-- BACKGROUND:
-- Helper gốc `_resolve_conversion_factor(product_id, uom, hint)` COALESCE về 1
-- khi không tìm thấy UOM trong product_units → rủi ro OVERSELL/UNDERSELL silent
-- nếu Portal bypass validate_stock_for_order hoặc UOM bị xóa sau khi add cart.
--
-- Validate_stock_for_order (20260424010100 DEFENSIVE) đã reject unknown_uom,
-- nhưng create_sales_order vẫn gọi helper loose → path asymmetric. Migration
-- này unify: strict variant dùng ở order creation + keep loose cho legacy calls.
--
-- Giữ nguyên `_resolve_conversion_factor` (loose) để không break các migration
-- cũ (20260411*, 20260416*, 20260417*) — chúng dùng helper loose cho sales
-- order RPC variant trước đây đã bị override bởi canonical 20260424000100.
--
-- Date: 2026-04-24
-- ============================================================================

BEGIN;

-- 1. Strict variant: RAISE nếu không tìm thấy UOM
CREATE OR REPLACE FUNCTION public._resolve_conversion_factor_strict(
  p_product_id BIGINT,
  p_uom TEXT,
  p_explicit_factor NUMERIC DEFAULT 0
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
  v_factor NUMERIC;
  v_valid_units TEXT;
BEGIN
  IF p_explicit_factor > 0 THEN
    RETURN p_explicit_factor;
  END IF;

  IF p_uom IS NULL OR btrim(p_uom) = '' THEN
    RAISE EXCEPTION 'Đơn vị tính (uom) không được rỗng cho sản phẩm ID=%.', p_product_id;
  END IF;

  SELECT conversion_rate INTO v_factor
  FROM public.product_units
  WHERE product_id = p_product_id AND unit_name = p_uom
  LIMIT 1;

  IF v_factor IS NULL OR v_factor <= 0 THEN
    SELECT string_agg(unit_name, ', ' ORDER BY conversion_rate)
      INTO v_valid_units
    FROM public.product_units
    WHERE product_id = p_product_id;

    RAISE EXCEPTION 'Đơn vị "%" không hợp lệ cho sản phẩm ID=%. Đơn vị hợp lệ: %.',
      p_uom, p_product_id, COALESCE(v_valid_units, '(chưa cấu hình)');
  END IF;

  RETURN v_factor;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public._resolve_conversion_factor_strict(BIGINT, TEXT, NUMERIC)
  TO authenticated, service_role;

-- 2. Update create_sales_order canonical 17-param dùng strict variant
-- Copy full body từ 20260424000100, chỉ thay 1 call helper.
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
  v_safe_status TEXT;
BEGIN
  PERFORM public.check_rpc_access('create_sales_order');

  v_safe_status := COALESCE(p_status, 'PENDING');

  IF p_order_type IS NULL OR p_order_type = '' THEN
    IF p_customer_b2c_id IS NOT NULL THEN v_safe_order_type := 'POS'; ELSE v_safe_order_type := 'B2B'; END IF;
  ELSE
    v_safe_order_type := p_order_type;
  END IF;

  IF v_safe_order_type = 'B2B' THEN
    p_warehouse_id := public.get_b2b_warehouse_id();
  END IF;

  IF p_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Bắt buộc phải chọn Kho xuất hàng (p_warehouse_id).';
  END IF;

  v_final_b2b_id := COALESCE(p_customer_b2b_id, p_customer_id);

  IF v_safe_order_type = 'B2B' AND v_final_b2b_id IS NULL THEN
    RAISE EXCEPTION 'Đơn B2B bắt buộc phải có customer_b2b_id (hoặc p_customer_id).';
  END IF;

  IF v_safe_order_type = 'POS' THEN v_prefix := 'POS-'; ELSE v_prefix := 'SO-'; END IF;
  v_code := v_prefix || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total_amount := v_total_amount + ((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC);
  END LOOP;

  IF v_safe_status IN ('CONFIRMED', 'COMPLETED', 'PACKED', 'SHIPPING', 'DELIVERED', 'DONE') THEN
    PERFORM public._validate_stock_availability(p_warehouse_id, p_items);
  END IF;

  IF p_voucher_code IS NOT NULL AND p_voucher_code <> '' THEN
    v_voucher_check := public.verify_promotion_code(p_voucher_code, v_final_b2b_id, v_total_amount);
    IF (v_voucher_check->>'valid')::BOOLEAN = false THEN
      RAISE EXCEPTION 'Voucher không hợp lệ: %', (v_voucher_check->>'message');
    END IF;
    v_voucher_discount := (v_voucher_check->>'discount_amount')::NUMERIC;
  END IF;

  v_final_amount := v_total_amount - COALESCE(p_discount_amount, 0) - v_voucher_discount + COALESCE(p_shipping_fee, 0);

  PERFORM public._check_b2b_credit_exposure(v_final_b2b_id, v_safe_order_type, v_final_amount);

  INSERT INTO public.orders (
    code, customer_id, customer_b2c_id, creator_id, status, order_type,
    payment_method, remittance_status, delivery_address, delivery_time, note,
    discount_amount, shipping_fee, shipping_partner_id, delivery_method, warehouse_id,
    total_amount, final_amount, paid_amount, payment_status, created_at, updated_at,
    source
  ) VALUES (
    v_code, v_final_b2b_id, p_customer_b2c_id, auth.uid(), v_safe_status, v_safe_order_type,
    p_payment_method, CASE WHEN p_payment_method = 'cash' THEN 'pending' ELSE 'skipped' END,
    COALESCE(p_delivery_address, ''), p_delivery_time, p_note,
    COALESCE(p_discount_amount, 0) + v_voucher_discount, COALESCE(p_shipping_fee, 0), p_shipping_partner_id, p_delivery_method, p_warehouse_id,
    v_total_amount, v_final_amount, 0, 'unpaid', NOW(), NOW(),
    COALESCE(p_source, 'erp')
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity      := (v_item->>'quantity')::NUMERIC;
    v_unit_price    := (v_item->>'unit_price')::NUMERIC;
    v_discount      := COALESCE((v_item->>'discount')::NUMERIC, 0);

    -- STRICT: reject unknown UOM thay vì silent fallback=1. Đảm bảo order_items
    -- snapshot conversion_factor chính xác, khớp với validate_stock_for_order.
    v_conversion_factor := public._resolve_conversion_factor_strict(
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

    IF v_safe_status IN ('CONFIRMED', 'COMPLETED', 'PACKED', 'SHIPPING', 'DELIVERED', 'DONE') THEN
      PERFORM public._deduct_stock_fefo(p_warehouse_id, (v_item->>'product_id')::BIGINT, v_base_quantity_needed, v_unit_price, v_code, v_final_b2b_id::TEXT);
    END IF;
  END LOOP;

  IF v_voucher_discount > 0 THEN
    INSERT INTO public.promotion_usages (promotion_id, customer_id, order_id, discount_amount)
    VALUES ((v_voucher_check->'promotion'->>'id')::UUID, v_final_b2b_id, v_order_id, v_voucher_discount);
    UPDATE public.promotions SET usage_count = usage_count + 1 WHERE id = (v_voucher_check->'promotion'->>'id')::UUID;
  END IF;

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
