-- Siết RLS orders/order_items/finance_transactions + validate customer_b2b_id NULL
-- ============================================================================
-- AUDIT FINDING #4: Policy orders_authenticated / order_items_authenticated /
--   finance_transactions_select chỉ check is_authenticated() → bất kỳ portal
--   user nào login qua browser + anon key có thể đọc ĐƠN CỦA KHÁCH KHÁC hoặc
--   finance_transactions (nội bộ). Portal API dùng service_role nên không
--   break; chỉ vá defense-in-depth cho path direct PostgREST / realtime.
--
-- AUDIT FINDING #9: create_sales_order không raise khi v_final_b2b_id NULL
--   cho đơn B2B → đơn lọt với customer_id NULL → dashboard báo cáo sai,
--   công nợ không trace được.
--
-- DESIGN RLS:
--   - Staff (record trong user_roles) → ALL (SELECT/INSERT/UPDATE/DELETE).
--   - Portal user active (portal_users.auth_user_id = auth.uid()) → SELECT
--     only, scope theo customer_b2b_id của họ.
--   - finance_transactions → staff only (customer không cần thấy phiếu thu/chi
--     nội bộ; Portal B2B hiển thị công nợ qua RPC riêng).
-- Date: 2026-04-24
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. orders — staff full, portal user SELECT scoped
-- ============================================================================
DROP POLICY IF EXISTS "orders_authenticated" ON public.orders;
DROP POLICY IF EXISTS "Staff can view all orders" ON public.orders;

CREATE POLICY "orders_staff_all"
  ON public.orders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "orders_portal_own_select"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    orders.customer_id IS NOT NULL
    AND orders.customer_id IN (
      SELECT pu.customer_b2b_id FROM public.portal_users pu
      WHERE pu.auth_user_id = auth.uid() AND pu.status = 'active'
    )
  );

-- ============================================================================
-- 2. order_items — staff full, portal user SELECT (scope qua orders FK)
-- ============================================================================
DROP POLICY IF EXISTS "order_items_authenticated" ON public.order_items;

CREATE POLICY "order_items_staff_all"
  ON public.order_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "order_items_portal_own_select"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.portal_users pu ON pu.customer_b2b_id = o.customer_id
      WHERE o.id = order_items.order_id
        AND pu.auth_user_id = auth.uid()
        AND pu.status = 'active'
    )
  );

-- ============================================================================
-- 3. finance_transactions — staff only SELECT
-- ============================================================================
DROP POLICY IF EXISTS "finance_transactions_select" ON public.finance_transactions;

CREATE POLICY "finance_transactions_staff_select"
  ON public.finance_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. create_sales_order — validate customer_b2b_id NOT NULL cho đơn B2B
