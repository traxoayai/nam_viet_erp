-- supabase/migrations/20251117185553_remote_schema.sql


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."account_balance_type" AS ENUM (
    'No',
    'Co',
    'LuongTinh'
);


ALTER TYPE "public"."account_balance_type" OWNER TO "postgres";


CREATE TYPE "public"."account_status" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "public"."account_status" OWNER TO "postgres";


CREATE TYPE "public"."account_type" AS ENUM (
    'TaiSan',
    'NoPhaiTra',
    'VonChuSoHuu',
    'DoanhThu',
    'ChiPhi'
);


ALTER TYPE "public"."account_type" OWNER TO "postgres";


CREATE TYPE "public"."asset_status" AS ENUM (
    'active',
    'storage',
    'repair',
    'disposed'
);


ALTER TYPE "public"."asset_status" OWNER TO "postgres";


CREATE TYPE "public"."customer_b2c_type" AS ENUM (
    'CaNhan',
    'ToChuc'
);


ALTER TYPE "public"."customer_b2c_type" OWNER TO "postgres";


CREATE TYPE "public"."customer_gender" AS ENUM (
    'Nam',
    'Nữ',
    'Khác'
);


ALTER TYPE "public"."customer_gender" OWNER TO "postgres";


CREATE TYPE "public"."employee_status" AS ENUM (
    'pending_approval',
    'active',
    'inactive'
);


ALTER TYPE "public"."employee_status" OWNER TO "postgres";


CREATE TYPE "public"."fund_account_status" AS ENUM (
    'active',
    'locked'
);


ALTER TYPE "public"."fund_account_status" OWNER TO "postgres";


CREATE TYPE "public"."fund_account_type" AS ENUM (
    'cash',
    'bank'
);


ALTER TYPE "public"."fund_account_type" OWNER TO "postgres";


CREATE TYPE "public"."maintenance_exec_type" AS ENUM (
    'internal',
    'external'
);


ALTER TYPE "public"."maintenance_exec_type" OWNER TO "postgres";


CREATE TYPE "public"."shipping_partner_type" AS ENUM (
    'app',
    'coach',
    'internal'
);


ALTER TYPE "public"."shipping_partner_type" OWNER TO "postgres";


CREATE TYPE "public"."template_module" AS ENUM (
    'pos',
    'b2b',
    'hr',
    'appointment',
    'accounting',
    'general'
);


ALTER TYPE "public"."template_module" OWNER TO "postgres";


CREATE TYPE "public"."template_type" AS ENUM (
    'print',
    'pdf',
    'email',
    'sms'
);


ALTER TYPE "public"."template_type" OWNER TO "postgres";


CREATE TYPE "public"."transaction_type" AS ENUM (
    'thu',
    'chi'
);


