drop function if exists "public"."get_customers_b2b_list"(search_query text, sales_staff_filter uuid, status_filter text, page_num integer, page_size integer);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public._log_rpc_call(p_module text, p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_user_name TEXT := 'Hệ thống';
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL THEN
    SELECT COALESCE(full_name, email, 'Unknown')
    INTO v_user_name
    FROM public.users WHERE id = v_user_id;
  END IF;

  INSERT INTO public.system_logs (
    user_id, user_name, module, action,
    record_id, new_data, created_at
  ) VALUES (
    v_user_id, v_user_name, p_module, p_action,
    COALESCE(p_data->>'ref_id', ''),
    p_data,
    NOW()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public._resolve_conversion_factor(p_product_id bigint, p_uom text, p_explicit_factor numeric DEFAULT 0)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_factor NUMERIC;
BEGIN
  IF p_explicit_factor > 0 THEN RETURN p_explicit_factor; END IF;
  SELECT conversion_rate INTO v_factor
  FROM public.product_units
  WHERE product_id = p_product_id AND unit_name = p_uom LIMIT 1;
  RETURN COALESCE(v_factor, 1);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_portal_registration(p_request_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request RECORD;
  v_customer_id BIGINT;
  v_customer_code TEXT;
  v_auth_user_id UUID;
  v_portal_user_id UUID;
  v_admin_id UUID;
BEGIN
  -- 1. Get current admin ID
  v_admin_id := auth.uid();
  
  -- 2. Get request data
  SELECT * INTO v_request 
  FROM public.registration_requests 
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại hoặc đã được xử lý.';
  END IF;

  -- 3. Check if email already exists in auth.users
  SELECT id INTO v_auth_user_id FROM auth.users WHERE email = v_request.email;
  
  -- If user doesn't exist in auth.users, we can't fully approve via RPC alone if we want to set a password.
  -- But for this demo/test environment, we'll assume the user might have been created or 
  -- we'll rely on the frontend to call an edge function instead if auth creation is needed.
  -- HOWEVER, if this is for the E2E test, we can just create the portal_user link if the auth user exists.
  
  -- For the sake of the test, let's create the customer_b2b first.
  
  -- Generate customer code
  SELECT 'B2B-' || LPAD((COALESCE(MAX(id), 0) + 1)::TEXT, 5, '0') INTO v_customer_code FROM public.customers_b2b;

  -- Create customer_b2b
  INSERT INTO public.customers_b2b (
    customer_code,
    name,
    phone,
    email,
    tax_code,
    vat_address,
    shipping_address,
    status
  ) VALUES (
    v_customer_code,
    v_request.business_name,
    v_request.phone,
    v_request.email,
    v_request.tax_code,
    v_request.address,
    v_request.address,
    'active'
  ) RETURNING id INTO v_customer_id;

  -- If auth user already exists (e.g. from previous attempts or manual creation)
  IF v_auth_user_id IS NOT NULL THEN
    INSERT INTO public.portal_users (
      auth_user_id,
      customer_b2b_id,
      display_name,
      email,
      phone,
      role,
      status
    ) VALUES (
      v_auth_user_id,
      v_customer_id,
      v_request.contact_name,
      v_request.email,
      v_request.phone,
      'owner',
      'active'
    ) RETURNING id INTO v_portal_user_id;
  END IF;

  -- 4. Update request status
  UPDATE public.registration_requests SET
    status = 'approved',
    approved_customer_b2b_id = v_customer_id,
    approved_portal_user_id = v_portal_user_id,
    approved_by = v_admin_id,
    approved_at = now()
  WHERE id = p_request_id;

  RETURN json_build_object(
    'success', true,
    'customer_id', v_customer_id,
    'customer_code', v_customer_code,
    'portal_user_id', v_portal_user_id,
    'auth_user_exists', v_auth_user_id IS NOT NULL
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_portal_registration(p_request_id uuid, p_existing_customer_id bigint DEFAULT NULL::bigint, p_auth_user_id uuid DEFAULT NULL::uuid, p_debt_limit numeric DEFAULT 50000000, p_payment_term integer DEFAULT 30)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request RECORD;
  v_customer_id BIGINT;
  v_customer_code TEXT;
  v_portal_user_id UUID;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();

  SELECT * INTO v_request
  FROM public.registration_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại hoặc đã được xử lý.';
  END IF;

  IF p_existing_customer_id IS NOT NULL THEN
    SELECT id INTO v_customer_id
    FROM public.customers_b2b
    WHERE id = p_existing_customer_id AND status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Khách hàng B2B không tồn tại hoặc đã ngưng hoạt động.';
    END IF;
  ELSE
    SELECT 'B2B-' || LPAD((COALESCE(MAX(id), 0) + 1)::TEXT, 5, '0')
    INTO v_customer_code FROM public.customers_b2b;

    INSERT INTO public.customers_b2b (
      customer_code, name, phone, email, tax_code,
      vat_address, shipping_address, debt_limit, payment_term, status
    ) VALUES (
      v_customer_code, v_request.business_name, v_request.phone, v_request.email,
      v_request.tax_code, v_request.address, v_request.address,
      p_debt_limit, p_payment_term, 'active'
    ) RETURNING id INTO v_customer_id;
  END IF;

  IF p_auth_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM portal_users WHERE auth_user_id = p_auth_user_id) THEN
      RAISE EXCEPTION 'Auth user này đã có portal account.';
    END IF;

    INSERT INTO public.portal_users (
      auth_user_id, customer_b2b_id, display_name, email, phone, role, status
    ) VALUES (
      p_auth_user_id, v_customer_id, v_request.contact_name,
      v_request.email, v_request.phone, 'owner', 'active'
    ) RETURNING id INTO v_portal_user_id;
  END IF;

  UPDATE public.registration_requests SET
    status = 'approved',
    approved_customer_b2b_id = v_customer_id,
    approved_portal_user_id = v_portal_user_id,
    approved_by = v_admin_id,
    approved_at = now(),
    updated_at = now()
  WHERE id = p_request_id;

  RETURN json_build_object(
    'success', true,
    'customer_id', v_customer_id,
    'customer_code', COALESCE(v_customer_code, (SELECT customer_code FROM customers_b2b WHERE id = v_customer_id)),
    'portal_user_id', v_portal_user_id,
    'auth_user_id', p_auth_user_id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_user(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.check_rpc_access('approve_user');

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Không thể tự duyệt chính mình.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = p_user_id AND status = 'pending_approval'
  ) THEN
    RAISE EXCEPTION 'User không tồn tại hoặc không ở trạng thái chờ duyệt.';
  END IF;

  UPDATE public.users
  SET status = 'active', profile_updated_at = now()
  WHERE id = p_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.batch_deduct_vat_for_pos(p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item JSONB;
  v_product_id BIGINT;
  v_vat_rate NUMERIC;
  v_qty NUMERIC;
  v_unit TEXT;
  v_conversion_rate NUMERIC;
  v_base_qty NUMERIC;
  v_current_balance NUMERIC;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::BIGINT;
    v_vat_rate := COALESCE((v_item->>'vat_rate')::NUMERIC, 0);
    v_qty := COALESCE((v_item->>'quantity')::NUMERIC, 0);
    v_unit := COALESCE(v_item->>'unit', 'Viên');

    IF v_qty <= 0 THEN CONTINUE; END IF;

    SELECT conversion_rate INTO v_conversion_rate
    FROM public.product_units
    WHERE product_id = v_product_id AND unit_name = v_unit LIMIT 1;
    v_conversion_rate := COALESCE(v_conversion_rate, 1);
    v_base_qty := v_qty * v_conversion_rate;

    SELECT quantity_balance INTO v_current_balance
    FROM public.vat_inventory_ledger
    WHERE product_id = v_product_id AND vat_rate = v_vat_rate
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Không tìm thấy kho VAT cho SP #% (VAT %)', v_product_id, v_vat_rate;
    END IF;
    IF v_current_balance < v_base_qty THEN
      RAISE EXCEPTION 'Không đủ kho VAT SP #%. Cần: %, Tồn: %', v_product_id, v_base_qty, v_current_balance;
    END IF;

    UPDATE public.vat_inventory_ledger
    SET quantity_balance = quantity_balance - v_base_qty, updated_at = NOW()
    WHERE product_id = v_product_id AND vat_rate = v_vat_rate;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.bulk_update_product_barcodes(p_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.bulk_update_product_prices(p_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    item jsonb;
    v_product_id BIGINT;
    v_has_wholesale BOOLEAN;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(p_data)
    LOOP
        v_product_id := (item->>'product_id')::BIGINT;

        -- 1. Update Product (Lưu Giá Vốn Base)
        UPDATE public.products 
        SET 
            actual_cost = COALESCE((item->>'actual_cost')::NUMERIC, actual_cost),
            retail_margin_value = COALESCE((item->>'retail_margin')::NUMERIC, retail_margin_value),
            retail_margin_type = COALESCE(item->>'retail_margin_type', retail_margin_type),
            wholesale_margin_value = COALESCE((item->>'wholesale_margin')::NUMERIC, wholesale_margin_value),
            wholesale_margin_type = COALESCE(item->>'wholesale_margin_type', wholesale_margin_type),
            updated_at = NOW()
        WHERE id = v_product_id;

        -- 2. [CORE FIX]: Update Product Units (Giá Vốn Đơn Vị = Base Cost * Rate)
        -- Đã bỏ logic chia cho MAX() sai lầm cũ.
        UPDATE public.product_units
        SET price_cost = COALESCE((item->>'actual_cost')::NUMERIC, 0) * conversion_rate,
            updated_at = NOW()
        WHERE product_id = v_product_id; 

        -- 3. Xử lý Giá Bán
        -- A. Cập nhật GIÁ LẺ (Cho Base Unit & Retail Unit)
        IF (item->>'retail_price') IS NOT NULL THEN
            UPDATE public.product_units
            SET price_sell = (item->>'retail_price')::NUMERIC,
                price = (item->>'retail_price')::NUMERIC, 
                updated_at = NOW()
            WHERE product_id = v_product_id
              AND (unit_type = 'retail' OR is_base = true)
              AND unit_type <> 'wholesale'; 
        END IF;

        -- B. Cập nhật GIÁ BUÔN (Cho Wholesale Unit)
        IF (item->>'wholesale_price') IS NOT NULL THEN
            SELECT EXISTS(SELECT 1 FROM public.product_units WHERE product_id = v_product_id AND unit_type = 'wholesale') INTO v_has_wholesale;
            
            IF v_has_wholesale THEN
                UPDATE public.product_units
                SET price_sell = (item->>'wholesale_price')::NUMERIC,
                    price = (item->>'wholesale_price')::NUMERIC,
                    updated_at = NOW()
                WHERE product_id = v_product_id AND unit_type = 'wholesale';
            ELSE
                UPDATE public.product_units
                SET price_sell = (item->>'wholesale_price')::NUMERIC,
                    price = (item->>'wholesale_price')::NUMERIC,
                    updated_at = NOW()
                WHERE product_id = v_product_id
                  AND conversion_rate = (SELECT MAX(conversion_rate) FROM public.product_units WHERE product_id = v_product_id)
                  AND (SELECT COUNT(*) FROM public.product_units WHERE product_id = v_product_id) > 1; 
            END IF;
        END IF;

    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cancel_purchase_order(p_po_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.check_rpc_access(p_function_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rule RECORD;
  v_call_count INT;
  v_uid UUID;
BEGIN
  v_uid := auth.uid();

  -- Must be authenticated
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Chưa đăng nhập.';
  END IF;

  -- Lookup rule
  SELECT * INTO v_rule FROM public.rpc_access_rules WHERE function_name = p_function_name;

  -- No rule = allow authenticated (backward compatible)
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Permission check
  IF v_rule.required_permission IS NOT NULL THEN
    IF NOT public.user_has_permission(v_rule.required_permission)
       AND NOT public.user_has_permission('admin-all') THEN
      RAISE EXCEPTION 'Forbidden: Bạn không có quyền gọi %.', p_function_name;
    END IF;
  END IF;

  -- Rate limit check
  IF v_rule.max_calls_per_minute > 0 THEN
    SELECT COUNT(*) INTO v_call_count
    FROM public.rpc_rate_log
    WHERE user_id = v_uid
      AND function_name = p_function_name
      AND called_at > now() - interval '1 minute';

    IF v_call_count >= v_rule.max_calls_per_minute THEN
      RAISE EXCEPTION 'Rate limit exceeded: Vượt quá % lần/phút cho %.', v_rule.max_calls_per_minute, p_function_name;
    END IF;
  END IF;

  -- Log call to rate_log
  INSERT INTO public.rpc_rate_log (user_id, function_name) VALUES (v_uid, p_function_name);

  -- Auto-log WRITE operations to system_logs for audit trail
  IF v_rule.is_write THEN
    PERFORM public._log_rpc_call(
      SPLIT_PART(COALESCE(v_rule.required_permission, 'system'), '.', 1),
      p_function_name,
      jsonb_build_object('user_id', v_uid)
    );
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_rpc_rate_log()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  DELETE FROM public.rpc_rate_log WHERE called_at < now() - interval '5 minutes';
$function$
;

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
    v_total_amount NUMERIC := 0;
    v_final_amount NUMERIC;
    v_item RECORD;
    v_current_price NUMERIC;
BEGIN
    -- 1. Get original order
    SELECT * INTO v_old_order FROM public.orders WHERE id = p_old_order_id;
    IF v_old_order IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy đơn hàng gốc để nhân bản.';
    END IF;

    -- 2. Generate new order code
    IF v_old_order.order_type = 'POS' THEN
        v_prefix := 'POS-';
    ELSE
        v_prefix := 'SO-';
    END IF;
    v_new_code := v_prefix || to_char(now(), 'YYMMDD') || '-' || LPAD(floor(random() * 10000)::text, 4, '0');

    -- 3. Insert new order header (amounts will be recalculated)
    INSERT INTO public.orders (
        code, order_type, customer_id, customer_b2c_id, warehouse_id,
        delivery_address, delivery_time, delivery_method, shipping_partner_id,
        shipping_fee, discount_amount, total_amount, final_amount,
        status, payment_status, payment_method, remittance_status, paid_amount,
        note, creator_id, created_at, updated_at
    ) VALUES (
        v_new_code, v_old_order.order_type, v_old_order.customer_id, v_old_order.customer_b2c_id, v_old_order.warehouse_id,
        v_old_order.delivery_address, v_old_order.delivery_time, v_old_order.delivery_method, v_old_order.shipping_partner_id,
        v_old_order.shipping_fee, 0, 0, 0,
        'DRAFT', 'unpaid', v_old_order.payment_method,
        CASE WHEN v_old_order.payment_method = 'cash' THEN 'pending' ELSE 'skipped' END,
        0,
        COALESCE(v_old_order.note, '') || E'\n(Nhân bản từ đơn: ' || v_old_order.code || ')',
        auth.uid(), NOW(), NOW()
    ) RETURNING id INTO v_new_order_id;

    -- 4. Copy items WITH REFRESHED PRICES from current product_units + deals
    FOR v_item IN
        SELECT product_id, uom, conversion_factor, quantity, unit_price,
               discount, is_gift, note
        FROM public.order_items
        WHERE order_id = p_old_order_id
    LOOP
        -- Get current price: LEAST of wholesale price vs active deal price
        SELECT LEAST(
            COALESCE(
                (SELECT pu.price_sell FROM public.product_units pu
                 WHERE pu.product_id = v_item.product_id AND pu.unit_type = 'wholesale' AND pu.price_sell > 0 LIMIT 1),
                (SELECT pu.price_sell FROM public.product_units pu
                 WHERE pu.product_id = v_item.product_id AND pu.price_sell > 0 LIMIT 1),
                v_item.unit_price  -- fallback to old price if product has no units
            ),
            COALESCE(
                (SELECT
                    CASE
                        WHEN d.discount_type = 'percent' THEN pu.price_sell * (1 - d.discount_value / 100.0)
                        ELSE pu.price_sell - d.discount_value
                    END
                 FROM public.v_active_deals d
                 JOIN public.product_units pu ON pu.product_id = d.product_id AND pu.unit_type = 'wholesale'
                 WHERE d.product_id = v_item.product_id
                 LIMIT 1),
                999999999
            )
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

    -- 5. Update order totals with refreshed prices
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
$function$
;

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
$function$
;

CREATE OR REPLACE FUNCTION public.confirm_purchase_order_financials(p_po_id bigint, p_items_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_item JSONB;
    v_po_record RECORD;
    v_total_rebate NUMERIC := 0;
    v_supplier_id BIGINT;
    v_po_item_cf INT;
    v_real_base_cost NUMERIC;
BEGIN
    SELECT * INTO v_po_record FROM public.purchase_orders WHERE id = p_po_id;
    IF v_po_record IS NULL THEN RAISE EXCEPTION 'Không tìm thấy đơn mua hàng ID %', p_po_id; END IF;

    v_supplier_id := v_po_record.supplier_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_data)
    LOOP
        UPDATE public.purchase_order_items
        SET vat_rate = COALESCE((v_item->>'vat_rate')::NUMERIC, 0), rebate_rate = COALESCE((v_item->>'rebate_rate')::NUMERIC, 0), bonus_quantity = COALESCE((v_item->>'bonus_quantity')::INTEGER, 0), allocated_shipping_fee = COALESCE((v_item->>'allocated_shipping_fee')::NUMERIC, 0), final_unit_cost = COALESCE((v_item->>'final_unit_cost')::NUMERIC, 0)
        WHERE id = (v_item->>'id')::BIGINT;

        v_total_rebate := v_total_rebate + (((v_item->>'unit_price')::NUMERIC * (v_item->>'quantity_ordered')::NUMERIC) * ((v_item->>'rebate_rate')::NUMERIC / 100.0));
            
        -- [CORE FIX]: Chia cho Conversion Factor
        SELECT COALESCE(NULLIF(conversion_factor, 0), 1) INTO v_po_item_cf FROM public.purchase_order_items WHERE id = (v_item->>'id')::BIGINT;
        v_real_base_cost := COALESCE((v_item->>'final_unit_cost')::NUMERIC, 0) / v_po_item_cf;

        UPDATE public.products SET actual_cost = v_real_base_cost, updated_at = NOW() WHERE id = (v_item->>'product_id')::BIGINT;
        
        UPDATE public.product_units SET price_cost = v_real_base_cost * COALESCE(conversion_rate, 1), updated_at = NOW() WHERE product_id = (v_item->>'product_id')::BIGINT;
    END LOOP;

    IF v_total_rebate > 0 THEN
        INSERT INTO public.supplier_wallets (supplier_id, balance, total_earned, updated_at) VALUES (v_supplier_id, v_total_rebate, v_total_rebate, NOW()) ON CONFLICT (supplier_id) DO UPDATE SET balance = public.supplier_wallets.balance + v_total_rebate, total_earned = public.supplier_wallets.total_earned + v_total_rebate, updated_at = NOW();
    END IF;

    UPDATE public.purchase_orders SET status = 'COMPLETED', updated_at = NOW() WHERE id = p_po_id;

    RETURN jsonb_build_object('success', true, 'total_rebate_earned', v_total_rebate, 'message', 'Đã cập nhật giá vốn và tích lũy ví NCC thành công.');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.deduct_vat_for_pos_export(p_product_id bigint, p_vat_rate numeric, p_base_qty numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_balance NUMERIC;
BEGIN
  SELECT quantity_balance INTO v_current_balance
  FROM public.vat_inventory_ledger
  WHERE product_id = p_product_id AND vat_rate = p_vat_rate
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy kho VAT cho SP #% (VAT %)', p_product_id, p_vat_rate;
  END IF;

  IF v_current_balance < p_base_qty THEN
    RAISE EXCEPTION 'Không đủ kho VAT cho SP #%. Cần: %, Tồn: %',
      p_product_id, p_base_qty, v_current_balance;
  END IF;

  UPDATE public.vat_inventory_ledger
  SET quantity_balance = quantity_balance - p_base_qty,
      updated_at = NOW()
  WHERE product_id = p_product_id AND vat_rate = p_vat_rate;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_invoice_atomic(p_invoice_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice RECORD;
BEGIN
  PERFORM public.check_rpc_access('delete_invoice_atomic');

  SELECT * INTO v_invoice FROM public.finance_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hóa đơn #% không tồn tại', p_invoice_id;
  END IF;

  -- If verified, insert negative reversal entries (audit trail)
  IF v_invoice.status = 'verified' THEN
    INSERT INTO public.vat_inventory_ledger (
      invoice_id, product_id, quantity, unit_price, direction, note, created_at
    )
    SELECT
      p_invoice_id, vil.product_id, -ABS(vil.quantity), vil.unit_price,
      'reversal', 'Auto-reverse khi xóa HĐ #' || p_invoice_id, NOW()
    FROM public.vat_inventory_ledger vil
    WHERE vil.invoice_id = p_invoice_id AND vil.quantity > 0;
  END IF;

  DELETE FROM public.finance_invoice_allocations WHERE invoice_id = p_invoice_id;
  DELETE FROM public.finance_invoices WHERE id = p_invoice_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_purchase_order(p_po_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.export_customers_b2b_list(search_query text, sales_staff_filter uuid, status_filter text)
 RETURNS TABLE(id bigint, customer_code text, name text, phone text, email text, tax_code text, contact_person_name text, contact_person_phone text, vat_address text, shipping_address text, sales_staff_name text, debt_limit numeric, payment_term integer, ranking text, status public.account_status, loyalty_points integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.customer_code,
    c.name,
    c.phone,
    c.email,
    c.tax_code,
    contacts.name AS contact_person_name,
    contacts.phone AS contact_person_phone,
    c.vat_address,
    c.shipping_address,
    (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE auth.users.id = c.sales_staff_id) AS sales_staff_name,
    c.debt_limit,
    c.payment_term,
    c.ranking,
    c.status,
    c.loyalty_points
  FROM
    public.customers_b2b c
  LEFT JOIN LATERAL (
    SELECT cc.name, cc.phone
    FROM public.customer_b2b_contacts cc
    WHERE cc.customer_b2b_id = c.id
    ORDER BY cc.is_primary DESC, cc.id ASC
    LIMIT 1
  ) contacts ON true
  WHERE
    (status_filter IS NULL OR status_filter = '' OR c.status = status_filter::public.account_status)
  AND
    (sales_staff_filter IS NULL OR c.sales_staff_id = sales_staff_filter)
  AND
    (
      search_query IS NULL OR search_query = '' OR
      c.name ILIKE ('%' || search_query || '%') OR
      c.customer_code ILIKE ('%' || search_query || '%') OR
      c.phone ILIKE ('%' || search_query || '%') OR
      c.tax_code ILIKE ('%' || search_query || '%')
    )
  ORDER BY
    c.id DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.export_customers_b2c_list(search_query text, type_filter text, status_filter text)
 RETURNS TABLE(key text, id bigint, customer_code text, name text, type public.customer_b2c_type, phone text, loyalty_points integer, status public.account_status, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
 RETURN QUERY
 WITH filtered_customers AS (
 SELECT
 c.id, c.customer_code, c.name, c.type, c.phone,
 c.loyalty_points, c.status,
 COUNT(*) OVER() AS total_count
 FROM
 public.customers c
 WHERE
 (status_filter IS NULL OR status_filter = '' OR c.status = status_filter::public.account_status)
 AND
 (type_filter IS NULL OR type_filter = '' OR c.type = type_filter::public.customer_b2c_type)
 AND
 (
 search_query IS NULL OR search_query = '' OR
 c.name ILIKE ('%' || search_query || '%') OR
 c.customer_code ILIKE ('%' || search_query || '%') OR
 c.phone ILIKE ('%' || search_query || '%') OR
 c.contact_person_phone ILIKE ('%' || search_query || '%') OR
 c.id IN (
 SELECT cg.customer_id
 FROM public.customer_guardians cg
 JOIN public.customers guardian ON cg.guardian_id = guardian.id
 WHERE guardian.phone ILIKE ('%' || search_query || '%')
 )
 )
 )
 SELECT
 fc.id::TEXT AS key, fc.id, fc.customer_code, fc.name, fc.type,
 fc.phone, fc.loyalty_points, fc.status, fc.total_count
 FROM
 filtered_customers fc
 ORDER BY
 fc.id DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.export_products_list(search_query text, category_filter text, manufacturer_filter text, status_filter text)
 RETURNS TABLE(key text, id bigint, name text, sku text, image_url text, category_name text, manufacturer_name text, status text, inventory_b2b integer, inventory_pkdh integer, inventory_ntdh1 integer, inventory_ntdh2 integer, inventory_potec integer, total_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH filtered_products AS (
        SELECT
            p.id, p.name, p.sku, p.image_url, p.category_name, p.manufacturer_name, p.status,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 1) AS inventory_b2b,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 2) AS inventory_pkdh,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 3) AS inventory_ntdh1,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 4) AS inventory_ntdh2,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 5) AS inventory_potec
        FROM public.products p
        WHERE
            (search_query IS NULL OR search_query = '' OR p.fts @@ to_tsquery('simple', search_query || ':*'))
        AND
            (category_filter IS NULL OR category_filter = '' OR p.category_name = category_filter)
        AND
            (manufacturer_filter IS NULL OR manufacturer_filter = '' OR p.manufacturer_name = manufacturer_filter)
        AND
            (status_filter IS NULL OR status_filter = '' OR p.status = status_filter)
    ),
    counted_products AS (
        SELECT *, COUNT(*) OVER() as total_count FROM filtered_products
    )
    SELECT
        cp.id::TEXT AS key, cp.id, cp.name, cp.sku, cp.image_url,
        cp.category_name, cp.manufacturer_name, cp.status,
        cp.inventory_b2b::INT, cp.inventory_pkdh::INT, cp.inventory_ntdh1::INT,
        cp.inventory_ntdh2::INT, cp.inventory_potec::INT,
        cp.total_count
    FROM counted_products cp
    ORDER BY cp.id DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_notify_admin_new_portal_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user RECORD;
  v_customer_name TEXT;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  IF COALESCE(NEW.source, 'erp') <> 'portal' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(cb.name, 'Khách hàng')
  INTO v_customer_name
  FROM public.customers_b2b cb
  WHERE cb.id = NEW.customer_id
  LIMIT 1;
  v_customer_name := COALESCE(v_customer_name, 'Khách hàng');

  -- Get config for email (best-effort)
  BEGIN
    SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
    v_service_key := NULL;
  END;

  FOR v_user IN
    SELECT DISTINCT ur.user_id, u.email
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN auth.users u ON ur.user_id = u.id
    WHERE rp.permission_key IN ('portal.manage', 'admin-all')
  LOOP
    -- In-app notification
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    VALUES (
      v_user.user_id,
      'Đơn hàng Portal mới',
      NEW.code || ' — ' || v_customer_name,
      'info',
      NEW.id
    );

    -- Email (best-effort, async)
    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL AND v_user.email IS NOT NULL THEN
      BEGIN
        PERFORM extensions.http_post(
          url := v_supabase_url || '/functions/v1/send-portal-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'type', 'admin_new_order',
            'email', v_user.email,
            'data', jsonb_build_object(
              'order_code', NEW.code,
              'customer_name', v_customer_name,
              'total_amount', COALESCE(NEW.final_amount, NEW.total_amount, 0)
            )
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Email send failed: %', SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_notify_admin_payment_received()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user RECORD;
  v_amount_text TEXT;
  v_partner TEXT;
  v_ref TEXT;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  IF NEW.flow != 'in' THEN RETURN NEW; END IF;
  IF NEW.status != 'completed' THEN RETURN NEW; END IF;

  v_amount_text := to_char(NEW.amount, 'FM999,999,999,999') || ' đ';
  v_partner := COALESCE(NEW.partner_name_cache, 'Không rõ');
  v_ref := COALESCE(NEW.ref_id, NEW.code);

  BEGIN
    SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
    v_service_key := NULL;
  END;

  FOR v_user IN
    SELECT DISTINCT ur.user_id, u.email
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN auth.users u ON ur.user_id = u.id
    WHERE rp.permission_key IN ('portal.manage', 'finance.view_balance', 'admin-all')
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    VALUES (
      v_user.user_id,
      'Thanh toán mới: ' || v_amount_text,
      v_partner || ' — ' || v_ref,
      'success',
      NULL
    );

    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL AND v_user.email IS NOT NULL THEN
      BEGIN
        PERFORM extensions.http_post(
          url := v_supabase_url || '/functions/v1/send-portal-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'type', 'admin_payment_received',
            'email', v_user.email,
            'data', jsonb_build_object(
              'amount', v_amount_text,
              'partner_name', v_partner,
              'reference', v_ref,
              'description', COALESCE(NEW.description, '')
            )
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Email send failed: %', SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_active_shipping_partners()
 RETURNS TABLE(id bigint, name text, phone text, contact_person text, speed_hours integer, base_fee numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        sp.id, sp.name, sp.phone, sp.contact_person,
        COALESCE((SELECT sr.speed_hours FROM public.shipping_rules sr WHERE sr.partner_id = sp.id LIMIT 1), 24) as speed_hours,
        COALESCE((SELECT sr.fee FROM public.shipping_rules sr WHERE sr.partner_id = sp.id LIMIT 1), 0) as base_fee
    FROM public.shipping_partners sp
    WHERE sp.status = 'active';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_assets_list(search_query text, type_filter bigint, branch_filter bigint, status_filter text)
 RETURNS TABLE(key text, id bigint, asset_code text, name text, image_url text, asset_type_name text, branch_name text, user_name text, purchase_date date, cost numeric, depreciation_months integer, depreciation_per_month numeric, remaining_value numeric, status public.asset_status, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH filtered_assets AS (
    SELECT
      a.id,
      a.asset_code,
      a.name,
      a.image_url,
      aty.name AS asset_type_name,
      w.name AS branch_name,
      (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE auth.users.id = a.user_id) AS user_name,
      a.purchase_date,
      a.cost,
      a.depreciation_months,
      a.status,
      COUNT(*) OVER() AS total_count
    FROM public.assets a
    LEFT JOIN public.asset_types aty ON a.asset_type_id = aty.id
    LEFT JOIN public.warehouses w ON a.branch_id = w.id
    WHERE
      (search_query IS NULL OR search_query = '' OR (
        a.name ILIKE ('%' || search_query || '%') OR
        a.asset_code ILIKE ('%' || search_query || '%') OR
        a.serial_number ILIKE ('%' || search_query || '%')
      ))
    AND (type_filter IS NULL OR a.asset_type_id = type_filter)
    AND (branch_filter IS NULL OR a.branch_id = branch_filter)
    AND (status_filter IS NULL OR status_filter = '' OR a.status::text = status_filter)
  )
  SELECT
    f.id::TEXT AS key,
    f.id,
    f.asset_code,
    f.name,
    f.image_url,
    f.asset_type_name,
    f.branch_name,
    f.user_name,
    f.purchase_date,
    f.cost,
    f.depreciation_months,
    (CASE
      WHEN f.depreciation_months > 0 THEN round(f.cost / f.depreciation_months)
      ELSE 0
    END) AS depreciation_per_month,
    (CASE
      WHEN f.purchase_date IS NULL THEN f.cost
      ELSE GREATEST(0,
        f.cost - (
          (CASE WHEN f.depreciation_months > 0 THEN round(f.cost / f.depreciation_months) ELSE 0 END)
          * GREATEST(0, date_part('month', age(now(), f.purchase_date))::INT)
        )
      )
    END) AS remaining_value,
    f.status,
    f.total_count
  FROM filtered_assets f
  ORDER BY f.id DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_b2b_orders_view(p_page integer DEFAULT 1, p_page_size integer DEFAULT 10, p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    DECLARE
        v_uid uuid := auth.uid();
        v_offset int := (p_page - 1) * p_page_size;
        v_result JSONB;
        v_stats JSONB;
    BEGIN
        SELECT jsonb_build_object(
            'sales_this_month', COALESCE(SUM(o.final_amount) FILTER (WHERE o.created_at >= date_trunc('month', now())), 0),
            'draft_count', COUNT(*) FILTER (WHERE o.status IN ('DRAFT', 'QUOTE')),
            'pending_payment', COUNT(*) FILTER (WHERE o.paid_amount < o.final_amount AND o.status NOT IN ('DRAFT', 'CANCELLED'))
        ) INTO v_stats
        FROM public.orders o
        JOIN public.customers_b2b c ON o.customer_id = c.id
        WHERE (o.creator_id = v_uid OR c.sales_staff_id = v_uid);

        WITH filtered_orders AS (
            SELECT
                o.id,
                o.code,
                c.name as customer_name,
                o.status,
                CASE
                    WHEN o.paid_amount >= o.final_amount THEN 'paid'
                    WHEN o.paid_amount > 0 THEN 'partial'
                    ELSE 'unpaid'
                END as payment_status,
                o.final_amount,
                o.paid_amount,
                o.created_at
            FROM public.orders o
            JOIN public.customers_b2b c ON o.customer_id = c.id
            WHERE
                (o.creator_id = v_uid OR c.sales_staff_id = v_uid)
                AND (p_status IS NULL OR p_status = '' OR o.status = p_status)
                AND (p_date_from IS NULL OR o.created_at >= p_date_from)
                AND (p_date_to IS NULL OR o.created_at <= p_date_to)
                AND (
                    p_search IS NULL OR p_search = ''
                    OR o.code ILIKE '%' || p_search || '%'
                    OR c.name ILIKE '%' || p_search || '%'
                )
        ),
        paginated_orders AS (
            SELECT * FROM filtered_orders
            ORDER BY created_at DESC
            LIMIT p_page_size OFFSET v_offset
        )
        SELECT
            jsonb_build_object(
                'data', COALESCE(jsonb_agg(to_jsonb(t.*)), '[]'::jsonb),
                'total', (SELECT COUNT(*) FROM filtered_orders),
                'stats', v_stats
            ) INTO v_result
        FROM paginated_orders t;

        RETURN COALESCE(v_result, jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'stats', v_stats));
    END;
    $function$
;

CREATE OR REPLACE FUNCTION public.get_customer_debt_summary(p_customer_b2b_id bigint)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
  v_exp RECORD;
BEGIN
  SELECT * INTO v_exp
  FROM public.get_customer_exposure_summary(p_customer_b2b_id)
  LIMIT 1;

  SELECT json_build_object(
    'customer_id', dv.customer_id,
    'customer_code', dv.customer_code,
    'customer_name', dv.customer_name,
    'total_invoiced', dv.total_invoiced,
    'total_paid', dv.total_paid,
    'actual_current_debt', dv.actual_current_debt,
    'debt_limit', c.debt_limit,
    'payment_term', c.payment_term,
    'available_credit', v_exp.available_credit,
    'pending_orders_total', v_exp.pending_orders_total,
    'total_exposure', v_exp.total_exposure
  ) INTO v_result
  FROM public.b2b_customer_debt_view dv
  JOIN public.customers_b2b c ON c.id = dv.customer_id
  WHERE dv.customer_id = p_customer_b2b_id;

  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_customer_exposure_summary(p_customer_id bigint)
 RETURNS TABLE(actual_current_debt numeric, pending_orders_total numeric, total_exposure numeric, debt_limit numeric, available_credit numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_limit NUMERIC;
    v_actual NUMERIC;
    v_pending NUMERIC;
BEGIN
    -- A. Get debt_limit from customers_b2b (NOT the view)
    SELECT c.debt_limit INTO v_limit
    FROM public.customers_b2b c
    WHERE c.id = p_customer_id;

    -- B. Get actual debt from the debt view
    SELECT COALESCE(d.actual_current_debt, 0) INTO v_actual
    FROM public.b2b_customer_debt_view d
    WHERE d.customer_id = p_customer_id;

    v_limit := COALESCE(v_limit, 0);
    v_actual := COALESCE(v_actual, 0);

    -- C. Sum of all PENDING/CONFIRMED orders not yet in actual debt
    SELECT COALESCE(SUM(o.final_amount), 0)
    INTO v_pending
    FROM public.orders o
    WHERE o.customer_id = p_customer_id
      AND o.status IN ('PENDING', 'CONFIRMED');

    -- D. Return result
    RETURN QUERY SELECT
        v_actual,
        v_pending,
        (v_actual + v_pending) as _total_exposure,
        v_limit,
        (v_limit - (v_actual + v_pending)) as _available_credit;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_customer_order_detail(p_order_id uuid, p_customer_b2b_id bigint)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order JSON;
  v_items JSON;
BEGIN
  -- Verify ownership
  SELECT json_build_object(
    'id', o.id,
    'code', o.code,
    'status', o.status,
    'payment_status', o.payment_status,
    'payment_method', o.payment_method,
    'total_amount', o.total_amount,
    'final_amount', o.final_amount,
    'shipping_fee', o.shipping_fee,
    'discount_amount', o.discount_amount,
    'delivery_address', o.delivery_address,
    'delivery_method', o.delivery_method,
    'note', o.note,
    'created_at', o.created_at,
    'updated_at', o.updated_at
  ) INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.customer_id = p_customer_b2b_id;

  IF v_order IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get items
  SELECT json_agg(json_build_object(
    'id', oi.id,
    'product_id', oi.product_id,
    'product_name', p.name,
    'product_sku', p.sku,
    'product_image', p.image_url,
    'quantity', oi.quantity,
    'uom', oi.uom,
    'unit_price', oi.unit_price,
    'discount', oi.discount,
    'total_line', oi.total_line,
    'batch_no', oi.batch_no,
    'expiry_date', oi.expiry_date
  )) INTO v_items
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = p_order_id;

  RETURN json_build_object(
    'order', v_order,
    'items', COALESCE(v_items, '[]'::json)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_customer_orders(p_customer_b2b_id bigint, p_status text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_offset INT;
  v_total BIGINT;
  v_data JSON;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  SELECT COUNT(*) INTO v_total
  FROM public.orders o
  WHERE o.customer_id = p_customer_b2b_id
    AND (p_status IS NULL OR o.status = p_status);

  SELECT json_agg(row_data) INTO v_data
  FROM (
    SELECT
      o.id,
      o.code,
      o.status,
      o.payment_status,
      o.total_amount,
      o.final_amount,
      o.shipping_fee,
      o.discount_amount,
      o.delivery_address,
      o.delivery_method,
      o.note,
      o.created_at,
      o.updated_at,
      (SELECT COUNT(*) FROM public.order_items oi WHERE oi.order_id = o.id) AS item_count
    FROM public.orders o
    WHERE o.customer_id = p_customer_b2b_id
      AND (p_status IS NULL OR o.status = p_status)
    ORDER BY o.created_at DESC
    LIMIT p_page_size OFFSET v_offset
  ) row_data;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_customer_product_prices(p_customer_b2b_id bigint, p_product_ids bigint[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(json_build_object(
    'product_id', p.id,
    'list_price', COALESCE(
      (SELECT pu.price_sell FROM public.product_units pu
       WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1),
      p.actual_cost
    ),
    'customer_price', LEAST(
      -- Standard Wholesale Price
      COALESCE(
        (SELECT pu.price_sell FROM public.product_units pu
         WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1),
        p.actual_cost
      ),
      -- Active Deal Price if applicable
      COALESCE(
        (SELECT 
            CASE 
                WHEN d.discount_type = 'percent' THEN pu.price_sell * (1 - d.discount_value / 100.0)
                ELSE pu.price_sell - d.discount_value
            END
         FROM public.v_active_deals d
         JOIN public.product_units pu ON pu.product_id = d.product_id AND pu.unit_type = 'wholesale'
         WHERE d.product_id = p.id
         LIMIT 1),
        999999999 -- High fallback if no deal
      )
    ),
    'unit_name', COALESCE(
      (SELECT pu.unit_name FROM public.product_units pu
       WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1),
      p.wholesale_unit
    )
  )) INTO v_result
  FROM public.products p
  WHERE p.id = ANY(p_product_ids)
    AND p.status = 'active'
    AND (p_customer_b2b_id = p_customer_b2b_id);

  RETURN COALESCE(v_result, '[]'::json);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_inbound_detail(p_po_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_po_info JSONB;
    v_items JSONB;
BEGIN
    -- A. Header Info
    SELECT jsonb_build_object(
        'id', po.id,
        'code', po.code,
        'supplier_name', COALESCE(s.name, 'N/A'),
        'note', po.note,
        'status', po.delivery_status,
        'expected_date', po.expected_delivery_date,
        'expected_time', po.expected_delivery_time,
        
        -- [CORE FIX]: Lấy dữ liệu nháp ném lên cho Frontend phục hồi state
        'draft_data', COALESCE(po.receipt_draft, '[]'::jsonb),

        'logistics', jsonb_build_object(
            'total_packages', COALESCE(po.total_packages, 1),
            'carrier_name', COALESCE(po.carrier_name, 'Tự vận chuyển'),
            'carrier_contact', po.carrier_contact,
            'carrier_phone', po.carrier_phone
        )
    ) INTO v_po_info
    FROM public.purchase_orders po
    LEFT JOIN public.suppliers s ON po.supplier_id = s.id
    WHERE po.id = p_po_id;

    IF v_po_info IS NULL THEN RETURN NULL; END IF;

    -- B. Items List
    SELECT jsonb_agg(
        jsonb_build_object(
            'product_id', poi.product_id,
            'product_name', p.name,
            'sku', p.sku,
            'image_url', COALESCE(p.image_url, ''),
            'unit', poi.unit,
            'stock_management_type', p.stock_management_type,
            'quantity_ordered', poi.quantity_ordered,
            'quantity_received_prev', COALESCE(poi.quantity_received, 0),
            'quantity_remaining', GREATEST(0, poi.quantity_ordered - COALESCE(poi.quantity_received, 0)),
            
            -- Chia ngược số lượng thực nhận (Base Unit) cho conversion_factor để hiển thị chuẩn
            'received_batches', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'lot_number', iri.lot_number,
                    'expiry_date', iri.expiry_date,
                    'quantity', FLOOR(iri.quantity::NUMERIC / GREATEST(COALESCE(poi.conversion_factor, 1), 1))::INTEGER
                ))
                FROM public.inventory_receipts ir
                JOIN public.inventory_receipt_items iri ON ir.id = iri.receipt_id
                WHERE ir.po_id = p_po_id AND iri.product_id = poi.product_id
            ), '[]'::jsonb)
        )
    ) INTO v_items
    FROM public.purchase_order_items poi
    JOIN public.products p ON poi.product_id = p.id
    WHERE poi.po_id = p_po_id;

    RETURN jsonb_build_object(
        'po_info', v_po_info,
        'items', COALESCE(v_items, '[]'::jsonb)
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_permissions_for_user(p_user_id uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_perms TEXT[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT rp.permission_key)
  INTO v_perms
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  WHERE ur.user_id = p_user_id;

  RETURN COALESCE(v_perms, ARRAY[]::TEXT[]);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_po_logistics_stats(p_search text DEFAULT NULL::text, p_status_delivery text DEFAULT NULL::text, p_status_payment text DEFAULT NULL::text, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(method text, total_cartons bigint, order_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    BEGIN
        RETURN QUERY
        SELECT
            COALESCE(po.delivery_method, 'other') AS method,
            COALESCE(SUM(po.total_packages), 0)::BIGINT AS total_cartons,
            COUNT(po.id)::BIGINT AS order_count
        FROM public.purchase_orders po
        LEFT JOIN public.suppliers s ON po.supplier_id = s.id
        WHERE
            (p_status_delivery IS NULL OR p_status_delivery = '' OR po.delivery_status = p_status_delivery)
            AND (p_status_payment IS NULL OR p_status_payment = '' OR po.payment_status = p_status_payment)
            AND (p_date_from IS NULL OR po.created_at >= p_date_from)
            AND (p_date_to IS NULL OR po.created_at <= p_date_to)
            AND (
                p_search IS NULL OR p_search = ''
                OR po.code ILIKE ('%' || p_search || '%')
                OR s.name ILIKE ('%' || p_search || '%')
            )
        GROUP BY po.delivery_method
        ORDER BY total_cartons DESC;
    END;
    $function$
;

CREATE OR REPLACE FUNCTION public.get_portal_user_profile(p_auth_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'portal_user', json_build_object(
      'id', pu.id,
      'auth_user_id', pu.auth_user_id,
      'customer_b2b_id', pu.customer_b2b_id,
      'display_name', pu.display_name,
      'email', pu.email,
      'phone', pu.phone,
      'role', pu.role,
      'status', pu.status,
      'last_login_at', pu.last_login_at
    ),
    'customer', json_build_object(
      'id', c.id,
      'customer_code', c.customer_code,
      'name', c.name,
      'phone', c.phone,
      'email', c.email,
      'tax_code', c.tax_code,
      'vat_address', c.vat_address,
      'shipping_address', c.shipping_address,
      'debt_limit', c.debt_limit,
      'current_debt', c.current_debt,
      'payment_term', c.payment_term,
      'ranking', c.ranking,
      'status', c.status
    )
  ) INTO v_result
  FROM public.portal_users pu
  JOIN public.customers_b2b c ON c.id = pu.customer_b2b_id
  WHERE pu.auth_user_id = p_auth_user_id
    AND pu.status = 'active';

  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_prescription_templates(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text)
 RETURNS SETOF public.prescription_templates
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.prescription_templates
    WHERE
        (p_status IS NULL OR p_status = '' OR status = p_status)
        AND
        (p_search IS NULL OR p_search = '' OR name ILIKE '%' || p_search || '%' OR diagnosis ILIKE '%' || p_search || '%')
    ORDER BY created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_products_list(search_query text, category_filter text, manufacturer_filter text, status_filter text, page_num integer, page_size integer)
 RETURNS TABLE(key text, id bigint, name text, sku text, image_url text, category_name text, manufacturer_name text, status text, inventory_b2b integer, inventory_pkdh integer, inventory_ntdh1 integer, inventory_ntdh2 integer, inventory_potec integer, total_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH filtered_products AS (
        SELECT
            p.id,
            p.name,
            p.sku,
            p.image_url,
            p.category_name,
            p.manufacturer_name,
            p.status,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 1) AS inventory_b2b,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 2) AS inventory_pkdh,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 3) AS inventory_ntdh1,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 4) AS inventory_ntdh2,
            (SELECT COALESCE(sum(pi.stock_quantity), 0) FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 5) AS inventory_potec
        FROM
            public.products p
        WHERE
            (search_query IS NULL OR search_query = '' OR p.fts @@ to_tsquery('simple', search_query || ':*'))
        AND
            (category_filter IS NULL OR category_filter = '' OR p.category_name = category_filter)
        AND
            (manufacturer_filter IS NULL OR manufacturer_filter = '' OR p.manufacturer_name = manufacturer_filter)
        AND
            (status_filter IS NULL OR status_filter = '' OR p.status = status_filter)
    ),
    counted_products AS (
        SELECT *, COUNT(*) OVER() as total_count FROM filtered_products
    )
    SELECT
        cp.id::TEXT AS key,
        cp.id,
        cp.name,
        cp.sku,
        cp.image_url,
        cp.category_name,
        cp.manufacturer_name,
        cp.status,
        cp.inventory_b2b::INT,
        cp.inventory_pkdh::INT,
        cp.inventory_ntdh1::INT,
        cp.inventory_ntdh2::INT,
        cp.inventory_potec::INT,
        cp.total_count
    FROM
        counted_products cp
    ORDER BY
        cp.id DESC
    LIMIT
        page_size
    OFFSET
        (page_num - 1) * page_size;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_purchase_order_detail(p_po_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_purchase_orders_master(p_page integer, p_page_size integer, p_search text, p_status_delivery text, p_status_payment text, p_status text DEFAULT NULL::text, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(id bigint, code text, supplier_id bigint, supplier_name text, delivery_method text, shipping_partner_name text, delivery_status text, payment_status text, status text, final_amount numeric, total_paid numeric, total_quantity numeric, total_cartons numeric, delivery_progress numeric, expected_delivery_date timestamp with time zone, expected_delivery_time timestamp with time zone, created_at timestamp with time zone, carrier_name text, carrier_contact text, carrier_phone text, total_packages integer, full_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
            (p_status IS NULL OR p_status = '' OR LOWER(po.status) = LOWER(p_status))
            AND (p_status_delivery IS NULL OR p_status_delivery = '' OR LOWER(po.delivery_status) = LOWER(p_status_delivery))
            AND (p_status_payment IS NULL OR p_status_payment = '' OR LOWER(po.payment_status) = LOWER(p_status_payment))
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_service_packages_list(p_search_query text, p_type_filter text, p_status_filter text, p_page_num integer, p_page_size integer)
 RETURNS TABLE(key text, id bigint, name text, sku text, type public.service_package_type, price numeric, total_cost_price numeric, valid_from date, valid_to date, status public.account_status, clinical_category text, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH filtered_data AS (
    SELECT
      s.id,
      s.name,
      s.sku,
      s.type,
      s.price,
      s.total_cost_price,
      s.valid_from,
      s.valid_to,
      s.status,
      s.clinical_category,
      COUNT(*) OVER() AS total_count
    FROM
      public.service_packages s
    WHERE
      (p_type_filter IS NULL OR p_type_filter = '' OR s.type = p_type_filter::public.service_package_type)
    AND
      (p_status_filter IS NULL OR p_status_filter = '' OR s.status = p_status_filter::public.account_status)
    AND
      (p_search_query IS NULL OR p_search_query = '' OR
        s.name ILIKE ('%' || p_search_query || '%') OR
        s.sku ILIKE ('%' || p_search_query || '%')
      )
  )
  SELECT
    fd.id::TEXT AS key,
    fd.*
  FROM
    filtered_data fd
  ORDER BY
    fd.id DESC
  LIMIT p_page_size
  OFFSET (p_page_num - 1) * p_page_size;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_shipping_partners_list(p_search_query text, p_type_filter text)
 RETURNS TABLE(key text, id bigint, name text, type public.shipping_partner_type, contact_person text, phone text, cut_off_time time without time zone, status public.account_status, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH filtered_partners AS (
    SELECT
      p.id,
      p.name,
      p.type,
      p.contact_person,
      p.phone,
      p.cut_off_time,
      p.status,
      COUNT(*) OVER() AS total_count
    FROM
      public.shipping_partners p
    WHERE
      (p_type_filter IS NULL OR p_type_filter = '' OR p.type = p_type_filter::public.shipping_partner_type)
    AND
      (
        p_search_query IS NULL OR p_search_query = '' OR
        p.name ILIKE ('%' || p_search_query || '%') OR
        p.contact_person ILIKE ('%' || p_search_query || '%') OR
        p.phone ILIKE ('%' || p_search_query || '%')
      )
  )
  SELECT
    fp.id::TEXT AS key,
    fp.id,
    fp.name,
    fp.type,
    fp.contact_person,
    fp.phone,
    fp.cut_off_time,
    fp.status,
    fp.total_count
  FROM
    filtered_partners fp
  ORDER BY
    fp.name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_suppliers_list(search_query text, status_filter text, page_num integer, page_size integer)
 RETURNS TABLE(id bigint, key text, code text, name text, contact_person text, phone text, status text, debt numeric, bank_bin text, bank_account text, bank_name text, bank_holder text, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    WITH
    -- A. Tổng giá trị nhập hàng (Purchase Orders)
    po_total AS (
        SELECT po.supplier_id,
               SUM(po.final_amount) as amount
        FROM public.purchase_orders po
        WHERE po.status <> 'CANCELLED'
        GROUP BY po.supplier_id
    ),

    -- B. Nợ đầu kỳ (Finance Transactions)
    opening_debt AS (
        SELECT ft.partner_id::BIGINT as supplier_id,
               SUM(ft.amount) as amount
        FROM public.finance_transactions ft
        WHERE ft.partner_type = 'supplier'
          AND ft.business_type = 'opening_balance'
        GROUP BY ft.partner_id
    ),

    -- C. Tổng tiền ĐÃ CHI TRẢ (Finance Transactions)
    paid_total AS (
        SELECT ft.partner_id::BIGINT as supplier_id,
               SUM(ft.amount) as amount
        FROM public.finance_transactions ft
        WHERE ft.partner_type = 'supplier'
          AND ft.flow = 'out'
          AND ft.status = 'completed'
          AND ft.business_type <> 'opening_balance'
        GROUP BY ft.partner_id
    ),

    filtered_suppliers AS (
        SELECT
            s.id,
            s.id::TEXT AS key,
            ('NCC-' || s.id::TEXT) AS code,
            s.name,
            s.contact_person,
            s.phone,
            s.status,
            -- Công thức: nợ = tổng đơn hàng + nợ đầu kỳ - đã trả
            (
                COALESCE(pt.amount, 0) +
                COALESCE(od.amount, 0) -
                COALESCE(pd.amount, 0)
            ) AS debt,
            s.bank_bin,
            s.bank_account,
            s.bank_name,
            s.bank_holder,
            COUNT(*) OVER() as total_count
        FROM public.suppliers s
        LEFT JOIN po_total pt ON s.id = pt.supplier_id
        LEFT JOIN opening_debt od ON s.id = od.supplier_id
        LEFT JOIN paid_total pd ON s.id = pd.supplier_id
        WHERE
            (search_query IS NULL OR search_query = '' OR (
                s.name ILIKE ('%' || search_query || '%') OR
                s.phone ILIKE ('%' || search_query || '%') OR
                s.id::TEXT ILIKE ('%' || search_query || '%')
            ))
        AND
            (status_filter IS NULL OR status_filter = '' OR s.status = status_filter)
    )
    SELECT *
    FROM filtered_suppliers
    ORDER BY id DESC
    LIMIT page_size
    OFFSET (page_num - 1) * page_size;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_transaction_history(p_flow public.transaction_flow DEFAULT NULL::public.transaction_flow, p_fund_id bigint DEFAULT NULL::bigint, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text)
 RETURNS TABLE(id bigint, code text, transaction_date timestamp with time zone, flow public.transaction_flow, amount numeric, fund_name text, partner_name text, category_name text, description text, business_type public.business_type, created_by_name text, status public.transaction_status, ref_advance_id bigint, evidence_url text, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        t.id, t.code, t.transaction_date, t.flow, t.amount,
        f.name as fund_name,
        COALESCE(t.partner_name_cache, 'Khác') as partner_name,
        cat.name as category_name,
        t.description, t.business_type,
        u.full_name as created_by_name,
        t.status, t.ref_advance_id, t.evidence_url,
        COUNT(*) OVER() as total_count
    FROM public.finance_transactions t
    JOIN public.fund_accounts f ON t.fund_account_id = f.id
    LEFT JOIN public.transaction_categories cat ON t.category_id = cat.id
    LEFT JOIN public.users u ON t.created_by = u.id
    WHERE
        (p_flow IS NULL OR t.flow = p_flow)
        AND (p_fund_id IS NULL OR t.fund_account_id = p_fund_id)
        AND (p_date_from IS NULL OR t.transaction_date >= p_date_from)
        AND (p_date_to IS NULL OR t.transaction_date <= p_date_to)
        AND (p_status IS NULL OR p_status = '' OR t.status = p_status::public.transaction_status)
        AND (
            p_search IS NULL OR p_search = '' OR
            t.code ILIKE '%' || p_search || '%' OR
            t.description ILIKE '%' || p_search || '%' OR
            t.partner_name_cache ILIKE '%' || p_search || '%'
        )
    ORDER BY t.transaction_date DESC
    LIMIT p_limit OFFSET p_offset;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_vaccination_templates(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text)
 RETURNS TABLE(id bigint, name text, description text, min_age_months integer, max_age_months integer, status text, created_at timestamp with time zone, updated_at timestamp with time zone, item_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.name,
        t.description,
        t.min_age_months,
        t.max_age_months,
        t.status,
        t.created_at,
        t.updated_at,
        (SELECT COUNT(*) FROM public.vaccination_template_items i WHERE i.template_id = t.id) AS item_count
    FROM public.vaccination_templates t
    WHERE
        (p_status IS NULL OR p_status = '' OR t.status = p_status)
        AND
        (p_search IS NULL OR p_search = '' OR t.name ILIKE '%' || p_search || '%')
    ORDER BY t.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND rp.permission_key = 'admin-all'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_authenticated()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL;
$function$
;

CREATE OR REPLACE FUNCTION public.match_products_from_excel(p_data jsonb)
 RETURNS TABLE(excel_sku text, excel_name text, product_id bigint, product_name text, product_sku text, product_status text, base_unit text, similarity_score double precision)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    item jsonb;
    v_sku text;
    v_name text;
    rec record;
    best_match record;
    current_score double precision;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(p_data)
    LOOP
        v_sku := trim(both from (item->>'excel_sku'));
        v_name := item->>'excel_name';
        best_match := null;
        current_score := 0;

        -- 1. Exact SKU Match (Active only)
        IF v_sku IS NOT NULL AND v_sku <> '' THEN
            SELECT id, name, sku, status, retail_unit, 1.0 as score
            INTO rec
            FROM products
            WHERE sku = v_sku AND status = 'active'
            LIMIT 1;
            IF FOUND THEN
                best_match := rec;
                current_score := 1.0;
            END IF;
        END IF;

        -- 2. Exact Name Match
        IF best_match IS NULL AND v_name IS NOT NULL AND v_name <> '' THEN
            SELECT id, name, sku, status, retail_unit, 1.0 as score
            INTO rec
            FROM products
            WHERE lower(name) = lower(v_name) AND status = 'active'
            LIMIT 1;
            IF FOUND THEN
                best_match := rec;
                current_score := 1.0;
            END IF;
        END IF;

        -- 3. Fuzzy Name Match (pg_trgm similarity > 0.4)
        IF best_match IS NULL AND v_name IS NOT NULL AND v_name <> '' THEN
            SELECT id, name, sku, status, retail_unit, similarity(name, v_name) as score
            INTO rec
            FROM products
            WHERE status = 'active'
              AND similarity(name, v_name) > 0.4
            ORDER BY similarity(name, v_name) DESC
            LIMIT 1;
            IF FOUND THEN
                best_match := rec;
                current_score := rec.score;
            END IF;
        END IF;

        excel_sku := v_sku;
        excel_name := v_name;
        IF best_match IS NOT NULL THEN
            product_id := best_match.id;
            product_name := best_match.name;
            product_sku := best_match.sku;
            product_status := best_match.status;
            base_unit := best_match.retail_unit;
            similarity_score := current_score;
        ELSE
            product_id := null;
            product_name := null;
            product_sku := null;
            product_status := null;
            base_unit := null;
            similarity_score := 0;
        END IF;

        RETURN NEXT;
    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.process_vat_export_entry(p_invoice_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice RECORD;
  v_item JSONB;
  v_product_id BIGINT;
  v_unit_name TEXT;
  v_qty_input NUMERIC;
  v_vat_rate NUMERIC;
  v_conversion_rate NUMERIC;
  v_qty_base NUMERIC;
  v_current_balance NUMERIC;
BEGIN
  -- 0. Permission guard
  PERFORM public.check_rpc_access('process_vat_export_entry');

  -- 1. Get invoice
  SELECT * INTO v_invoice FROM public.finance_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hóa đơn #% không tồn tại', p_invoice_id;
  END IF;

  -- 2. Loop through raw_items
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_invoice.raw_items, '[]'::JSONB))
  LOOP
    v_qty_input := COALESCE((v_item->>'quantity')::NUMERIC, 0);
    IF v_qty_input <= 0 THEN CONTINUE; END IF;

    -- Strict unit validation: no fallback default
    v_unit_name := COALESCE(NULLIF(TRIM(v_item->>'unit'), ''), NULLIF(TRIM(v_item->>'internal_unit'), ''));
    IF v_unit_name IS NULL THEN
      RAISE EXCEPTION 'Item thieu don vi tinh (unit). Invoice #%', p_invoice_id;
    END IF;

    v_vat_rate := COALESCE((v_item->>'vat_rate')::NUMERIC, 0);

    -- Mandatory product_id: no name-based fallback
    v_product_id := (v_item->>'product_id')::BIGINT;
    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Item thieu product_id. Invoice #%, item: %', p_invoice_id, v_item->>'product_name';
    END IF;

    -- Find conversion rate
    SELECT conversion_rate INTO v_conversion_rate
    FROM public.product_units
    WHERE product_id = v_product_id AND unit_name = v_unit_name
    LIMIT 1;
    IF v_conversion_rate IS NULL THEN
      RAISE EXCEPTION 'Khong tim thay don vi "%" cho SP #%. Invoice #%',
        v_unit_name, v_product_id, p_invoice_id;
    END IF;

    v_qty_base := v_qty_input * v_conversion_rate;

    -- Check VAT inventory (with FOR UPDATE lock)
    SELECT quantity_balance INTO v_current_balance
    FROM public.vat_inventory_ledger
    WHERE product_id = v_product_id AND vat_rate = v_vat_rate
    FOR UPDATE;

    IF NOT FOUND OR v_current_balance < v_qty_base THEN
      RAISE EXCEPTION 'Khong du kho VAT cho SP #% (VAT %): Can %, Ton %',
        v_product_id, v_vat_rate, v_qty_base, COALESCE(v_current_balance, 0);
    END IF;

    -- Deduct
    UPDATE public.vat_inventory_ledger
    SET quantity_balance = quantity_balance - v_qty_base,
        updated_at = NOW()
    WHERE product_id = v_product_id AND vat_rate = v_vat_rate;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.quick_assign_barcode(p_product_id bigint, p_unit_id bigint, p_barcode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.save_inbound_draft(p_po_id bigint, p_draft_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE public.purchase_orders
    SET receipt_draft = p_draft_data,
        updated_at = NOW()
    WHERE id = p_po_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Đã lưu nháp tiến độ kiểm hàng.'
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_permissions_for_role(p_role_id uuid, p_permission_keys text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.check_rpc_access('update_permissions_for_role');

  DELETE FROM public.role_permissions WHERE role_id = p_role_id;

  INSERT INTO public.role_permissions (role_id, permission_key)
  SELECT p_role_id, unnest(p_permission_keys);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_purchase_order_logistics(p_po_id bigint, p_delivery_method text DEFAULT NULL::text, p_shipping_partner_id bigint DEFAULT NULL::bigint, p_shipping_fee numeric DEFAULT NULL::numeric, p_total_packages integer DEFAULT NULL::integer, p_expected_delivery_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_note text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.user_has_permission(p_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role_id = rp.role_id
    WHERE ur.user_id = auth.uid()
      AND (rp.permission_key = p_permission OR rp.permission_key = 'admin-all')
  );
$function$
;


