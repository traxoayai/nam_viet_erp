set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_draft_po(p_supplier_id bigint, p_expected_date timestamp with time zone, p_note text, p_delivery_method text DEFAULT 'internal'::text, p_shipping_partner_id bigint DEFAULT NULL::bigint, p_shipping_fee numeric DEFAULT 0, p_items jsonb DEFAULT '[]'::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_po_id BIGINT;
    v_item JSONB;
    v_product_record RECORD;
    v_conversion_factor INTEGER;
    v_base_quantity INTEGER;
    v_total_amount NUMERIC := 0;
    v_items_per_carton_db INTEGER;
    v_wholesale_unit_db TEXT;
    v_qty_ordered INTEGER; -- Biến tạm để xử lý logic fallback
BEGIN
    -- Insert Header
    INSERT INTO public.purchase_orders (
        code, supplier_id, creator_id, status, delivery_status, payment_status,
        expected_delivery_date, note, total_amount, final_amount,
        delivery_method, shipping_partner_id, shipping_fee
    )
    VALUES (
        'PO-' || to_char(now(), 'YYMMDD') || '-' || floor(random() * 10000)::text,
        p_supplier_id, auth.uid(), 'DRAFT', 'pending', 'unpaid',
        p_expected_date, p_note, 0, 0,
        p_delivery_method, p_shipping_partner_id, COALESCE(p_shipping_fee, 0)
    )
    RETURNING id INTO v_po_id;

    -- Insert Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- FIX QUAN TRỌNG: Đọc cả 2 key 'quantity_ordered' và 'quantity', fallback = 1
        v_qty_ordered := COALESCE(
            (v_item->>'quantity_ordered')::INTEGER, 
            (v_item->>'quantity')::INTEGER, 
            1
        );

        -- Lấy thông tin sản phẩm để tính quy đổi
        SELECT items_per_carton, wholesale_unit INTO v_product_record
        FROM public.products WHERE id = (v_item->>'product_id')::BIGINT;

        -- Tính toán quy đổi (Fallback cả uom_ordered và uom)
        v_items_per_carton_db := COALESCE(v_product_record.items_per_carton, 1);
        v_wholesale_unit_db := v_product_record.wholesale_unit;

        IF (COALESCE(v_item->>'uom_ordered', v_item->>'uom')) = v_wholesale_unit_db THEN
            v_conversion_factor := v_items_per_carton_db;
        ELSE
            v_conversion_factor := 1;
        END IF;

        -- Tính số lượng cơ sở (lẻ)
        v_base_quantity := v_qty_ordered * v_conversion_factor;

        INSERT INTO public.purchase_order_items (
            po_id, product_id, quantity_ordered, uom_ordered, unit, unit_price, conversion_factor, base_quantity
        )
        VALUES (
            v_po_id,
            (v_item->>'product_id')::BIGINT,
            v_qty_ordered, -- Sử dụng biến đã fix lỗi NULL
            COALESCE(v_item->>'uom_ordered', v_item->>'uom'), -- Fallback cho Unit
            COALESCE(v_item->>'uom_ordered', v_item->>'uom'), -- Fallback cho Unit (legacy column)
            (v_item->>'unit_price')::NUMERIC,
            v_conversion_factor,
            v_base_quantity
        );

        v_total_amount := v_total_amount + (v_qty_ordered * (v_item->>'unit_price')::NUMERIC);
    END LOOP;

    -- Update Header Total
    UPDATE public.purchase_orders
    SET total_amount = v_total_amount, final_amount = v_total_amount + COALESCE(p_shipping_fee, 0)
    WHERE id = v_po_id;

    RETURN v_po_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_user(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.users
  SET 
    status = 'active', -- Kích hoạt tài khoản
    profile_updated_at = now() -- Đảm bảo họ không bị ép onboarding nữa
  WHERE id = p_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.bulk_upsert_customers_b2b(p_customers_array jsonb[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  customer_data JSONB;
  v_customer_code_from_excel TEXT;
  v_final_customer_code TEXT;
  v_customer_b2b_id BIGINT; -- Biến để lưu ID Cty
BEGIN
  FOREACH customer_data IN ARRAY p_customers_array
  LOOP
    v_customer_code_from_excel := customer_data->>'customer_code';

    -- 1. Ưu tiên Mã KH từ Excel, nếu rỗng thì tự tạo
    SELECT 
      COALESCE(
        NULLIF(TRIM(v_customer_code_from_excel), ''), 
        'B2B-' || (nextval(pg_get_serial_sequence('public.customers_b2b', 'id')) + 10000)
      )
    INTO v_final_customer_code;

    -- 2. UPSERT vào bảng Cty (customers_b2b)
    INSERT INTO public.customers_b2b (
      customer_code, name, tax_code, debt_limit, payment_term, 
      sales_staff_id, status, phone, email, vat_address, shipping_address,
      bank_name, bank_account_name, bank_account_number,
      loyalty_points
      -- ĐÃ XÓA 'contact_person_name' VÀ 'contact_person_phone' KHỎI ĐÂY
    ) VALUES (
      v_final_customer_code,
      customer_data->>'name',
      customer_data->>'tax_code',
      (customer_data->>'debt_limit')::NUMERIC,
      (customer_data->>'payment_term')::INT,
      (customer_data->>'sales_staff_id')::UUID,
      'active',
      customer_data->>'phone',
      customer_data->>'email',
      customer_data->>'vat_address',
      customer_data->>'shipping_address',
      customer_data->>'bank_name',
      customer_data->>'bank_account_name',
      customer_data->>'bank_account_number',
      (customer_data->>'loyalty_points')::INT
    )
    ON CONFLICT (customer_code) 
    DO UPDATE SET
      name = EXCLUDED.name,
      tax_code = EXCLUDED.tax_code,
      debt_limit = EXCLUDED.debt_limit,
      payment_term = EXCLUDED.payment_term,
      sales_staff_id = EXCLUDED.sales_staff_id,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      vat_address = EXCLUDED.vat_address,
      shipping_address = EXCLUDED.shipping_address,
      bank_name = EXCLUDED.bank_name,
      bank_account_name = EXCLUDED.bank_account_name,
      bank_account_number = EXCLUDED.bank_account_number,
      loyalty_points = EXCLUDED.loyalty_points,
      updated_at = now()
    RETURNING id INTO v_customer_b2b_id; -- Lấy ID Cty vừa UPSERT

    -- 3. THÊM MỚI: Upsert Người liên hệ vào bảng 'customer_b2b_contacts'
    -- Chỉ chạy nếu SĐT người liên hệ tồn tại trong file Excel
    IF customer_data->>'contact_person_phone' IS NOT NULL THEN
      INSERT INTO public.customer_b2b_contacts (
        customer_b2b_id, 
        name, 
        phone,
        position,
        is_primary
      ) VALUES (
        v_customer_b2b_id,
        customer_data->>'contact_person_name',
        customer_data->>'contact_person_phone',
        'Liên hệ Import', -- Gán 1 chức vụ tạm
        true -- Mặc định người import là liên hệ chính
      )
      -- Dùng 2 khóa (Sếp vừa tạo ở Block 1)
      ON CONFLICT (customer_b2b_id, phone) 
      DO UPDATE SET 
        name = EXCLUDED.name,
        position = EXCLUDED.position,
        is_primary = true;
    END IF;
      
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.bulk_upsert_customers_b2c(p_customers_array jsonb[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
 customer_data JSONB;
 v_type TEXT;
 v_customer_code_from_excel TEXT;
 v_final_customer_code TEXT;
BEGIN
 FOREACH customer_data IN ARRAY p_customers_array
 LOOP
 v_type := customer_data->>'type';
 v_customer_code_from_excel := customer_data->>'customer_code';

 -- SỬA LỖI LOGIC:
 -- 1. Ưu tiên Mã KH từ Excel
 -- 2. Nếu Mã KH rỗng/null, tự động tạo mã mới
 SELECT 
 COALESCE(
 NULLIF(TRIM(v_customer_code_from_excel), ''), 
 'KH-' || (nextval(pg_get_serial_sequence('public.customers', 'id')) + 10000)
 )
 INTO v_final_customer_code;

 -- TRƯỜNG HỢP 1: LÀ CÁ NHÂN
 IF v_type = 'CaNhan' THEN
 INSERT INTO public.customers (
 customer_code, -- <-- THÊM CỘT
 name, type, phone, loyalty_points, status,
 email, address, dob, gender
 ) VALUES (
 v_final_customer_code, -- <-- THÊM GIÁ TRỊ
 customer_data->>'name', 'CaNhan', customer_data->>'phone',
 (customer_data->>'loyalty_points')::INT, 'active',
 customer_data->>'email', customer_data->>'address',
 (customer_data->>'dob')::DATE, (customer_data->>'gender')::public.customer_gender
 )
 -- SỬA LỖI 42P10: Dùng customer_code làm khóa
 ON CONFLICT (customer_code)
 DO UPDATE SET
 name = EXCLUDED.name,
 phone = EXCLUDED.phone,
 loyalty_points = EXCLUDED.loyalty_points,
 email = EXCLUDED.email,
 address = EXCLUDED.address,
 dob = EXCLUDED.dob,
 gender = EXCLUDED.gender,
 updated_at = now();
 
 -- TRƯỜNG HỢP 2: LÀ TỔ CHỨC
 ELSIF v_type = 'ToChuc' THEN
 INSERT INTO public.customers (
 customer_code, -- <-- THÊM CỘT
 name, type, phone, tax_code, 
 contact_person_name, contact_person_phone, 
 loyalty_points, status
 ) VALUES (
 v_final_customer_code, -- <-- THÊM GIÁ TRỊ
 customer_data->>'name', 'ToChuc', customer_data->>'phone',
 customer_data->>'tax_code',
 customer_data->>'contact_person_name',
 customer_data->>'contact_person_phone',
 (customer_data->>'loyalty_points')::INT, 'active'
 )
 -- SỬA LỖI 42P10: Dùng customer_code làm khóa
 ON CONFLICT (customer_code)
 DO UPDATE SET
 name = EXCLUDED.name,
 phone = EXCLUDED.phone,
 tax_code = EXCLUDED.tax_code,
 contact_person_name = EXCLUDED.contact_person_name,
 contact_person_phone = EXCLUDED.contact_person_phone,
 loyalty_points = EXCLUDED.loyalty_points,
 updated_at = now();
 END IF;
 END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.bulk_upsert_products(p_products_array jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  product_data JSONB;
  v_product_id BIGINT;
  v_warehouse_id BIGINT;
  v_branch_key TEXT;
  v_inventory_settings JSONB;
BEGIN
  -- iterate JSONB array elements
  FOR product_data IN SELECT value FROM jsonb_array_elements(p_products_array) AS t(value)
  LOOP
    -- Upsert into products
    INSERT INTO public.products (
      name, sku, barcode, active_ingredient, image_url,
      category_name, manufacturer_name, distributor_id, status,
      invoice_price, actual_cost, wholesale_unit, retail_unit, conversion_factor
    )
    VALUES (
      product_data->>'name',
      product_data->>'sku',
      product_data->>'barcode',
      product_data->>'active_ingredient',
      product_data->>'image_url',
      product_data->>'category_name',
      product_data->>'manufacturer_name',
      (product_data->>'distributor_id')::BIGINT,
      product_data->>'status',
      (product_data->>'invoice_price')::NUMERIC,
      (product_data->>'actual_cost')::NUMERIC,
      product_data->>'wholesale_unit',
      product_data->>'retail_unit',
      (product_data->>'conversion_factor')::INT
    )
    ON CONFLICT (sku)
    DO UPDATE SET
      name = EXCLUDED.name,
      barcode = EXCLUDED.barcode,
      active_ingredient = EXCLUDED.active_ingredient,
      category_name = EXCLUDED.category_name,
      manufacturer_name = EXCLUDED.manufacturer_name,
      distributor_id = EXCLUDED.distributor_id,
      status = EXCLUDED.status,
      invoice_price = EXCLUDED.invoice_price,
      actual_cost = EXCLUDED.actual_cost,
      updated_at = now()
    RETURNING id INTO v_product_id;

    -- handle inventory_settings if present
    v_inventory_settings := product_data->'inventory_settings';

    IF v_inventory_settings IS NOT NULL THEN
      -- loop keys of the object
      FOR v_branch_key IN SELECT key FROM jsonb_object_keys(v_inventory_settings) AS t(key)
      LOOP
        SELECT id INTO v_warehouse_id FROM public.warehouses WHERE key = v_branch_key;

        IF v_warehouse_id IS NOT NULL THEN
          INSERT INTO public.product_inventory (product_id, warehouse_id, stock_quantity)
          VALUES (
            v_product_id,
            v_warehouse_id,
            (v_inventory_settings->>v_branch_key)::INT
          )
          ON CONFLICT (product_id, warehouse_id)
          DO UPDATE SET stock_quantity = EXCLUDED.stock_quantity;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_asset(p_asset_data jsonb, p_maintenance_plans jsonb, p_maintenance_history jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_asset_id BIGINT;
  v_asset_code TEXT;
  v_plan JSONB;
  v_history JSONB;
BEGIN
  -- Insert asset (without asset_code)
  INSERT INTO public.assets (
    name, description, serial_number, image_url,
    asset_type_id, branch_id, user_id, status, handed_over_date,
    purchase_date, supplier_id, cost, depreciation_months
  )
  VALUES (
    p_asset_data->>'name',
    p_asset_data->>'description',
    p_asset_data->>'serial_number',
    p_asset_data->>'image_url',
    (p_asset_data->>'asset_type_id')::BIGINT,
    (p_asset_data->>'branch_id')::BIGINT,
    (p_asset_data->>'user_id')::UUID,
    (p_asset_data->>'status')::public.asset_status,
    (p_asset_data->>'handed_over_date')::DATE,
    (p_asset_data->>'purchase_date')::DATE,
    (p_asset_data->>'supplier_id')::BIGINT,
    (p_asset_data->>'cost')::NUMERIC,
    (p_asset_data->>'depreciation_months')::INT
  )
  RETURNING id INTO v_asset_id;

  -- Build asset_code deterministically from id
  v_asset_code := 'TS-' || (v_asset_id + 10000)::TEXT;

  -- Update record with generated asset_code
  UPDATE public.assets SET asset_code = v_asset_code WHERE id = v_asset_id;

  -- Insert maintenance plans (if provided)
  FOR v_plan IN SELECT * FROM jsonb_array_elements(coalesce(p_maintenance_plans, '[]'::jsonb))
  LOOP
    INSERT INTO public.asset_maintenance_plans (
      asset_id, content, frequency_months, exec_type,
      assigned_user_id, provider_name, provider_phone, provider_note
    )
    VALUES (
      v_asset_id,
      v_plan->>'content',
      (v_plan->>'frequency_months')::INT,
      (v_plan->>'exec_type')::public.maintenance_exec_type,
      (v_plan->>'assigned_user_id')::UUID,
      v_plan->>'provider_name',
      v_plan->>'provider_phone',
      v_plan->>'provider_note'
    );
  END LOOP;

  -- Insert maintenance history (if provided)
  FOR v_history IN SELECT * FROM jsonb_array_elements(coalesce(p_maintenance_history, '[]'::jsonb))
  LOOP
    INSERT INTO public.asset_maintenance_history (
      asset_id, maintenance_date, content, cost
    )
    VALUES (
      v_asset_id,
      (v_history->>'maintenance_date')::DATE,
      v_history->>'content',
      (v_history->>'cost')::NUMERIC
    );
  END LOOP;

  RETURN v_asset_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_customer_b2b(p_customer_data jsonb, p_contacts jsonb[])
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_customer_id BIGINT;
  v_customer_code TEXT;
  v_contact JSONB;
BEGIN
  -- 1. Tạo Mã KH
  SELECT 'B2B-' || (nextval(pg_get_serial_sequence('public.customers_b2b', 'id')) + 10000)
  INTO v_customer_code;

  -- 2. Tạo Khách hàng
  INSERT INTO public.customers_b2b (
    customer_code, name, tax_code, debt_limit, payment_term, ranking,
    business_license_number, 
    business_license_url, -- <-- SỬA LỖI: THÊM CỘT NÀY
    sales_staff_id, status, phone, email,
    vat_address, shipping_address, gps_lat, gps_long,
    bank_name, bank_account_name, bank_account_number,
    loyalty_points -- <-- SỬA LỖI: THÊM CỘT NÀY
  )
  VALUES (
    v_customer_code,
    p_customer_data->>'name',
    p_customer_data->>'tax_code',
    (p_customer_data->>'debt_limit')::NUMERIC,
    (p_customer_data->>'payment_term')::INT,
    p_customer_data->>'ranking',
    p_customer_data->>'business_license_number',
    p_customer_data->>'business_license_url', -- <-- SỬA LỖI: THÊM GIÁ TRỊ
    (p_customer_data->>'sales_staff_id')::UUID,
    (p_customer_data->>'status')::public.account_status,
    p_customer_data->>'phone',
    p_customer_data->>'email',
    p_customer_data->>'vat_address',
    p_customer_data->>'shipping_address',
    (p_customer_data->>'gps_lat')::NUMERIC,
    (p_customer_data->>'gps_long')::NUMERIC,
    p_customer_data->>'bank_name',
    p_customer_data->>'bank_account_name',
    p_customer_data->>'bank_account_number',
    (p_customer_data->>'loyalty_points')::INT -- <-- SỬA LỖI: THÊM GIÁ TRỊ
  )
  RETURNING id INTO v_customer_id;

  -- 3. Loop qua mảng Người liên hệ
  IF p_contacts IS NOT NULL THEN
    FOREACH v_contact IN ARRAY p_contacts
    LOOP
      INSERT INTO public.customer_b2b_contacts (
        customer_b2b_id, name, position, phone, email
      ) VALUES (
        v_customer_id,
        v_contact->>'name',
        v_contact->>'position',
        v_contact->>'phone',
        v_contact->>'email'
      );
    END LOOP;
  END IF;

  RETURN v_customer_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_customer_b2c(p_customer_data jsonb, p_guardians jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
 v_customer_id BIGINT;
 v_customer_code TEXT;
 v_guardian JSONB;
BEGIN
 -- 1. Tạo mã KH tự động
 SELECT 'KH-' || (nextval(pg_get_serial_sequence('public.customers', 'id')) + 10000)
 INTO v_customer_code;

 -- 2. Tạo khách hàng
 INSERT INTO public.customers (
 customer_code, name, type, phone, email, address,
 dob, gender, cccd, cccd_issue_date, avatar_url,
 occupation, lifestyle_habits, allergies, medical_history, 
 status,
 tax_code, contact_person_name, 
 contact_person_phone -- <-- THÊM CỘT BỊ THIẾU
 )
 VALUES (
 v_customer_code,
 p_customer_data->>'name',
 (p_customer_data->>'type')::public.customer_b2c_type,
 p_customer_data->>'phone',
 p_customer_data->>'email',
 p_customer_data->>'address',
 (p_customer_data->>'dob')::DATE,
 (p_customer_data->>'gender')::public.customer_gender,
 p_customer_data->>'cccd',
 (p_customer_data->>'cccd_issue_date')::DATE,
 p_customer_data->>'avatar_url',
 p_customer_data->>'occupation',
 p_customer_data->>'lifestyle_habits',
 p_customer_data->>'allergies',
 p_customer_data->>'medical_history',
 (p_customer_data->>'status')::public.account_status,
 p_customer_data->>'tax_code',
 p_customer_data->>'contact_person_name',
 p_customer_data->>'contact_person_phone' -- <-- THÊM GIÁ TRỊ BỊ THIẾU
 )
 RETURNING id INTO v_customer_id;

 -- 3. Thêm Người Giám hộ (Chỉ chạy nếu là 'CaNhan')
 IF p_guardians IS NOT NULL AND (p_customer_data->>'type')::public.customer_b2c_type = 'CaNhan' THEN
 FOR v_guardian IN SELECT * FROM jsonb_array_elements(p_guardians)
 LOOP
 INSERT INTO public.customer_guardians (customer_id, guardian_id, relationship)
 VALUES (
 v_customer_id,
 (v_guardian->>'guardian_id')::BIGINT,
 v_guardian->>'relationship'
 );
 END LOOP;
 END IF;

 RETURN v_customer_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_new_auth_user(p_email text, p_password text, p_full_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
  v_instance_id UUID;
BEGIN
  -- SỬA LỖI 42704: Lấy instance_id từ bảng auth.instances
  SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at
  )
  VALUES (
    v_instance_id, -- Dùng biến đã lấy
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')), -- Mã hóa mật khẩu
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_full_name),
    now(),
    now()
  ) RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_shipping_partner(p_partner_data jsonb, p_rules jsonb[])
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_partner_id BIGINT;
  v_rule JSONB;
BEGIN
  -- 1. Tạo Đối tác
  INSERT INTO public.shipping_partners (
    name, type, contact_person, phone, email, address,
    notes, status, cut_off_time
  )
  VALUES (
    p_partner_data->>'name',
    (p_partner_data->>'type')::public.shipping_partner_type,
    p_partner_data->>'contact_person',
    p_partner_data->>'phone',
    p_partner_data->>'email',
    p_partner_data->>'address',
    p_partner_data->>'notes',
    (p_partner_data->>'status')::public.account_status,
    (p_partner_data->>'cut_off_time')::TIME
  )
  RETURNING id INTO v_partner_id;

  -- 2. Loop qua mảng Quy tắc Vùng
  IF p_rules IS NOT NULL THEN
    FOREACH v_rule IN ARRAY p_rules
    LOOP
      INSERT INTO public.shipping_rules (
        partner_id, zone_name, speed_hours, fee
      ) VALUES (
        v_partner_id,
        v_rule->>'zone_name',
        (v_rule->>'speed_hours')::INT,
        (v_rule->>'fee')::NUMERIC
      );
    END LOOP;
  END IF;

  RETURN v_partner_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_asset(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM public.assets WHERE id = p_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_auth_user(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Xóa user khỏi bảng 'auth.users'
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_customer_b2b(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.customers_b2b
  SET status = 'inactive'
  WHERE id = p_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_customer_b2c(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
 -- Chỉ cập nhật trạng thái, không xóa vĩnh viễn
 UPDATE public.customers
 SET status = 'inactive'
 WHERE id = p_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_products(p_ids bigint[])
 RETURNS void
 LANGUAGE sql
AS $function$
    DELETE FROM public.products
    WHERE id = ANY(p_ids);
$function$
;

CREATE OR REPLACE FUNCTION public.delete_shipping_partner(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.shipping_partners
  SET status = 'inactive'
  WHERE id = p_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_supplier(p_id bigint)
 RETURNS void
 LANGUAGE sql
AS $function$
    DELETE FROM public.suppliers
    WHERE id = p_id;
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
    -- SỬA LỖI: Lấy dữ liệu từ bảng contacts
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
  -- NỐI SANG BẢNG CONTACTS ĐỂ LẤY 1 NGƯỜI LIÊN HỆ
  LEFT JOIN LATERAL (
    SELECT cc.name, cc.phone
    FROM public.customer_b2b_contacts cc
    WHERE cc.customer_b2b_id = c.id
    ORDER BY cc.is_primary DESC, cc.id ASC -- Ưu tiên 'is_primary'
    LIMIT 1
  ) contacts ON true
  WHERE
    (status_filter IS NULL OR c.status = status_filter::public.account_status)
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
 (status_filter IS NULL OR c.status = status_filter::public.account_status)
 AND
 (type_filter IS NULL OR c.type = type_filter::public.customer_b2c_type)
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
 -- (ĐÃ LOẠI BỎ LIMIT VÀ OFFSET)
END;
$function$
;

CREATE OR REPLACE FUNCTION public.export_products_list(search_query text, category_filter text, manufacturer_filter text, status_filter text)
 RETURNS TABLE(key text, id bigint, name text, sku text, image_url text, category_name text, manufacturer_name text, status text, inventory_b2b integer, inventory_pkdh integer, inventory_ntdh1 integer, inventory_ntdh2 integer, inventory_potec integer, total_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    -- (Logic y hệt get_products_list, NHƯNG BỎ PHÂN TRANG)
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
            (category_filter IS NULL OR p.category_name = category_filter)
        AND
            (manufacturer_filter IS NULL OR p.manufacturer_name = manufacturer_filter)
        AND
            (status_filter IS NULL OR p.status = status_filter)
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
    -- (Bỏ LIMIT và OFFSET)
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_asset_details(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_details JSONB;
BEGIN
  SELECT jsonb_build_object(
    'asset', to_jsonb(a.*),
    'maintenance_plans', (
      SELECT jsonb_agg(to_jsonb(p.*))
      FROM public.asset_maintenance_plans p
      WHERE p.asset_id = a.id
    ),
    'maintenance_history', (
      SELECT jsonb_agg(to_jsonb(h.*))
      FROM public.asset_maintenance_history h
      WHERE h.asset_id = a.id
    )
  )
  INTO v_details
  FROM public.assets a
  WHERE a.id = p_id;

  RETURN v_details;
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
    AND (status_filter IS NULL OR a.status::text = status_filter)
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

CREATE OR REPLACE FUNCTION public.get_customer_b2b_details(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_details JSONB;
BEGIN
  SELECT
    jsonb_build_object(
      -- 1. Thông tin chính
      'customer', to_jsonb(c.*),
      
      -- 2. Gom mảng Người liên hệ
      'contacts', (
        SELECT jsonb_agg(to_jsonb(cc.*))
        FROM public.customer_b2b_contacts cc
        WHERE cc.customer_b2b_id = c.id
      ),
      
      -- 3. Gom mảng Lịch sử GD (Tạm thời)
      'history', '[]'::JSONB
    )
  INTO v_details
  FROM public.customers_b2b c
  WHERE c.id = p_id;
  
  RETURN v_details;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_customer_b2c_details(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
v_details JSONB;
BEGIN
SELECT
 jsonb_build_object(
 'customer', to_jsonb(c.*),
 
 'guardians', (
 SELECT jsonb_agg(
 jsonb_build_object(
 'id', g.id, -- ID của dòng liên kết
 'guardian_id', g.guardian_id, -- ID của người giám hộ
 'name', guard.name, -- Tên người giám hộ
 'phone', guard.phone,
 'relationship', g.relationship
 )
 )
 FROM public.customer_guardians g
 JOIN public.customers guard ON g.guardian_id = guard.id
 WHERE g.customer_id = c.id
 ),

 'history', (
 -- (SENKO: Tạm thời trả mảng rỗng, Sếp và Em sẽ làm sau)
'[]'::JSONB
 )
 )
 INTO v_details
 FROM public.customers c
 WHERE c.id = p_id;
 
 RETURN v_details;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_customers_b2b_list(search_query text, sales_staff_filter uuid, status_filter text, page_num integer, page_size integer)
 RETURNS TABLE(key text, id bigint, customer_code text, name text, phone text, sales_staff_name text, debt_limit numeric, current_debt numeric, status public.account_status, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH filtered_customers AS (
    SELECT
      c.id,
      c.customer_code,
      c.name,
      c.phone,
      -- SỬA LỖI TẠI ĐÂY: Chỉ định rõ auth.users.id
      (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE auth.users.id = c.sales_staff_id) AS sales_staff_name,
      c.debt_limit,
      0::NUMERIC AS current_debt,
      c.status,
      COUNT(*) OVER() AS total_count
    FROM
      public.customers_b2b c
    WHERE
      (status_filter IS NULL OR c.status = status_filter::public.account_status)
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
  )
  SELECT
    fc.id::TEXT AS key,
    fc.id,
    fc.customer_code,
    fc.name,
    fc.phone,
    fc.sales_staff_name,
    fc.debt_limit,
    fc.current_debt,
    fc.status,
    fc.total_count
  FROM
    filtered_customers fc
  ORDER BY
    fc.id DESC
  LIMIT page_size
  OFFSET (page_num - 1) * page_size;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_customers_b2c_list(search_query text, type_filter text, status_filter text)
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
 (status_filter IS NULL OR c.status = status_filter::public.account_status)
 AND
 (type_filter IS NULL OR c.type = type_filter::public.customer_b2c_type)
 AND
 (
  search_query IS NULL OR search_query = '' OR
  
  -- 1. Tìm theo tên, mã KH (cho cả hai)
  c.name ILIKE ('%' || search_query || '%') OR
  c.customer_code ILIKE ('%' || search_query || '%') OR
  
  -- 2. Tìm SĐT (Cá nhân)
  c.phone ILIKE ('%' || search_query || '%') OR
  
  -- 3. NÂNG CẤP: Tìm SĐT (Người liên hệ của Tổ chức)
  c.contact_person_phone ILIKE ('%' || search_query || '%') OR
  
  -- 4. Tìm SĐT (Người Giám hộ - vẫn giữ nguyên)
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

CREATE OR REPLACE FUNCTION public.get_customers_b2c_list(search_query text, type_filter text, status_filter text, page_num integer, page_size integer)
 RETURNS TABLE(key text, id bigint, customer_code text, name text, type public.customer_b2c_type, phone text, loyalty_points integer, status public.account_status, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
 RETURN QUERY
 WITH filtered_customers AS (
 	-- (Nội dung CTE này giữ nguyên)
  SELECT
 c.id, c.customer_code, c.name, c.type, c.phone, 
 c.loyalty_points, c.status,
 COUNT(*) OVER() AS total_count
  FROM
 public.customers c
  WHERE
 (status_filter IS NULL OR c.status = status_filter::public.account_status)
  AND
 (type_filter IS NULL OR c.type = type_filter::public.customer_b2c_type)
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
  fc.id DESC
 -- THÊM LOGIC PHÂN TRANG
 LIMIT page_size
 OFFSET (page_num - 1) * page_size;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_product_details(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    product_details JSONB;
    inventory_settings JSONB;
BEGIN
    -- 1. Lấy thông tin sản phẩm cơ bản
    SELECT
        jsonb_build_object(
            'productName', p.name,
            'sku', p.sku,
            'barcode', p.barcode,
            'tags', p.active_ingredient,
            'imageUrl', p.image_url,
            'category', p.category_name,
            'manufacturer', p.manufacturer_name,
            'distributor', p.distributor_id,
            'description', p.description,
            -- (SENKO: Thêm các trường HDSD... sau)
            'invoicePrice', p.invoice_price,
            'actualCost', p.actual_cost,
            'wholesaleUnit', p.wholesale_unit,
            'retailUnit', p.retail_unit,
            'conversionFactor', p.conversion_factor,
            'wholesaleMarginValue', p.wholesale_margin_value,
            'wholesaleMarginType', p.wholesale_margin_type,
            'retailMarginValue', p.retail_margin_value,
            'retailMarginType', p.retail_margin_type
        )
    INTO product_details
    FROM public.products p
    WHERE p.id = p_id;

    -- 2. Lấy cài đặt tồn kho và gom thành JSON
    SELECT
        jsonb_object_agg(
            w.key, -- Dùng 'b2b', 'pkdh' làm key
            jsonb_build_object(
                'min', pi.min_stock,
                'max', pi.max_stock
            )
        )
    INTO inventory_settings
    FROM public.product_inventory pi
    JOIN public.warehouses w ON pi.warehouse_id = w.id
    WHERE pi.product_id = p_id;

    -- 3. Trả về 1 JSON duy nhất
    RETURN product_details || jsonb_build_object('inventorySettings', inventory_settings);
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
            (category_filter IS NULL OR p.category_name = category_filter) -- Đổi sang lọc TEXT
        AND
            (manufacturer_filter IS NULL OR p.manufacturer_name = manufacturer_filter) -- Đổi sang lọc TEXT
        AND
            (status_filter IS NULL OR p.status = status_filter)
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

CREATE OR REPLACE FUNCTION public.get_self_profile()
 RETURNS SETOF public.users
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT *
  FROM public.users
  WHERE id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.get_shipping_partner_details(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_details JSONB;
BEGIN
  SELECT
    jsonb_build_object(
      -- 1. Thông tin chính (từ bảng 'shipping_partners')
      'partner', to_jsonb(p.*),
      
      -- 2. Gom mảng Quy tắc Vùng (từ bảng 'shipping_rules')
      'rules', (
        SELECT COALESCE(jsonb_agg(to_jsonb(r.*)), '[]'::JSONB)
        FROM public.shipping_rules r
        WHERE r.partner_id = p.id
      )
    )
  INTO v_details
  FROM public.shipping_partners p
  WHERE p.id = p_id;
  
  RETURN v_details;
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
      (p_type_filter IS NULL OR p.type = p_type_filter::public.shipping_partner_type)
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
  -- (Chưa phân trang, vì Sếp thường có ít đối tác vận chuyển)
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_suppliers_list(search_query text, status_filter text, page_num integer, page_size integer)
 RETURNS TABLE(id bigint, key text, code text, name text, contact_person text, phone text, status text, debt numeric, total_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH filtered_suppliers AS (
        SELECT
            s.id,
            s.id::TEXT AS key,
            'NCC-' || s.id::TEXT AS code, -- Tự động tạo Mã NCC
            s.name,
            s.contact_person,
            s.phone,
            s.status,
            0::NUMERIC AS debt, -- (SENKO: Tạm thời để 0, sẽ tích hợp Tài chính sau)
            COUNT(*) OVER() as total_count
        FROM
            public.suppliers s
        WHERE
            (search_query IS NULL OR search_query = '' OR (
                s.name ILIKE ('%' || search_query || '%') OR
                s.phone ILIKE ('%' || search_query || '%') OR
                s.id::TEXT ILIKE ('%' || search_query || '%')
            ))
        AND
            (status_filter IS NULL OR s.status = status_filter)
    )
    SELECT *
    FROM filtered_suppliers
    ORDER BY id DESC
    LIMIT page_size
    OFFSET (page_num - 1) * page_size;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_users_with_roles()
 RETURNS TABLE(key text, id uuid, name text, email text, avatar text, status text, assignments jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    a_user.id::TEXT AS key,
    a_user.id,
    p_user.full_name AS name,
    a_user.email::TEXT AS email, -- SỬA LỖI: Ép kiểu 'auth.users.email' sang TEXT
    p_user.avatar_url AS avatar,
    p_user.status::TEXT AS status,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'branchId', w.id,
        'branchName', w.name,
        'roleId', r.id,
        'roleName', r.name
      ))
      FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      JOIN public.warehouses w ON ur.branch_id = w.id -- (Đã sửa)
      WHERE ur.user_id = a_user.id
    ) AS assignments
  FROM 
    auth.users AS a_user
  LEFT JOIN 
    public.users AS p_user ON a_user.id = p_user.id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Chèn 1 dòng mới vào 'public.users'
  INSERT INTO public.users (id, email, full_name, avatar_url, status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    'pending_approval' -- Mặc định là "Chờ duyệt"
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.invite_new_user(p_email text, p_full_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  -- Mời user mới, Supabase sẽ xử lý việc gửi email
  v_user_id := auth.invite_user_by_email(
    p_email,
    jsonb_build_object(
      'full_name', p_full_name
    )
  );
  
  -- (Quan trọng: Cập nhật lại metadata vì hàm invite đôi khi bị trễ)
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('full_name', p_full_name)
  WHERE id = v_user_id;

  RETURN v_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reactivate_customer_b2b(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
 UPDATE public.customers_b2b
 SET status = 'active', updated_at = now()
 WHERE id = p_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reactivate_customer_b2c(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
 UPDATE public.customers
 SET status = 'active', updated_at = now()
 WHERE id = p_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reactivate_shipping_partner(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.shipping_partners
  SET status = 'active'
  WHERE id = p_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.search_customers_by_phone_b2c(p_search_query text)
 RETURNS TABLE(key text, id bigint, customer_code text, name text, type public.customer_b2c_type, phone text, loyalty_points integer, status public.account_status)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
 RETURN QUERY
 SELECT
 c.id::TEXT AS key,
 c.id,
 c.customer_code,
 c.name,
 c.type,
 c.phone,
 c.loyalty_points,
 c.status
 FROM
 public.customers c
 WHERE
 c.type = 'CaNhan' -- Chỉ tìm cá nhân
 AND
 (
 c.name ILIKE ('%' || p_search_query || '%') OR
 c.phone ILIKE ('%' || p_search_query || '%')
 )
 LIMIT 10; -- Giới hạn 10 kết quả
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_asset(p_id bigint, p_asset_data jsonb, p_maintenance_plans jsonb, p_maintenance_history jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_plan JSONB;
  v_history JSONB;
BEGIN
  UPDATE public.assets
  SET
    name = p_asset_data->>'name',
    description = p_asset_data->>'description',
    serial_number = p_asset_data->>'serial_number',
    image_url = p_asset_data->>'image_url',
    asset_type_id = (p_asset_data->>'asset_type_id')::BIGINT,
    branch_id = (p_asset_data->>'branch_id')::BIGINT,
    user_id = (p_asset_data->>'user_id')::UUID,
    status = (p_asset_data->>'status')::public.asset_status,
    handed_over_date = (p_asset_data->>'handed_over_date')::DATE,
    purchase_date = (p_asset_data->>'purchase_date')::DATE,
    supplier_id = (p_asset_data->>'supplier_id')::BIGINT,
    cost = (p_asset_data->>'cost')::NUMERIC,
    depreciation_months = (p_asset_data->>'depreciation_months')::INT,
    updated_at = now()
  WHERE id = p_id;

  -- Replace maintenance plans
  DELETE FROM public.asset_maintenance_plans WHERE asset_id = p_id;
  FOR v_plan IN SELECT * FROM jsonb_array_elements(coalesce(p_maintenance_plans, '[]'::jsonb))
  LOOP
    INSERT INTO public.asset_maintenance_plans (
      asset_id, content, frequency_months, exec_type,
      assigned_user_id, provider_name, provider_phone, provider_note
    )
    VALUES (
      p_id,
      v_plan->>'content',
      (v_plan->>'frequency_months')::INT,
      (v_plan->>'exec_type')::public.maintenance_exec_type,
      (v_plan->>'assigned_user_id')::UUID,
      v_plan->>'provider_name',
      v_plan->>'provider_phone',
      v_plan->>'provider_note'
    );
  END LOOP;

  -- Replace maintenance history
  DELETE FROM public.asset_maintenance_history WHERE asset_id = p_id;
  FOR v_history IN SELECT * FROM jsonb_array_elements(coalesce(p_maintenance_history, '[]'::jsonb))
  LOOP
    INSERT INTO public.asset_maintenance_history (
      asset_id, maintenance_date, content, cost
    )
    VALUES (
      p_id,
      (v_history->>'maintenance_date')::DATE,
      v_history->>'content',
      (v_history->>'cost')::NUMERIC
    );
  END LOOP;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_customer_b2b(p_id bigint, p_customer_data jsonb, p_contacts jsonb[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_contact JSONB;
BEGIN
  -- 1. Cập nhật Khách hàng
  UPDATE public.customers_b2b
  SET
    name = p_customer_data->>'name',
    tax_code = p_customer_data->>'tax_code',
    debt_limit = (p_customer_data->>'debt_limit')::NUMERIC,
    payment_term = (p_customer_data->>'payment_term')::INT,
    ranking = p_customer_data->>'ranking',
    business_license_number = p_customer_data->>'business_license_number',
    business_license_url = p_customer_data->>'business_license_url', -- <-- SỬA LỖI: THÊM DÒNG NÀY
    sales_staff_id = (p_customer_data->>'sales_staff_id')::UUID,
    status = (p_customer_data->>'status')::public.account_status,
    phone = p_customer_data->>'phone',
    email = p_customer_data->>'email',
    vat_address = p_customer_data->>'vat_address',
    shipping_address = p_customer_data->>'shipping_address',
    gps_lat = (p_customer_data->>'gps_lat')::NUMERIC,
    gps_long = (p_customer_data->>'gps_long')::NUMERIC,
    bank_name = p_customer_data->>'bank_name',
    bank_account_name = p_customer_data->>'bank_account_name',
    bank_account_number = p_customer_data->>'bank_account_number',
    loyalty_points = (p_customer_data->>'loyalty_points')::INT, -- <-- SỬA LỖI: THÊM DÒNG NÀY
    updated_at = now()
  WHERE id = p_id;

  -- 2. Xóa sạch và thêm lại Người liên hệ
  DELETE FROM public.customer_b2b_contacts WHERE customer_b2b_id = p_id;

  -- 3. Thêm lại Người liên hệ mới
  IF p_contacts IS NOT NULL THEN
    FOREACH v_contact IN ARRAY p_contacts
    LOOP
      INSERT INTO public.customer_b2b_contacts (
        customer_b2b_id, name, position, phone, email
      ) VALUES (
        p_id,
        v_contact->>'name',
        v_contact->>'position',
        v_contact->>'phone',
        v_contact->>'email'
      );
    END LOOP;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_customer_b2c(p_id bigint, p_customer_data jsonb, p_guardians jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
 v_guardian JSONB;
BEGIN
 -- 1. Cập nhật bảng customers
 UPDATE public.customers
 SET
 name = p_customer_data->>'name',
 type = (p_customer_data->>'type')::public.customer_b2c_type,
 phone = p_customer_data->>'phone',
 email = p_customer_data->>'email',
 address = p_customer_data->>'address',
 -- 'CaNhan' fields
 dob = (p_customer_data->>'dob')::DATE,
 gender = (p_customer_data->>'gender')::public.customer_gender,
 cccd = p_customer_data->>'cccd',
 cccd_issue_date = (p_customer_data->>'cccd_issue_date')::DATE,
 avatar_url = p_customer_data->>'avatar_url',
 occupation = p_customer_data->>'occupation',
 lifestyle_habits = p_customer_data->>'lifestyle_habits',
 allergies = p_customer_data->>'allergies',
 medical_history = p_customer_data->>'medical_history',
 status = (p_customer_data->>'status')::public.account_status,
 -- 'ToChuc' fields
 tax_code = p_customer_data->>'tax_code',
 contact_person_name = p_customer_data->>'contact_person_name',
 contact_person_phone = p_customer_data->>'contact_person_phone', -- <-- THÊM DÒNG BỊ THIẾU
 
 updated_at = now()
 WHERE id = p_id;

 -- 2. Xóa sạch và thêm lại Người Giám hộ
 DELETE FROM public.customer_guardians WHERE customer_id = p_id;
 
 IF p_guardians IS NOT NULL AND (p_customer_data->>'type')::public.customer_b2c_type = 'CaNhan' THEN
 FOR v_guardian IN SELECT * FROM jsonb_array_elements(p_guardians)
 LOOP
 INSERT INTO public.customer_guardians (customer_id, guardian_id, relationship)
 VALUES (
 p_id,
 (v_guardian->>'guardian_id')::BIGINT,
 v_guardian->>'relationship'
 )
 ON CONFLICT (customer_id, guardian_id) DO NOTHING;
 END LOOP;
 END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_permissions_for_role(p_role_id uuid, p_permission_keys text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- 1. Xóa tất cả quyền cũ của vai trò này
  DELETE FROM public.role_permissions WHERE role_id = p_role_id;
  
  -- 2. Thêm tất cả quyền mới từ mảng Sếp gửi lên
  INSERT INTO public.role_permissions (role_id, permission_key)
  SELECT p_role_id, unnest(p_permission_keys);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_product_status(p_ids bigint[], p_status text)
 RETURNS void
 LANGUAGE sql
AS $function$
    UPDATE public.products
    SET status = p_status, updated_at = now()
    WHERE id = ANY(p_ids);
$function$
;

CREATE OR REPLACE FUNCTION public.update_purchase_order(p_po_id bigint, p_supplier_id bigint, p_expected_date timestamp with time zone, p_note text, p_items jsonb, p_delivery_method text DEFAULT 'internal'::text, p_shipping_partner_id bigint DEFAULT NULL::bigint, p_shipping_fee numeric DEFAULT 0, p_status text DEFAULT 'DRAFT'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_item JSONB;
    v_product_record RECORD;
    v_conversion_factor INTEGER;
    v_base_quantity INTEGER;
    v_total_amount NUMERIC := 0;
    v_qty_ordered INTEGER; -- Biến tạm
    v_current_status TEXT;
BEGIN
    -- Check trạng thái trước khi update
    SELECT status INTO v_current_status FROM public.purchase_orders WHERE id = p_po_id;
    IF v_current_status NOT IN ('DRAFT', 'PENDING', 'REJECTED') THEN
        RAISE EXCEPTION 'Không thể sửa đơn hàng đã được Duyệt hoặc Đang nhập kho.';
    END IF;

    -- Update Header
    UPDATE public.purchase_orders
    SET supplier_id = p_supplier_id, expected_delivery_date = p_expected_date,
        note = p_note, delivery_method = p_delivery_method,
        shipping_partner_id = p_shipping_partner_id, shipping_fee = COALESCE(p_shipping_fee, 0),
        status = p_status, updated_at = NOW()
    WHERE id = p_po_id;

    -- Reset Items
    DELETE FROM public.purchase_order_items WHERE po_id = p_po_id;

    -- Insert Items mới
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- FIX QUAN TRỌNG: Fallback quantity
        v_qty_ordered := COALESCE(
            (v_item->>'quantity_ordered')::INTEGER, 
            (v_item->>'quantity')::INTEGER, 
            1
        );

        SELECT items_per_carton, wholesale_unit INTO v_product_record
        FROM public.products WHERE id = (v_item->>'product_id')::BIGINT;

        IF (COALESCE(v_item->>'uom_ordered', v_item->>'uom')) = v_product_record.wholesale_unit THEN
            v_conversion_factor := COALESCE(v_product_record.items_per_carton, 1);
        ELSE
            v_conversion_factor := 1;
        END IF;

        v_base_quantity := v_qty_ordered * v_conversion_factor;

        INSERT INTO public.purchase_order_items (
            po_id, product_id, quantity_ordered, uom_ordered, unit, unit_price, conversion_factor, base_quantity
        )
        VALUES (
            p_po_id,
            (v_item->>'product_id')::BIGINT,
            v_qty_ordered, -- Sử dụng biến đã fix
            COALESCE(v_item->>'uom_ordered', v_item->>'uom'),
            COALESCE(v_item->>'uom_ordered', v_item->>'uom'),
            (v_item->>'unit_price')::NUMERIC,
            v_conversion_factor,
            v_base_quantity
        );

        v_total_amount := v_total_amount + (v_qty_ordered * (v_item->>'unit_price')::NUMERIC);
    END LOOP;

    UPDATE public.purchase_orders
    SET total_amount = v_total_amount,
        final_amount = v_total_amount + COALESCE(p_shipping_fee, 0)
    WHERE id = p_po_id;

    RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_self_profile(p_profile_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.users
  SET
    -- Dữ liệu HCNS (Từ Canvas)
    full_name = p_profile_data->>'full_name',
    dob = (p_profile_data->>'dob')::DATE,
    phone = p_profile_data->>'phone',
    gender = p_profile_data->>'gender',
    cccd = p_profile_data->>'cccd',
    cccd_issue_date = (p_profile_data->>'cccd_issue_date')::DATE,
    address = p_profile_data->>'address',
    marital_status = p_profile_data->>'marital_status',
    
    -- Hình ảnh (Từ Canvas)
    avatar_url = p_profile_data->>'avatar_url',
    cccd_front_url = p_profile_data->>'cccd_front_url',
    cccd_back_url = p_profile_data->>'cccd_back_url',
    
    -- Học vấn (Từ Canvas)
    education_level = p_profile_data->>'education_level',
    specialization = p_profile_data->>'specialization',
    
    -- Ngân hàng (Từ Canvas)
    bank_name = p_profile_data->>'bank_name',
    bank_account_number = p_profile_data->>'bank_account_number',
    bank_account_name = p_profile_data->>'bank_account_name',
    
    -- Profile Thấu cảm (Từ Canvas)
    hobbies = p_profile_data->>'hobbies',
    limitations = p_profile_data->>'limitations',
    strengths = p_profile_data->>'strengths',
    needs = p_profile_data->>'needs',

    -- CỘT KIỂM SOÁT (Bước 5 của Sếp)
    profile_updated_at = now(), -- Đánh dấu đã cập nhật
    status = 'pending_approval' -- Chuyển sang "Chờ duyệt"
  WHERE
    id = auth.uid(); -- Chỉ cho phép user tự sửa profile của CHÍNH HỌ
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_shipping_partner(p_id bigint, p_partner_data jsonb, p_rules jsonb[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_rule JSONB;
BEGIN
  -- 1. Cập nhật Đối tác
  UPDATE public.shipping_partners
  SET
    name = p_partner_data->>'name',
    type = (p_partner_data->>'type')::public.shipping_partner_type,
    contact_person = p_partner_data->>'contact_person',
    phone = p_partner_data->>'phone',
    email = p_partner_data->>'email',
    address = p_partner_data->>'address',
    notes = p_partner_data->>'notes',
    status = (p_partner_data->>'status')::public.account_status,
    cut_off_time = (p_partner_data->>'cut_off_time')::TIME,
    updated_at = now()
  WHERE id = p_id;

  -- 2. Xóa sạch Quy tắc Vùng cũ
  DELETE FROM public.shipping_rules WHERE partner_id = p_id;

  -- 3. Thêm lại Quy tắc Vùng mới
  IF p_rules IS NOT NULL THEN
    FOREACH v_rule IN ARRAY p_rules
    LOOP
      INSERT INTO public.shipping_rules (
        partner_id, zone_name, speed_hours, fee
      ) VALUES (
        p_id,
        v_rule->>'zone_name',
        (v_rule->>'speed_hours')::INT,
        (v_rule->>'fee')::NUMERIC
      );
    END LOOP;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_assignments(p_user_id uuid, p_assignments jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_assignment JSONB;
BEGIN
  -- 1. Xóa tất cả phân quyền cũ của user này
  DELETE FROM public.user_roles WHERE user_id = p_user_id;

  -- 2. Loop qua mảng JSON và thêm lại các phân quyền mới
  FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
  LOOP
    INSERT INTO public.user_roles (user_id, role_id, branch_id)
    VALUES (
      p_user_id,
      (v_assignment->>'roleId')::UUID,
      (v_assignment->>'branchId')::BIGINT
    );
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_assignments(p_user_id uuid, p_assignments jsonb[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  assignment JSONB;
BEGIN
  -- 1. Xóa mọi quyền cũ của user này
  DELETE FROM public.user_roles WHERE user_id = p_user_id;

  -- 2. Thêm lại các quyền mới
  IF p_assignments IS NOT NULL THEN
    FOREACH assignment IN ARRAY p_assignments
    LOOP
      INSERT INTO public.user_roles (user_id, role_id, branch_id)
      VALUES (
        p_user_id,
        (assignment->>'roleId')::UUID,
        (assignment->>'branchId')::BIGINT
      )
      ;
    END LOOP;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_status(p_user_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.users
  SET status = p_status::public.employee_status
  WHERE id = p_user_id;
END;
$function$
;