ALTER TYPE "public"."transaction_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_user"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.users
  SET 
    status = 'active', -- Kích hoạt tài khoản
    profile_updated_at = now() -- Đảm bảo họ không bị ép onboarding nữa
  WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."approve_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_upsert_customers_b2b"("p_customers_array" "jsonb"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."bulk_upsert_customers_b2b"("p_customers_array" "jsonb"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_upsert_customers_b2c"("p_customers_array" "jsonb"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."bulk_upsert_customers_b2c"("p_customers_array" "jsonb"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_upsert_products"("p_products_array" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."bulk_upsert_products"("p_products_array" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_asset"("p_asset_data" "jsonb", "p_maintenance_plans" "jsonb", "p_maintenance_history" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."create_asset"("p_asset_data" "jsonb", "p_maintenance_plans" "jsonb", "p_maintenance_history" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_customer_b2b"("p_customer_data" "jsonb", "p_contacts" "jsonb"[]) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."create_customer_b2b"("p_customer_data" "jsonb", "p_contacts" "jsonb"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_customer_b2c"("p_customer_data" "jsonb", "p_guardians" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."create_customer_b2c"("p_customer_data" "jsonb", "p_guardians" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_new_auth_user"("p_email" "text", "p_password" "text", "p_full_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."create_new_auth_user"("p_email" "text", "p_password" "text", "p_full_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_product"("p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_inventory_settings" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_product_id BIGINT;
    v_warehouse_key TEXT;
    v_warehouse_id BIGINT;
    v_min_stock INT;
    v_max_stock INT;
BEGIN
    -- 1. Tạo Sản phẩm chính (đã đơn giản hóa)
    INSERT INTO public.products (
        name, sku, barcode, active_ingredient, image_url,
        category_name, manufacturer_name, distributor_id, status,
        invoice_price, actual_cost, wholesale_unit, retail_unit, conversion_factor,
        wholesale_margin_value, wholesale_margin_type, retail_margin_value, retail_margin_type
    )
    VALUES (
        p_name, p_sku, p_barcode, p_active_ingredient, p_image_url,
        p_category_name, p_manufacturer_name, p_distributor_id, p_status,
        p_invoice_price, p_actual_cost, p_wholesale_unit, p_retail_unit, p_conversion_factor,
        p_wholesale_margin_value, p_wholesale_margin_type, p_retail_margin_value, p_retail_margin_type
    )
    RETURNING id INTO v_product_id;

    -- 2. Loop qua JSON cài đặt tồn kho (ĐÃ SỬA LỖI 'key' CỦA SẾP)
    FOR v_warehouse_key IN SELECT * FROM jsonb_object_keys(p_inventory_settings)
    LOOP
        SELECT id INTO v_warehouse_id FROM public.warehouses WHERE key = v_warehouse_key;
        
        IF v_warehouse_id IS NOT NULL THEN
            v_min_stock := (p_inventory_settings -> v_warehouse_key ->> 'min')::INT;
            v_max_stock := (p_inventory_settings -> v_warehouse_key ->> 'max')::INT;

            -- Lưu vào bảng product_inventory (đã nâng cấp)
            INSERT INTO public.product_inventory (
                product_id, 
                warehouse_id, 
                stock_quantity, 
                min_stock, 
                max_stock
            )
            VALUES (
                v_product_id, 
                v_warehouse_id, 
                0, -- Tồn kho ban đầu
                v_min_stock, 
                v_max_stock
            );
        END IF;
    END LOOP;

    RETURN v_product_id;
END;
$$;


ALTER FUNCTION "public"."create_product"("p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_inventory_settings" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_shipping_partner"("p_partner_data" "jsonb", "p_rules" "jsonb"[]) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."create_shipping_partner"("p_partner_data" "jsonb", "p_rules" "jsonb"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_supplier"("p_name" "text", "p_contact_person" "text", "p_phone" "text", "p_status" "text", "p_address" "text", "p_notes" "text") RETURNS bigint
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_supplier_id BIGINT;
BEGIN
    INSERT INTO public.suppliers (
        name, contact_person, phone, status, address, notes
    )
    VALUES (
        p_name, p_contact_person, p_phone, p_status, p_address, p_notes
    )
    RETURNING id INTO v_supplier_id;
    RETURN v_supplier_id;
END;
$$;


ALTER FUNCTION "public"."create_supplier"("p_name" "text", "p_contact_person" "text", "p_phone" "text", "p_status" "text", "p_address" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_supplier"("p_name" "text", "p_tax_code" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_address" "text", "p_payment_term" "text", "p_status" "text", "p_notes" "text") RETURNS bigint
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_supplier_id BIGINT;
BEGIN
    INSERT INTO public.suppliers (
        name, tax_code, contact_person, phone, email, address, payment_term, status, notes
    )
    VALUES (
        p_name, p_tax_code, p_contact_person, p_phone, p_email, p_address, p_payment_term, p_status, p_notes
    )
    RETURNING id INTO v_supplier_id;
    RETURN v_supplier_id;
END;
$$;


ALTER FUNCTION "public"."create_supplier"("p_name" "text", "p_tax_code" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_address" "text", "p_payment_term" "text", "p_status" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_asset"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM public.assets WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."delete_asset"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_auth_user"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Xóa user khỏi bảng 'auth.users'
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."delete_auth_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_customer_b2b"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.customers_b2b
  SET status = 'inactive'
  WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."delete_customer_b2b"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_customer_b2c"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
 -- Chỉ cập nhật trạng thái, không xóa vĩnh viễn
 UPDATE public.customers
 SET status = 'inactive'
 WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."delete_customer_b2c"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_products"("p_ids" bigint[]) RETURNS "void"
    LANGUAGE "sql"
    AS $$
    DELETE FROM public.products
    WHERE id = ANY(p_ids);
$$;


ALTER FUNCTION "public"."delete_products"("p_ids" bigint[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_shipping_partner"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.shipping_partners
  SET status = 'inactive'
  WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."delete_shipping_partner"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_supplier"("p_id" bigint) RETURNS "void"
    LANGUAGE "sql"
    AS $$
    DELETE FROM public.suppliers
    WHERE id = p_id;
$$;


ALTER FUNCTION "public"."delete_supplier"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."export_customers_b2b_list"("search_query" "text", "sales_staff_filter" "uuid", "status_filter" "text") RETURNS TABLE("id" bigint, "customer_code" "text", "name" "text", "phone" "text", "email" "text", "tax_code" "text", "contact_person_name" "text", "contact_person_phone" "text", "vat_address" "text", "shipping_address" "text", "sales_staff_name" "text", "debt_limit" numeric, "payment_term" integer, "ranking" "text", "status" "public"."account_status", "loyalty_points" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."export_customers_b2b_list"("search_query" "text", "sales_staff_filter" "uuid", "status_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."export_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text") RETURNS TABLE("key" "text", "id" bigint, "customer_code" "text", "name" "text", "type" "public"."customer_b2c_type", "phone" "text", "loyalty_points" integer, "status" "public"."account_status", "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."export_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."export_products_list"("search_query" "text", "category_filter" "text", "manufacturer_filter" "text", "status_filter" "text") RETURNS TABLE("key" "text", "id" bigint, "name" "text", "sku" "text", "image_url" "text", "category_name" "text", "manufacturer_name" "text", "status" "text", "inventory_b2b" integer, "inventory_pkdh" integer, "inventory_ntdh1" integer, "inventory_ntdh2" integer, "inventory_potec" integer, "total_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."export_products_list"("search_query" "text", "category_filter" "text", "manufacturer_filter" "text", "status_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_asset_details"("p_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_asset_details"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_assets_list"("search_query" "text", "type_filter" bigint, "branch_filter" bigint, "status_filter" "text") RETURNS TABLE("key" "text", "id" bigint, "asset_code" "text", "name" "text", "image_url" "text", "asset_type_name" "text", "branch_name" "text", "user_name" "text", "purchase_date" "date", "cost" numeric, "depreciation_months" integer, "depreciation_per_month" numeric, "remaining_value" numeric, "status" "public"."asset_status", "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_assets_list"("search_query" "text", "type_filter" bigint, "branch_filter" bigint, "status_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_customer_b2b_details"("p_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_customer_b2b_details"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_customer_b2c_details"("p_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_customer_b2c_details"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_customers_b2b_list"("search_query" "text", "sales_staff_filter" "uuid", "status_filter" "text", "page_num" integer, "page_size" integer) RETURNS TABLE("key" "text", "id" bigint, "customer_code" "text", "name" "text", "phone" "text", "sales_staff_name" "text", "debt_limit" numeric, "current_debt" numeric, "status" "public"."account_status", "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_customers_b2b_list"("search_query" "text", "sales_staff_filter" "uuid", "status_filter" "text", "page_num" integer, "page_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text") RETURNS TABLE("key" "text", "id" bigint, "customer_code" "text", "name" "text", "type" "public"."customer_b2c_type", "phone" "text", "loyalty_points" integer, "status" "public"."account_status", "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text", "page_num" integer, "page_size" integer) RETURNS TABLE("key" "text", "id" bigint, "customer_code" "text", "name" "text", "type" "public"."customer_b2c_type", "phone" "text", "loyalty_points" integer, "status" "public"."account_status", "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text", "page_num" integer, "page_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_product_details"("p_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_product_details"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_products_list"("search_query" "text", "category_filter" "text", "manufacturer_filter" "text", "status_filter" "text", "page_num" integer, "page_size" integer) RETURNS TABLE("key" "text", "id" bigint, "name" "text", "sku" "text", "image_url" "text", "category_name" "text", "manufacturer_name" "text", "status" "text", "inventory_b2b" integer, "inventory_pkdh" integer, "inventory_ntdh1" integer, "inventory_ntdh2" integer, "inventory_potec" integer, "total_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_products_list"("search_query" "text", "category_filter" "text", "manufacturer_filter" "text", "status_filter" "text", "page_num" integer, "page_size" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "avatar_url" "text",
    "employee_code" "text",
    "position" "text",
    "status" "public"."employee_status" DEFAULT 'pending_approval'::"public"."employee_status" NOT NULL,
    "dob" "date",
    "phone" "text",
    "gender" "text",
    "cccd" "text",
    "cccd_issue_date" "date",
    "address" "text",
    "marital_status" "text",
    "cccd_front_url" "text",
    "cccd_back_url" "text",
    "education_level" "text",
    "specialization" "text",
    "bank_name" "text",
    "bank_account_number" "text",
    "bank_account_name" "text",
    "hobbies" "text",
    "limitations" "text",
    "strengths" "text",
    "needs" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "profile_updated_at" timestamp with time zone
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_self_profile"() RETURNS SETOF "public"."users"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT *
  FROM public.users
  WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_self_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shipping_partner_details"("p_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_shipping_partner_details"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shipping_partners_list"("p_search_query" "text", "p_type_filter" "text") RETURNS TABLE("key" "text", "id" bigint, "name" "text", "type" "public"."shipping_partner_type", "contact_person" "text", "phone" "text", "cut_off_time" time without time zone, "status" "public"."account_status", "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_shipping_partners_list"("p_search_query" "text", "p_type_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_suppliers_list"("search_query" "text", "status_filter" "text", "page_num" integer, "page_size" integer) RETURNS TABLE("id" bigint, "key" "text", "code" "text", "name" "text", "contact_person" "text", "phone" "text", "status" "text", "debt" numeric, "total_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_suppliers_list"("search_query" "text", "status_filter" "text", "page_num" integer, "page_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_users_with_roles"() RETURNS TABLE("key" "text", "id" "uuid", "name" "text", "email" "text", "avatar" "text", "status" "text", "assignments" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_users_with_roles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_new_user"("p_email" "text", "p_full_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."invite_new_user"("p_email" "text", "p_full_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reactivate_customer_b2b"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
 UPDATE public.customers_b2b
 SET status = 'active', updated_at = now()
 WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."reactivate_customer_b2b"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reactivate_customer_b2c"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
 UPDATE public.customers
 SET status = 'active', updated_at = now()
 WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."reactivate_customer_b2c"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reactivate_shipping_partner"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.shipping_partners
  SET status = 'active'
  WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."reactivate_shipping_partner"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_customers_by_phone_b2c"("p_search_query" "text") RETURNS TABLE("key" "text", "id" bigint, "customer_code" "text", "name" "text", "type" "public"."customer_b2c_type", "phone" "text", "loyalty_points" integer, "status" "public"."account_status")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."search_customers_by_phone_b2c"("p_search_query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_asset"("p_id" bigint, "p_asset_data" "jsonb", "p_maintenance_plans" "jsonb", "p_maintenance_history" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."update_asset"("p_id" bigint, "p_asset_data" "jsonb", "p_maintenance_plans" "jsonb", "p_maintenance_history" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_customer_b2b"("p_id" bigint, "p_customer_data" "jsonb", "p_contacts" "jsonb"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."update_customer_b2b"("p_id" bigint, "p_customer_data" "jsonb", "p_contacts" "jsonb"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_customer_b2c"("p_id" bigint, "p_customer_data" "jsonb", "p_guardians" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."update_customer_b2c"("p_id" bigint, "p_customer_data" "jsonb", "p_guardians" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_permissions_for_role"("p_role_id" "uuid", "p_permission_keys" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- 1. Xóa tất cả quyền cũ của vai trò này
  DELETE FROM public.role_permissions WHERE role_id = p_role_id;
  
  -- 2. Thêm tất cả quyền mới từ mảng Sếp gửi lên
  INSERT INTO public.role_permissions (role_id, permission_key)
  SELECT p_role_id, unnest(p_permission_keys);
END;
$$;


ALTER FUNCTION "public"."update_permissions_for_role"("p_role_id" "uuid", "p_permission_keys" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_product"("p_id" bigint, "p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_inventory_settings" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_warehouse_key TEXT;
    v_warehouse_id BIGINT;
    v_min_stock INT;
    v_max_stock INT;
BEGIN
    -- 1. Cập nhật bảng Products
    UPDATE public.products
    SET
        name = p_name,
        sku = p_sku,
        barcode = p_barcode,
        active_ingredient = p_active_ingredient,
        image_url = p_image_url,
        category_name = p_category_name,
        manufacturer_name = p_manufacturer_name,
        distributor_id = p_distributor_id,
        status = p_status,
        invoice_price = p_invoice_price,
        actual_cost = p_actual_cost,
        wholesale_unit = p_wholesale_unit,
        retail_unit = p_retail_unit,
        conversion_factor = p_conversion_factor,
        wholesale_margin_value = p_wholesale_margin_value,
        wholesale_margin_type = p_wholesale_margin_type,
        retail_margin_value = p_retail_margin_value,
        retail_margin_type = p_retail_margin_type,
        updated_at = now()
    WHERE
        id = p_id;

    -- 2. Xóa cài đặt tồn kho cũ
    DELETE FROM public.product_inventory WHERE product_id = p_id;

    -- 3. Thêm cài đặt tồn kho mới (Giống hệt hàm Create)
    FOR v_warehouse_key IN SELECT * FROM jsonb_object_keys(p_inventory_settings)
    LOOP
        SELECT id INTO v_warehouse_id FROM public.warehouses WHERE key = v_warehouse_key;
        
        IF v_warehouse_id IS NOT NULL THEN
            v_min_stock := (p_inventory_settings -> v_warehouse_key ->> 'min')::INT;
            v_max_stock := (p_inventory_settings -> v_warehouse_key ->> 'max')::INT;

            INSERT INTO public.product_inventory (
                product_id, warehouse_id, stock_quantity, min_stock, max_stock
            )
            VALUES (
                p_id, v_warehouse_id, 0, v_min_stock, v_max_stock
            );
        END IF;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."update_product"("p_id" bigint, "p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_inventory_settings" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_product_status"("p_ids" bigint[], "p_status" "text") RETURNS "void"
    LANGUAGE "sql"
    AS $$
    UPDATE public.products
    SET status = p_status, updated_at = now()
    WHERE id = ANY(p_ids);
$$;


ALTER FUNCTION "public"."update_product_status"("p_ids" bigint[], "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_self_profile"("p_profile_data" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."update_self_profile"("p_profile_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_shipping_partner"("p_id" bigint, "p_partner_data" "jsonb", "p_rules" "jsonb"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."update_shipping_partner"("p_id" bigint, "p_partner_data" "jsonb", "p_rules" "jsonb"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_supplier"("p_id" bigint, "p_name" "text", "p_tax_code" "text", "p_address" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_bank_account" "text", "p_bank_name" "text", "p_bank_holder" "text", "p_payment_term" "text", "p_delivery_method" "text", "p_lead_time" integer, "p_status" "text", "p_notes" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Nâng cấp bảng suppliers (nếu các cột chưa tồn tại)
    ALTER TABLE public.suppliers
    ADD COLUMN IF NOT EXISTS tax_code TEXT,
    ADD COLUMN IF NOT EXISTS payment_term TEXT,
    ADD COLUMN IF NOT EXISTS bank_account TEXT,
    ADD COLUMN IF NOT EXISTS bank_name TEXT,
    ADD COLUMN IF NOT EXISTS bank_holder TEXT,
    ADD COLUMN IF NOT EXISTS delivery_method TEXT,
    ADD COLUMN IF NOT EXISTS lead_time INT;

    -- Cập nhật
    UPDATE public.suppliers
    SET
        name = p_name,
        tax_code = p_tax_code,
        address = p_address,
        contact_person = p_contact_person,
        phone = p_phone,
        email = p_email,
        bank_account = p_bank_account,
        bank_name = p_bank_name,
        bank_holder = p_bank_holder,
        payment_term = p_payment_term,
        delivery_method = p_delivery_method,
        lead_time = p_lead_time,
        status = p_status,
        notes = p_notes
    WHERE
        id = p_id;
END;
$$;


ALTER FUNCTION "public"."update_supplier"("p_id" bigint, "p_name" "text", "p_tax_code" "text", "p_address" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_bank_account" "text", "p_bank_name" "text", "p_bank_holder" "text", "p_payment_term" "text", "p_delivery_method" "text", "p_lead_time" integer, "p_status" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_assignments"("p_user_id" "uuid", "p_assignments" "jsonb"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."update_user_assignments"("p_user_id" "uuid", "p_assignments" "jsonb"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_assignments"("p_user_id" "uuid", "p_assignments" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."update_user_assignments"("p_user_id" "uuid", "p_assignments" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_status"("p_user_id" "uuid", "p_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.users
  SET status = p_status::public.employee_status
  WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."update_user_status"("p_user_id" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asset_maintenance_history" (
    "id" bigint NOT NULL,
    "asset_id" bigint NOT NULL,
    "maintenance_date" "date" NOT NULL,
    "content" "text" NOT NULL,
    "cost" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."asset_maintenance_history" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."asset_maintenance_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."asset_maintenance_history_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."asset_maintenance_history_id_seq" OWNED BY "public"."asset_maintenance_history"."id";



CREATE TABLE IF NOT EXISTS "public"."asset_maintenance_plans" (
    "id" bigint NOT NULL,
    "asset_id" bigint NOT NULL,
    "content" "text" NOT NULL,
    "frequency_months" integer NOT NULL,
    "exec_type" "public"."maintenance_exec_type" NOT NULL,
    "assigned_user_id" "uuid",
    "provider_name" "text",
    "provider_phone" "text",
    "provider_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."asset_maintenance_plans" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."asset_maintenance_plans_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."asset_maintenance_plans_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."asset_maintenance_plans_id_seq" OWNED BY "public"."asset_maintenance_plans"."id";



CREATE TABLE IF NOT EXISTS "public"."asset_types" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."asset_types" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."asset_types_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."asset_types_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."asset_types_id_seq" OWNED BY "public"."asset_types"."id";



CREATE TABLE IF NOT EXISTS "public"."assets" (
    "id" bigint NOT NULL,
    "asset_code" "text",
    "name" "text" NOT NULL,
    "description" "text",
    "serial_number" "text",
    "image_url" "text",
    "asset_type_id" bigint,
    "branch_id" bigint,
    "user_id" "uuid",
    "status" "public"."asset_status" DEFAULT 'storage'::"public"."asset_status" NOT NULL,
    "handed_over_date" "date",
    "purchase_date" "date",
    "supplier_id" bigint,
    "cost" numeric DEFAULT 0,
    "depreciation_months" integer DEFAULT 36,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."assets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."assets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."assets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."assets_id_seq" OWNED BY "public"."assets"."id";



CREATE TABLE IF NOT EXISTS "public"."banks" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "bin" "text" NOT NULL,
    "short_name" "text" NOT NULL,
    "logo" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "transfer_supported" boolean DEFAULT false,
    "lookup_supported" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."banks" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."banks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."banks_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."banks_id_seq" OWNED BY "public"."banks"."id";



CREATE TABLE IF NOT EXISTS "public"."chart_of_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "parent_id" "uuid",
    "type" "public"."account_type" NOT NULL,
    "balance_type" "public"."account_balance_type" NOT NULL,
    "status" "public"."account_status" DEFAULT 'active'::"public"."account_status" NOT NULL,
    "allow_posting" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chart_of_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_b2b_contacts" (
    "id" bigint NOT NULL,
    "customer_b2b_id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "position" "text",
    "phone" "text",
    "email" "text",
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customer_b2b_contacts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."customer_b2b_contacts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."customer_b2b_contacts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."customer_b2b_contacts_id_seq" OWNED BY "public"."customer_b2b_contacts"."id";



CREATE TABLE IF NOT EXISTS "public"."customer_guardians" (
    "id" bigint NOT NULL,
    "customer_id" bigint NOT NULL,
    "guardian_id" bigint NOT NULL,
    "relationship" "text"
);


ALTER TABLE "public"."customer_guardians" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."customer_guardians_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."customer_guardians_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."customer_guardians_id_seq" OWNED BY "public"."customer_guardians"."id";



CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" bigint NOT NULL,
    "customer_code" "text",
    "name" "text" NOT NULL,
    "type" "public"."customer_b2c_type" DEFAULT 'CaNhan'::"public"."customer_b2c_type" NOT NULL,
    "phone" "text",
    "email" "text",
    "address" "text",
    "dob" "date",
    "gender" "public"."customer_gender",
    "cccd" "text",
    "cccd_issue_date" "date",
    "avatar_url" "text",
    "cccd_front_url" "text",
    "cccd_back_url" "text",
    "occupation" "text",
    "lifestyle_habits" "text",
    "allergies" "text",
    "medical_history" "text",
    "tax_code" "text",
    "contact_person_name" "text",
    "loyalty_points" integer DEFAULT 0,
    "status" "public"."account_status" DEFAULT 'active'::"public"."account_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "contact_person_phone" "text"
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers_b2b" (
    "id" bigint NOT NULL,
    "customer_code" "text",
    "name" "text" NOT NULL,
    "tax_code" "text",
    "debt_limit" numeric DEFAULT 100000000,
    "payment_term" integer DEFAULT 30,
    "ranking" "text",
    "business_license_number" "text",
    "business_license_url" "text",
    "sales_staff_id" "uuid",
    "status" "public"."account_status" DEFAULT 'active'::"public"."account_status" NOT NULL,
    "phone" "text",
    "email" "text",
    "vat_address" "text",
    "shipping_address" "text",
    "gps_lat" numeric,
    "gps_long" numeric,
    "bank_name" "text",
    "bank_account_name" "text",
    "bank_account_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "loyalty_points" integer DEFAULT 0
);


ALTER TABLE "public"."customers_b2b" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."customers_b2b_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."customers_b2b_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."customers_b2b_id_seq" OWNED BY "public"."customers_b2b"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."customers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."customers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."customers_id_seq" OWNED BY "public"."customers"."id";



CREATE TABLE IF NOT EXISTS "public"."document_templates" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "module" "public"."template_module" NOT NULL,
    "type" "public"."template_type" NOT NULL,
    "status" "public"."account_status" DEFAULT 'active'::"public"."account_status" NOT NULL,
    "content" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."document_templates" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."document_templates_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."document_templates_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."document_templates_id_seq" OWNED BY "public"."document_templates"."id";



CREATE TABLE IF NOT EXISTS "public"."fund_accounts" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."fund_account_type" NOT NULL,
    "location" "text",
    "account_number" "text",
    "bank_id" bigint,
    "initial_balance" numeric DEFAULT 0 NOT NULL,
    "status" "public"."fund_account_status" DEFAULT 'active'::"public"."fund_account_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."fund_accounts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."fund_accounts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."fund_accounts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."fund_accounts_id_seq" OWNED BY "public"."fund_accounts"."id";



CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "module" "text" NOT NULL
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_inventory" (
    "id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "warehouse_id" bigint NOT NULL,
    "stock_quantity" integer DEFAULT 0 NOT NULL,
    "min_stock" integer DEFAULT 0,
    "max_stock" integer DEFAULT 0
);


ALTER TABLE "public"."product_inventory" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."product_inventory_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."product_inventory_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."product_inventory_id_seq" OWNED BY "public"."product_inventory"."id";



CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "sku" "text",
    "barcode" "text",
    "description" "text",
    "active_ingredient" "text",
    "image_url" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "fts" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"simple"'::"regconfig", ((((((COALESCE("name", ''::"text") || ' '::"text") || COALESCE("sku", ''::"text")) || ' '::"text") || COALESCE("active_ingredient", ''::"text")) || ' '::"text") || COALESCE("barcode", ''::"text")))) STORED,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category_name" "text",
    "manufacturer_name" "text",
    "distributor_id" bigint,
    "invoice_price" numeric DEFAULT 0,
    "actual_cost" numeric DEFAULT 0 NOT NULL,
    "wholesale_unit" "text" DEFAULT 'Hộp'::"text",
    "retail_unit" "text" DEFAULT 'Vỉ'::"text",
    "conversion_factor" integer DEFAULT 1,
    "wholesale_margin_value" numeric DEFAULT 0,
    "wholesale_margin_type" "text" DEFAULT '%'::"text",
    "retail_margin_value" numeric DEFAULT 0,
    "retail_margin_type" "text" DEFAULT '%'::"text"
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."products_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."products_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."products_id_seq" OWNED BY "public"."products"."id";



CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "role_id" "uuid" NOT NULL,
    "permission_key" "text" NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shipping_partners" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."shipping_partner_type" DEFAULT 'app'::"public"."shipping_partner_type" NOT NULL,
    "contact_person" "text",
    "phone" "text",
    "email" "text",
    "address" "text",
    "notes" "text",
    "status" "public"."account_status" DEFAULT 'active'::"public"."account_status" NOT NULL,
    "cut_off_time" time without time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shipping_partners" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."shipping_partners_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."shipping_partners_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."shipping_partners_id_seq" OWNED BY "public"."shipping_partners"."id";



CREATE TABLE IF NOT EXISTS "public"."shipping_rules" (
    "id" bigint NOT NULL,
    "partner_id" bigint NOT NULL,
    "zone_name" "text" NOT NULL,
    "speed_hours" integer,
    "fee" numeric DEFAULT 0
);


ALTER TABLE "public"."shipping_rules" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."shipping_rules_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."shipping_rules_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."shipping_rules_id_seq" OWNED BY "public"."shipping_rules"."id";



CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "contact_person" "text",
    "phone" "text",
    "email" "text",
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tax_code" "text",
    "payment_term" "text",
    "bank_account" "text",
    "bank_name" "text",
    "bank_holder" "text",
    "delivery_method" "text",
    "lead_time" integer,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "notes" "text" DEFAULT 'active'::"text"
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."suppliers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."suppliers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."suppliers_id_seq" OWNED BY "public"."suppliers"."id";



CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_categories" (
    "id" bigint NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."transaction_type" NOT NULL,
    "account_id" "text",
    "status" "public"."account_status" DEFAULT 'active'::"public"."account_status" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."transaction_categories" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."transaction_categories_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."transaction_categories_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."transaction_categories_id_seq" OWNED BY "public"."transaction_categories"."id";



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "branch_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."user_roles_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_roles_id_seq" OWNED BY "public"."user_roles"."id";



CREATE TABLE IF NOT EXISTS "public"."warehouses" (
    "id" bigint NOT NULL,
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "unit" "text" DEFAULT 'Hộp'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "address" "text",
    "type" "text" DEFAULT 'retail'::"text" NOT NULL,
    "latitude" numeric,
    "longitude" numeric,
    "code" "text",
    "manager" "text",
    "phone" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL
);


ALTER TABLE "public"."warehouses" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."warehouses_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."warehouses_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."warehouses_id_seq" OWNED BY "public"."warehouses"."id";



ALTER TABLE ONLY "public"."asset_maintenance_history" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."asset_maintenance_history_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."asset_maintenance_plans" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."asset_maintenance_plans_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."asset_types" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."asset_types_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."assets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."assets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."banks" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."banks_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."customer_b2b_contacts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."customer_b2b_contacts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."customer_guardians" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."customer_guardians_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."customers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."customers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."customers_b2b" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."customers_b2b_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."document_templates" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."document_templates_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."fund_accounts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."fund_accounts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."product_inventory" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."product_inventory_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."products" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."products_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."shipping_partners" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."shipping_partners_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."shipping_rules" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."shipping_rules_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."suppliers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."suppliers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."transaction_categories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."transaction_categories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_roles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_roles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."warehouses" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."warehouses_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."asset_maintenance_history"
    ADD CONSTRAINT "asset_maintenance_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asset_maintenance_plans"
    ADD CONSTRAINT "asset_maintenance_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asset_types"
    ADD CONSTRAINT "asset_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."asset_types"
    ADD CONSTRAINT "asset_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_asset_code_key" UNIQUE ("asset_code");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."banks"
    ADD CONSTRAINT "banks_bin_key" UNIQUE ("bin");



ALTER TABLE ONLY "public"."banks"
    ADD CONSTRAINT "banks_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."banks"
    ADD CONSTRAINT "banks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."banks"
    ADD CONSTRAINT "banks_short_name_key" UNIQUE ("short_name");



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_account_code_key" UNIQUE ("account_code");



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_b2b_contacts"
    ADD CONSTRAINT "customer_b2b_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_guardians"
    ADD CONSTRAINT "customer_guardians_customer_id_guardian_id_key" UNIQUE ("customer_id", "guardian_id");



ALTER TABLE ONLY "public"."customer_guardians"
    ADD CONSTRAINT "customer_guardians_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers_b2b"
    ADD CONSTRAINT "customers_b2b_customer_code_key" UNIQUE ("customer_code");



ALTER TABLE ONLY "public"."customers_b2b"
    ADD CONSTRAINT "customers_b2b_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."customers_b2b"
    ADD CONSTRAINT "customers_b2b_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_customer_code_key" UNIQUE ("customer_code");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_templates"
    ADD CONSTRAINT "document_templates_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."document_templates"
    ADD CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fund_accounts"
    ADD CONSTRAINT "fund_accounts_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."fund_accounts"
    ADD CONSTRAINT "fund_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."product_inventory"
    ADD CONSTRAINT "product_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_inventory"
    ADD CONSTRAINT "product_inventory_product_id_warehouse_id_key" UNIQUE ("product_id", "warehouse_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_sku_unique" UNIQUE ("sku");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_key");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipping_partners"
    ADD CONSTRAINT "shipping_partners_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."shipping_partners"
    ADD CONSTRAINT "shipping_partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipping_rules"
    ADD CONSTRAINT "shipping_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."transaction_categories"
    ADD CONSTRAINT "transaction_categories_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."transaction_categories"
    ADD CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_b2b_contacts"
    ADD CONSTRAINT "unique_customer_contact_phone" UNIQUE ("customer_b2b_id", "phone");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_id_branch_id_key" UNIQUE ("user_id", "role_id", "branch_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_cccd_key" UNIQUE ("cccd");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_employee_code_key" UNIQUE ("employee_code");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_customer_b2b_contacts_customer_id" ON "public"."customer_b2b_contacts" USING "btree" ("customer_b2b_id");



CREATE INDEX "idx_customers_b2b_name_trgm" ON "public"."customers_b2b" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_customers_b2b_phone" ON "public"."customers_b2b" USING "btree" ("phone");



CREATE INDEX "idx_customers_code_trgm" ON "public"."customers" USING "gin" ("customer_code" "public"."gin_trgm_ops");



CREATE INDEX "idx_customers_name_trgm" ON "public"."customers" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE UNIQUE INDEX "idx_customers_name_unique_tochuc" ON "public"."customers" USING "btree" ("name") WHERE ("type" = 'ToChuc'::"public"."customer_b2c_type");



CREATE INDEX "idx_customers_phone_trgm" ON "public"."customers" USING "gin" ("phone" "public"."gin_trgm_ops");



CREATE UNIQUE INDEX "idx_customers_phone_unique_canhan" ON "public"."customers" USING "btree" ("phone") WHERE ("type" = 'CaNhan'::"public"."customer_b2c_type");



CREATE INDEX "idx_guardians_customer_id" ON "public"."customer_guardians" USING "btree" ("customer_id");



CREATE INDEX "idx_guardians_guardian_id" ON "public"."customer_guardians" USING "btree" ("guardian_id");



CREATE INDEX "idx_shipping_partners_name_trgm" ON "public"."shipping_partners" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_shipping_rules_partner_id" ON "public"."shipping_rules" USING "btree" ("partner_id");



CREATE INDEX "idx_users_name_trgm" ON "public"."users" USING "gin" ("full_name" "public"."gin_trgm_ops");



CREATE INDEX "idx_users_phone_trgm" ON "public"."users" USING "gin" ("phone" "public"."gin_trgm_ops");



CREATE INDEX "products_fts_idx" ON "public"."products" USING "gin" ("fts");



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."assets" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."banks" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."chart_of_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."customers_b2b" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."document_templates" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."fund_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."shipping_partners" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."system_settings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."transaction_categories" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



ALTER TABLE ONLY "public"."asset_maintenance_history"
    ADD CONSTRAINT "asset_maintenance_history_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asset_maintenance_plans"
    ADD CONSTRAINT "asset_maintenance_plans_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asset_maintenance_plans"
    ADD CONSTRAINT "asset_maintenance_plans_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_asset_type_id_fkey" FOREIGN KEY ("asset_type_id") REFERENCES "public"."asset_types"("id");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_b2b_contacts"
    ADD CONSTRAINT "customer_b2b_contacts_customer_b2b_id_fkey" FOREIGN KEY ("customer_b2b_id") REFERENCES "public"."customers_b2b"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_guardians"
    ADD CONSTRAINT "customer_guardians_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_guardians"
    ADD CONSTRAINT "customer_guardians_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers_b2b"
    ADD CONSTRAINT "customers_b2b_sales_staff_id_fkey" FOREIGN KEY ("sales_staff_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."fund_accounts"
    ADD CONSTRAINT "fund_accounts_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id");



ALTER TABLE ONLY "public"."product_inventory"
    ADD CONSTRAINT "product_inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_inventory"
    ADD CONSTRAINT "product_inventory_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shipping_rules"
    ADD CONSTRAINT "shipping_rules_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."shipping_partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_categories"
    ADD CONSTRAINT "transaction_categories_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("account_code");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."warehouses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow authenticated full access" ON "public"."system_settings" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on asset_maintenance_history" ON "public"."asset_maintenance_history" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on asset_maintenance_plans" ON "public"."asset_maintenance_plans" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on asset_types" ON "public"."asset_types" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on assets" ON "public"."assets" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on banks" ON "public"."banks" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on customer_b2b_contacts" ON "public"."customer_b2b_contacts" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on customer_guardians" ON "public"."customer_guardians" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on customers" ON "public"."customers" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on customers_b2b" ON "public"."customers_b2b" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on document_templates" ON "public"."document_templates" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on fund_accounts" ON "public"."fund_accounts" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on permissions" ON "public"."permissions" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on role_permissions" ON "public"."role_permissions" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on roles" ON "public"."roles" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on shipping_partners" ON "public"."shipping_partners" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on shipping_rules" ON "public"."shipping_rules" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on transaction_categories" ON "public"."transaction_categories" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on user_roles" ON "public"."user_roles" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on users" ON "public"."users" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated read access" ON "public"."chart_of_accounts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated write access (Temporary)" ON "public"."chart_of_accounts" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."asset_maintenance_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."asset_maintenance_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."asset_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."banks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chart_of_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_b2b_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_guardians" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers_b2b" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fund_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shipping_partners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shipping_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transaction_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."approve_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_upsert_customers_b2b"("p_customers_array" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_upsert_customers_b2b"("p_customers_array" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_upsert_customers_b2b"("p_customers_array" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_upsert_customers_b2c"("p_customers_array" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_upsert_customers_b2c"("p_customers_array" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_upsert_customers_b2c"("p_customers_array" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_upsert_products"("p_products_array" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_upsert_products"("p_products_array" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_upsert_products"("p_products_array" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_asset"("p_asset_data" "jsonb", "p_maintenance_plans" "jsonb", "p_maintenance_history" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_asset"("p_asset_data" "jsonb", "p_maintenance_plans" "jsonb", "p_maintenance_history" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_asset"("p_asset_data" "jsonb", "p_maintenance_plans" "jsonb", "p_maintenance_history" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_customer_b2b"("p_customer_data" "jsonb", "p_contacts" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_customer_b2b"("p_customer_data" "jsonb", "p_contacts" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_customer_b2b"("p_customer_data" "jsonb", "p_contacts" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_customer_b2c"("p_customer_data" "jsonb", "p_guardians" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_customer_b2c"("p_customer_data" "jsonb", "p_guardians" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_customer_b2c"("p_customer_data" "jsonb", "p_guardians" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_new_auth_user"("p_email" "text", "p_password" "text", "p_full_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_new_auth_user"("p_email" "text", "p_password" "text", "p_full_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_new_auth_user"("p_email" "text", "p_password" "text", "p_full_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_product"("p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_inventory_settings" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_product"("p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_inventory_settings" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_product"("p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_inventory_settings" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_shipping_partner"("p_partner_data" "jsonb", "p_rules" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_shipping_partner"("p_partner_data" "jsonb", "p_rules" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_shipping_partner"("p_partner_data" "jsonb", "p_rules" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_supplier"("p_name" "text", "p_contact_person" "text", "p_phone" "text", "p_status" "text", "p_address" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_supplier"("p_name" "text", "p_contact_person" "text", "p_phone" "text", "p_status" "text", "p_address" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_supplier"("p_name" "text", "p_contact_person" "text", "p_phone" "text", "p_status" "text", "p_address" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_supplier"("p_name" "text", "p_tax_code" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_address" "text", "p_payment_term" "text", "p_status" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_supplier"("p_name" "text", "p_tax_code" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_address" "text", "p_payment_term" "text", "p_status" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_supplier"("p_name" "text", "p_tax_code" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_address" "text", "p_payment_term" "text", "p_status" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_asset"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_asset"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_asset"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_auth_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_auth_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_auth_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_customer_b2b"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_customer_b2b"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_customer_b2b"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_customer_b2c"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_customer_b2c"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_customer_b2c"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_products"("p_ids" bigint[]) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_products"("p_ids" bigint[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_products"("p_ids" bigint[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_shipping_partner"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_shipping_partner"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_shipping_partner"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_supplier"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_supplier"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_supplier"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."export_customers_b2b_list"("search_query" "text", "sales_staff_filter" "uuid", "status_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."export_customers_b2b_list"("search_query" "text", "sales_staff_filter" "uuid", "status_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_customers_b2b_list"("search_query" "text", "sales_staff_filter" "uuid", "status_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."export_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."export_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."export_products_list"("search_query" "text", "category_filter" "text", "manufacturer_filter" "text", "status_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."export_products_list"("search_query" "text", "category_filter" "text", "manufacturer_filter" "text", "status_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_products_list"("search_query" "text", "category_filter" "text", "manufacturer_filter" "text", "status_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_asset_details"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_asset_details"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_asset_details"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_assets_list"("search_query" "text", "type_filter" bigint, "branch_filter" bigint, "status_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_assets_list"("search_query" "text", "type_filter" bigint, "branch_filter" bigint, "status_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_assets_list"("search_query" "text", "type_filter" bigint, "branch_filter" bigint, "status_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_customer_b2b_details"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_customer_b2b_details"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_customer_b2b_details"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_customer_b2c_details"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_customer_b2c_details"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_customer_b2c_details"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_customers_b2b_list"("search_query" "text", "sales_staff_filter" "uuid", "status_filter" "text", "page_num" integer, "page_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_customers_b2b_list"("search_query" "text", "sales_staff_filter" "uuid", "status_filter" "text", "page_num" integer, "page_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_customers_b2b_list"("search_query" "text", "sales_staff_filter" "uuid", "status_filter" "text", "page_num" integer, "page_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text", "page_num" integer, "page_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text", "page_num" integer, "page_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text", "page_num" integer, "page_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_product_details"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_product_details"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_product_details"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_products_list"("search_query" "text", "category_filter" "text", "manufacturer_filter" "text", "status_filter" "text", "page_num" integer, "page_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_products_list"("search_query" "text", "category_filter" "text", "manufacturer_filter" "text", "status_filter" "text", "page_num" integer, "page_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_products_list"("search_query" "text", "category_filter" "text", "manufacturer_filter" "text", "status_filter" "text", "page_num" integer, "page_size" integer) TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_self_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_self_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_self_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shipping_partner_details"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_shipping_partner_details"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shipping_partner_details"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shipping_partners_list"("p_search_query" "text", "p_type_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_shipping_partners_list"("p_search_query" "text", "p_type_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shipping_partners_list"("p_search_query" "text", "p_type_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_suppliers_list"("search_query" "text", "status_filter" "text", "page_num" integer, "page_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_suppliers_list"("search_query" "text", "status_filter" "text", "page_num" integer, "page_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_suppliers_list"("search_query" "text", "status_filter" "text", "page_num" integer, "page_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_users_with_roles"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_users_with_roles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_users_with_roles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."invite_new_user"("p_email" "text", "p_full_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."invite_new_user"("p_email" "text", "p_full_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_new_user"("p_email" "text", "p_full_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reactivate_customer_b2b"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."reactivate_customer_b2b"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reactivate_customer_b2b"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."reactivate_customer_b2c"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."reactivate_customer_b2c"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reactivate_customer_b2c"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."reactivate_shipping_partner"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."reactivate_shipping_partner"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reactivate_shipping_partner"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_customers_by_phone_b2c"("p_search_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_customers_by_phone_b2c"("p_search_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_customers_by_phone_b2c"("p_search_query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_asset"("p_id" bigint, "p_asset_data" "jsonb", "p_maintenance_plans" "jsonb", "p_maintenance_history" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_asset"("p_id" bigint, "p_asset_data" "jsonb", "p_maintenance_plans" "jsonb", "p_maintenance_history" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_asset"("p_id" bigint, "p_asset_data" "jsonb", "p_maintenance_plans" "jsonb", "p_maintenance_history" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_customer_b2b"("p_id" bigint, "p_customer_data" "jsonb", "p_contacts" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."update_customer_b2b"("p_id" bigint, "p_customer_data" "jsonb", "p_contacts" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_customer_b2b"("p_id" bigint, "p_customer_data" "jsonb", "p_contacts" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_customer_b2c"("p_id" bigint, "p_customer_data" "jsonb", "p_guardians" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_customer_b2c"("p_id" bigint, "p_customer_data" "jsonb", "p_guardians" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_customer_b2c"("p_id" bigint, "p_customer_data" "jsonb", "p_guardians" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_permissions_for_role"("p_role_id" "uuid", "p_permission_keys" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."update_permissions_for_role"("p_role_id" "uuid", "p_permission_keys" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_permissions_for_role"("p_role_id" "uuid", "p_permission_keys" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_product"("p_id" bigint, "p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_inventory_settings" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_product"("p_id" bigint, "p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_inventory_settings" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_product"("p_id" bigint, "p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_inventory_settings" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_product_status"("p_ids" bigint[], "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_product_status"("p_ids" bigint[], "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_product_status"("p_ids" bigint[], "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_self_profile"("p_profile_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_self_profile"("p_profile_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_self_profile"("p_profile_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_shipping_partner"("p_id" bigint, "p_partner_data" "jsonb", "p_rules" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."update_shipping_partner"("p_id" bigint, "p_partner_data" "jsonb", "p_rules" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_shipping_partner"("p_id" bigint, "p_partner_data" "jsonb", "p_rules" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_supplier"("p_id" bigint, "p_name" "text", "p_tax_code" "text", "p_address" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_bank_account" "text", "p_bank_name" "text", "p_bank_holder" "text", "p_payment_term" "text", "p_delivery_method" "text", "p_lead_time" integer, "p_status" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_supplier"("p_id" bigint, "p_name" "text", "p_tax_code" "text", "p_address" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_bank_account" "text", "p_bank_name" "text", "p_bank_holder" "text", "p_payment_term" "text", "p_delivery_method" "text", "p_lead_time" integer, "p_status" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_supplier"("p_id" bigint, "p_name" "text", "p_tax_code" "text", "p_address" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_bank_account" "text", "p_bank_name" "text", "p_bank_holder" "text", "p_payment_term" "text", "p_delivery_method" "text", "p_lead_time" integer, "p_status" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_assignments"("p_user_id" "uuid", "p_assignments" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_assignments"("p_user_id" "uuid", "p_assignments" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_assignments"("p_user_id" "uuid", "p_assignments" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_assignments"("p_user_id" "uuid", "p_assignments" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_assignments"("p_user_id" "uuid", "p_assignments" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_assignments"("p_user_id" "uuid", "p_assignments" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_status"("p_user_id" "uuid", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_status"("p_user_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_status"("p_user_id" "uuid", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."asset_maintenance_history" TO "anon";
GRANT ALL ON TABLE "public"."asset_maintenance_history" TO "authenticated";
GRANT ALL ON TABLE "public"."asset_maintenance_history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."asset_maintenance_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."asset_maintenance_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."asset_maintenance_history_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."asset_maintenance_plans" TO "anon";
GRANT ALL ON TABLE "public"."asset_maintenance_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."asset_maintenance_plans" TO "service_role";



GRANT ALL ON SEQUENCE "public"."asset_maintenance_plans_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."asset_maintenance_plans_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."asset_maintenance_plans_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."asset_types" TO "anon";
GRANT ALL ON TABLE "public"."asset_types" TO "authenticated";
GRANT ALL ON TABLE "public"."asset_types" TO "service_role";



GRANT ALL ON SEQUENCE "public"."asset_types_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."asset_types_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."asset_types_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."assets" TO "anon";
GRANT ALL ON TABLE "public"."assets" TO "authenticated";
GRANT ALL ON TABLE "public"."assets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."assets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."assets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."assets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."banks" TO "anon";
GRANT ALL ON TABLE "public"."banks" TO "authenticated";
GRANT ALL ON TABLE "public"."banks" TO "service_role";



GRANT ALL ON SEQUENCE "public"."banks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."banks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."banks_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."chart_of_accounts" TO "anon";
GRANT ALL ON TABLE "public"."chart_of_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."chart_of_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."customer_b2b_contacts" TO "anon";
GRANT ALL ON TABLE "public"."customer_b2b_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_b2b_contacts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."customer_b2b_contacts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customer_b2b_contacts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customer_b2b_contacts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."customer_guardians" TO "anon";
GRANT ALL ON TABLE "public"."customer_guardians" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_guardians" TO "service_role";



GRANT ALL ON SEQUENCE "public"."customer_guardians_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customer_guardians_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customer_guardians_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."customers_b2b" TO "anon";
GRANT ALL ON TABLE "public"."customers_b2b" TO "authenticated";
GRANT ALL ON TABLE "public"."customers_b2b" TO "service_role";



GRANT ALL ON SEQUENCE "public"."customers_b2b_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customers_b2b_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customers_b2b_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."customers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."document_templates" TO "anon";
GRANT ALL ON TABLE "public"."document_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."document_templates" TO "service_role";



GRANT ALL ON SEQUENCE "public"."document_templates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."document_templates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."document_templates_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."fund_accounts" TO "anon";
GRANT ALL ON TABLE "public"."fund_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."fund_accounts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."fund_accounts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."fund_accounts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."fund_accounts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."permissions" TO "anon";
GRANT ALL ON TABLE "public"."permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."permissions" TO "service_role";



GRANT ALL ON TABLE "public"."product_inventory" TO "anon";
GRANT ALL ON TABLE "public"."product_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."product_inventory" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_inventory_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_inventory_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_inventory_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."shipping_partners" TO "anon";
GRANT ALL ON TABLE "public"."shipping_partners" TO "authenticated";
GRANT ALL ON TABLE "public"."shipping_partners" TO "service_role";



GRANT ALL ON SEQUENCE "public"."shipping_partners_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."shipping_partners_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."shipping_partners_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."shipping_rules" TO "anon";
GRANT ALL ON TABLE "public"."shipping_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."shipping_rules" TO "service_role";



GRANT ALL ON SEQUENCE "public"."shipping_rules_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."shipping_rules_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."shipping_rules_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."suppliers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."suppliers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."suppliers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_categories" TO "anon";
GRANT ALL ON TABLE "public"."transaction_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_categories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."transaction_categories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."transaction_categories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."transaction_categories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."warehouses" TO "anon";
GRANT ALL ON TABLE "public"."warehouses" TO "authenticated";
GRANT ALL ON TABLE "public"."warehouses" TO "service_role";



GRANT ALL ON SEQUENCE "public"."warehouses_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."warehouses_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."warehouses_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Allow authenticated delete on licenses"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using ((bucket_id = 'customer_b2b_licenses'::text));



  create policy "Allow authenticated insert on licenses"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'customer_b2b_licenses'::text));



  create policy "Allow authenticated read on licenses"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'customer_b2b_licenses'::text));



  create policy "Allow authenticated update on licenses"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id = 'customer_b2b_licenses'::text));



  create policy "Allow authenticated updates"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id = 'system_assets'::text));



  create policy "Allow authenticated uploads"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'system_assets'::text));