-- ============================================================================
-- Chỉ thay đổi nhỏ: thêm 1 RAISE sau khi tính v_final_b2b_id. Giữ nguyên mọi
-- logic khác của migration gần nhất (20260423200200). Copy full body.
CREATE OR REPLACE FUNCTION public.create_sales_order(
  p_items JSONB,
  p_customer_id BIGINT DEFAULT NULL,
  p_customer_b2b_id BIGINT DEFAULT NULL,
  p_customer_b2c_id BIGINT DEFAULT NULL,
  p_order_type TEXT DEFAULT 'B2B',
  p_warehouse_id BIGINT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'cash',
  p_shipping_address TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_voucher_code TEXT DEFAULT NULL,
  p_pricing_type TEXT DEFAULT NULL,
  p_channel TEXT DEFAULT NULL,
  p_shipping_method TEXT DEFAULT NULL,
  p_expected_delivery_date DATE DEFAULT NULL,
  p_source TEXT DEFAULT 'erp'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id UUID;
  v_code TEXT;
  v_total_amount NUMERIC := 0;
  v_final_amount NUMERIC := 0;
  v_voucher_discount NUMERIC := 0;
  v_voucher_check JSONB;
  v_item JSONB;
  v_product_row RECORD;
  v_base_quantity_needed NUMERIC;
  v_safe_order_type TEXT;
  v_safe_status TEXT;
  v_prefix TEXT;
  v_final_b2b_id BIGINT;
  v_unit_price NUMERIC;
  v_partner_type TEXT;
  v_partner_id TEXT;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Không có sản phẩm nào được chọn (p_items rỗng).';
  END IF;

  v_safe_order_type := UPPER(TRIM(COALESCE(p_order_type, '')));
  IF v_safe_order_type NOT IN ('B2B', 'POS') THEN
    IF p_customer_b2c_id IS NOT NULL THEN v_safe_order_type := 'POS'; ELSE v_safe_order_type := 'B2B'; END IF;
  END IF;

  IF v_safe_order_type = 'B2B' THEN
    p_warehouse_id := public.get_b2b_warehouse_id();
  END IF;

  IF p_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Bắt buộc phải chọn Kho xuất hàng (p_warehouse_id).';
  END IF;

  v_final_b2b_id := COALESCE(p_customer_b2b_id, p_customer_id);

  -- [FIX #9] Đơn B2B PHẢI có customer_b2b_id. Trước đây silent pass → đơn lọt
  -- với customer_id NULL → công nợ không trace, dashboard sai.
  IF v_safe_order_type = 'B2B' AND v_final_b2b_id IS NULL THEN
    RAISE EXCEPTION 'Đơn B2B bắt buộc phải có customer_b2b_id (hoặc p_customer_id).';
  END IF;

  IF v_safe_order_type = 'POS' THEN v_prefix := 'POS-'; ELSE v_prefix := 'SO-'; END IF;

  v_code := v_prefix || TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYMMDD') || '-' ||
            LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, 0);
    v_total_amount := v_total_amount + (
      v_unit_price * (v_item->>'quantity')::NUMERIC - COALESCE((v_item->>'discount')::NUMERIC, 0)
    );
  END LOOP;
  v_final_amount := v_total_amount;

  IF p_voucher_code IS NOT NULL AND btrim(p_voucher_code) <> '' THEN
    v_voucher_check := public.verify_promotion_code(p_voucher_code, v_final_b2b_id, v_total_amount);
    IF (v_voucher_check->>'ok')::BOOLEAN IS NOT TRUE THEN
      RAISE EXCEPTION 'Voucher không hợp lệ: %', (v_voucher_check->>'message');
    END IF;
    v_voucher_discount := COALESCE((v_voucher_check->>'discount_amount')::NUMERIC, 0);
    v_final_amount := GREATEST(v_total_amount - v_voucher_discount, 0);
  END IF;

  v_safe_status := UPPER(TRIM(COALESCE(p_status, 'DRAFT')));

  PERFORM public._check_b2b_credit_exposure(v_final_b2b_id, v_safe_order_type, v_final_amount);

  INSERT INTO public.orders (
    code, customer_id, customer_b2c_id, creator_id, status, order_type,
    warehouse_id, total_amount, final_amount, payment_method, payment_status,
    shipping_address, notes, pricing_type, channel, shipping_method,
    expected_delivery_date, source
  ) VALUES (
    v_code, v_final_b2b_id, p_customer_b2c_id, auth.uid(), v_safe_status, v_safe_order_type,
    p_warehouse_id, v_total_amount, v_final_amount, p_payment_method, 'unpaid',
    p_shipping_address, p_notes, p_pricing_type, p_channel, p_shipping_method,
    p_expected_delivery_date, p_source
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, 0);
    v_base_quantity_needed := (v_item->>'quantity')::NUMERIC *
      public._resolve_conversion_factor((v_item->>'product_id')::BIGINT, v_item->>'uom');

    INSERT INTO public.order_items (
      order_id, product_id, quantity, uom, conversion_factor, unit_price, discount
    ) VALUES (
      v_order_id, (v_item->>'product_id')::BIGINT,
      (v_item->>'quantity')::NUMERIC, v_item->>'uom',
      public._resolve_conversion_factor((v_item->>'product_id')::BIGINT, v_item->>'uom'),
      v_unit_price, COALESCE((v_item->>'discount')::NUMERIC, 0)
    );

    IF v_safe_status IN ('CONFIRMED', 'PACKED', 'SHIPPING', 'DELIVERED') THEN
      PERFORM public._deduct_stock_fefo(p_warehouse_id, (v_item->>'product_id')::BIGINT, v_base_quantity_needed, v_unit_price, v_code, v_final_b2b_id::TEXT);
    END IF;
  END LOOP;

  IF v_voucher_check IS NOT NULL AND (v_voucher_check->>'ok')::BOOLEAN IS TRUE THEN
    INSERT INTO public.promotion_usages (promotion_id, customer_id, order_id, discount_amount)
    VALUES ((v_voucher_check->'promotion'->>'id')::UUID, v_final_b2b_id, v_order_id, v_voucher_discount);
  END IF;

  RETURN jsonb_build_object('order_id', v_order_id, 'code', v_code, 'final_amount', v_final_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_sales_order(JSONB, BIGINT, BIGINT, BIGINT, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
