alter table "public"."products" add column "carton_dimensions" text;

alter table "public"."products" add column "carton_weight" numeric default 0;

alter table "public"."products" add column "packing_spec" text;

alter table "public"."products" add column "purchasing_policy" text default 'ALLOW_LOOSE'::text;

alter table "public"."products" add column "registration_number" text;

alter table "public"."products" add constraint "products_purchasing_policy_check" CHECK ((purchasing_policy = ANY (ARRAY['ALLOW_LOOSE'::text, 'FULL_CARTON_ONLY'::text]))) not valid;

alter table "public"."products" validate constraint "products_purchasing_policy_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.calculate_carton_breakdown(p_product_id bigint, p_required_qty integer)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_items_per_carton INTEGER;
    v_purchasing_policy TEXT;
    v_full_cartons INTEGER;
    v_remainder INTEGER;
    v_final_qty INTEGER;
    v_note TEXT;
BEGIN
    SELECT COALESCE(items_per_carton, 1), COALESCE(purchasing_policy, 'ALLOW_LOOSE')
    INTO v_items_per_carton, v_purchasing_policy
    FROM public.products WHERE id = p_product_id;

    IF NOT FOUND OR v_items_per_carton < 1 THEN v_items_per_carton := 1; END IF;

    v_full_cartons := FLOOR(p_required_qty / v_items_per_carton);
    v_remainder := p_required_qty % v_items_per_carton;

    IF v_purchasing_policy = 'ALLOW_LOOSE' THEN
        v_final_qty := p_required_qty;
        v_note := 'Chấp nhận nhập lẻ.';
    ELSIF v_purchasing_policy = 'FULL_CARTON_ONLY' THEN
        IF v_remainder > 0 THEN
            v_full_cartons := v_full_cartons + 1;
            v_remainder := 0;
            v_final_qty := v_full_cartons * v_items_per_carton;
            v_note := 'Đã làm tròn lên nguyên thùng.';
        ELSE
             v_final_qty := p_required_qty;
             v_note := 'Đã đủ nguyên thùng.';
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'result', jsonb_build_object('full_cartons', v_full_cartons, 'loose_units', v_remainder, 'final_total_qty', v_final_qty),
        'note', v_note
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_product(p_name text DEFAULT NULL::text, p_sku text DEFAULT NULL::text, p_barcode text DEFAULT NULL::text, p_active_ingredient text DEFAULT NULL::text, p_image_url text DEFAULT NULL::text, p_category_name text DEFAULT NULL::text, p_manufacturer_name text DEFAULT NULL::text, p_distributor_id bigint DEFAULT NULL::bigint, p_status text DEFAULT 'active'::text, p_invoice_price numeric DEFAULT 0, p_actual_cost numeric DEFAULT 0, p_wholesale_unit text DEFAULT 'Hộp'::text, p_retail_unit text DEFAULT 'Vỉ'::text, p_conversion_factor integer DEFAULT 1, p_wholesale_margin_value numeric DEFAULT 0, p_wholesale_margin_type text DEFAULT '%'::text, p_retail_margin_value numeric DEFAULT 0, p_retail_margin_type text DEFAULT '%'::text, p_items_per_carton integer DEFAULT 1, p_carton_weight numeric DEFAULT 0, p_carton_dimensions text DEFAULT NULL::text, p_purchasing_policy text DEFAULT 'ALLOW_LOOSE'::text, p_inventory_settings jsonb DEFAULT '{}'::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_product_id BIGINT;
    v_warehouse_key TEXT;
    v_warehouse_id BIGINT;
    v_min_stock INT;
    v_max_stock INT;
BEGIN
    -- Bắt buộc phải có Tên sản phẩm, nếu null thì báo lỗi hoặc đặt tên tạm
    IF p_name IS NULL THEN
        RAISE EXCEPTION 'Tên sản phẩm không được để trống';
    END IF;

    INSERT INTO public.products (
        name, sku, barcode, active_ingredient, image_url,
        category_name, manufacturer_name, distributor_id, status,
        invoice_price, actual_cost, wholesale_unit, retail_unit, conversion_factor,
        wholesale_margin_value, wholesale_margin_type, retail_margin_value, retail_margin_type,
        items_per_carton, carton_weight, carton_dimensions, purchasing_policy
    )
    VALUES (
        p_name, 
        p_sku, 
        p_barcode, 
        p_active_ingredient, 
        p_image_url,
        p_category_name, 
        p_manufacturer_name, 
        p_distributor_id, 
        COALESCE(p_status, 'active'),
        COALESCE(p_invoice_price, 0), 
        COALESCE(p_actual_cost, 0), 
        COALESCE(p_wholesale_unit, 'Hộp'), 
        COALESCE(p_retail_unit, 'Vỉ'), 
        COALESCE(p_conversion_factor, 1),
        COALESCE(p_wholesale_margin_value, 0), 
        COALESCE(p_wholesale_margin_type, '%'), 
        COALESCE(p_retail_margin_value, 0), 
        COALESCE(p_retail_margin_type, '%'),
        COALESCE(p_items_per_carton, 1),
        COALESCE(p_carton_weight, 0), 
        p_carton_dimensions, 
        COALESCE(p_purchasing_policy, 'ALLOW_LOOSE')
    )
    RETURNING id INTO v_product_id;

    -- Xử lý tồn kho (Chỉ chạy nếu json không rỗng)
    IF p_inventory_settings IS NOT NULL AND p_inventory_settings <> '{}'::jsonb THEN
        FOR v_warehouse_key IN SELECT * FROM jsonb_object_keys(p_inventory_settings)
        LOOP
            SELECT id INTO v_warehouse_id FROM public.warehouses WHERE key = v_warehouse_key;
            IF v_warehouse_id IS NOT NULL THEN
                v_min_stock := (p_inventory_settings -> v_warehouse_key ->> 'min')::INT;
                v_max_stock := (p_inventory_settings -> v_warehouse_key ->> 'max')::INT;
                INSERT INTO public.product_inventory (product_id, warehouse_id, stock_quantity, min_stock, max_stock)
                VALUES (v_product_id, v_warehouse_id, 0, v_min_stock, v_max_stock);
            END IF;
        END LOOP;
    END IF;

    RETURN v_product_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_product(p_name text DEFAULT NULL::text, p_sku text DEFAULT NULL::text, p_barcode text DEFAULT NULL::text, p_active_ingredient text DEFAULT NULL::text, p_image_url text DEFAULT NULL::text, p_category_name text DEFAULT NULL::text, p_manufacturer_name text DEFAULT NULL::text, p_distributor_id bigint DEFAULT NULL::bigint, p_status text DEFAULT 'active'::text, p_invoice_price numeric DEFAULT 0, p_actual_cost numeric DEFAULT 0, p_wholesale_unit text DEFAULT 'Hộp'::text, p_retail_unit text DEFAULT 'Vỉ'::text, p_conversion_factor integer DEFAULT 1, p_wholesale_margin_value numeric DEFAULT 0, p_wholesale_margin_type text DEFAULT '%'::text, p_retail_margin_value numeric DEFAULT 0, p_retail_margin_type text DEFAULT '%'::text, p_items_per_carton integer DEFAULT 1, p_carton_weight numeric DEFAULT 0, p_carton_dimensions text DEFAULT NULL::text, p_purchasing_policy text DEFAULT 'ALLOW_LOOSE'::text, p_inventory_settings jsonb DEFAULT '{}'::jsonb, p_description text DEFAULT NULL::text, p_registration_number text DEFAULT NULL::text, p_packing_spec text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_product_id BIGINT;
    v_warehouse_key TEXT;
    v_warehouse_id BIGINT;
    v_min_stock INT;
    v_max_stock INT;
BEGIN
    IF p_name IS NULL THEN RAISE EXCEPTION 'Tên sản phẩm là bắt buộc'; END IF;

    INSERT INTO public.products (
        name, sku, barcode, active_ingredient, image_url,
        category_name, manufacturer_name, distributor_id, status,
        invoice_price, actual_cost, wholesale_unit, retail_unit, conversion_factor,
        wholesale_margin_value, wholesale_margin_type, retail_margin_value, retail_margin_type,
        items_per_carton, carton_weight, carton_dimensions, purchasing_policy,
        -- Map cột mới
        description, registration_number, packing_spec
    )
    VALUES (
        p_name, p_sku, p_barcode, p_active_ingredient, p_image_url,
        p_category_name, p_manufacturer_name, p_distributor_id, COALESCE(p_status, 'active'),
        COALESCE(p_invoice_price, 0), COALESCE(p_actual_cost, 0), 
        COALESCE(p_wholesale_unit, 'Hộp'), COALESCE(p_retail_unit, 'Vỉ'), COALESCE(p_conversion_factor, 1),
        COALESCE(p_wholesale_margin_value, 0), COALESCE(p_wholesale_margin_type, '%'), 
        COALESCE(p_retail_margin_value, 0), COALESCE(p_retail_margin_type, '%'),
        COALESCE(p_items_per_carton, 1), COALESCE(p_carton_weight, 0), 
        p_carton_dimensions, COALESCE(p_purchasing_policy, 'ALLOW_LOOSE'),
        p_description, p_registration_number, p_packing_spec
    )
    RETURNING id INTO v_product_id;

    -- Xử lý tồn kho
    IF p_inventory_settings IS NOT NULL AND p_inventory_settings <> '{}'::jsonb THEN
        FOR v_warehouse_key IN SELECT * FROM jsonb_object_keys(p_inventory_settings)
        LOOP
            SELECT id INTO v_warehouse_id FROM public.warehouses WHERE key = v_warehouse_key;
            IF v_warehouse_id IS NOT NULL THEN
                v_min_stock := (p_inventory_settings -> v_warehouse_key ->> 'min')::INT;
                v_max_stock := (p_inventory_settings -> v_warehouse_key ->> 'max')::INT;
                INSERT INTO public.product_inventory (product_id, warehouse_id, stock_quantity, min_stock, max_stock)
                VALUES (v_product_id, v_warehouse_id, 0, COALESCE(v_min_stock, 0), COALESCE(v_max_stock, 0));
            END IF;
        END LOOP;
    END IF;

    RETURN v_product_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_product(p_id bigint, p_name text DEFAULT NULL::text, p_sku text DEFAULT NULL::text, p_barcode text DEFAULT NULL::text, p_active_ingredient text DEFAULT NULL::text, p_image_url text DEFAULT NULL::text, p_category_name text DEFAULT NULL::text, p_manufacturer_name text DEFAULT NULL::text, p_distributor_id bigint DEFAULT NULL::bigint, p_status text DEFAULT NULL::text, p_invoice_price numeric DEFAULT NULL::numeric, p_actual_cost numeric DEFAULT NULL::numeric, p_wholesale_unit text DEFAULT NULL::text, p_retail_unit text DEFAULT NULL::text, p_conversion_factor integer DEFAULT NULL::integer, p_wholesale_margin_value numeric DEFAULT NULL::numeric, p_wholesale_margin_type text DEFAULT NULL::text, p_retail_margin_value numeric DEFAULT NULL::numeric, p_retail_margin_type text DEFAULT NULL::text, p_items_per_carton integer DEFAULT NULL::integer, p_carton_weight numeric DEFAULT NULL::numeric, p_carton_dimensions text DEFAULT NULL::text, p_purchasing_policy text DEFAULT NULL::text, p_inventory_settings jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_warehouse_key TEXT;
    v_warehouse_id BIGINT;
    v_min_stock INT;
    v_max_stock INT;
BEGIN
    -- Cập nhật bảng Products
    -- Logic: COALESCE(giá_trị_mới, giá_trị_cũ)
    -- Nghĩa là: Nếu Frontend không gửi (null), thì giữ nguyên cái đang có trong DB.
    UPDATE public.products
    SET
        name = COALESCE(p_name, name),
        sku = COALESCE(p_sku, sku),
        barcode = COALESCE(p_barcode, barcode),
        active_ingredient = COALESCE(p_active_ingredient, active_ingredient),
        image_url = COALESCE(p_image_url, image_url),
        category_name = COALESCE(p_category_name, category_name),
        manufacturer_name = COALESCE(p_manufacturer_name, manufacturer_name),
        distributor_id = COALESCE(p_distributor_id, distributor_id),
        status = COALESCE(p_status, status),
        invoice_price = COALESCE(p_invoice_price, invoice_price),
        actual_cost = COALESCE(p_actual_cost, actual_cost),
        wholesale_unit = COALESCE(p_wholesale_unit, wholesale_unit),
        retail_unit = COALESCE(p_retail_unit, retail_unit),
        conversion_factor = COALESCE(p_conversion_factor, conversion_factor),
        wholesale_margin_value = COALESCE(p_wholesale_margin_value, wholesale_margin_value),
        wholesale_margin_type = COALESCE(p_wholesale_margin_type, wholesale_margin_type),
        retail_margin_value = COALESCE(p_retail_margin_value, retail_margin_value),
        retail_margin_type = COALESCE(p_retail_margin_type, retail_margin_type),
        items_per_carton = COALESCE(p_items_per_carton, items_per_carton),
        carton_weight = COALESCE(p_carton_weight, carton_weight),
        carton_dimensions = COALESCE(p_carton_dimensions, carton_dimensions),
        purchasing_policy = COALESCE(p_purchasing_policy, purchasing_policy),
        updated_at = now()
    WHERE id = p_id;

    -- Cập nhật tồn kho Min/Max
    -- Chỉ chạy logic này nếu p_inventory_settings CÓ dữ liệu (không phải mặc định rỗng)
    IF p_inventory_settings IS NOT NULL AND p_inventory_settings <> '{}'::jsonb THEN
        -- Xóa cũ để cập nhật mới cho sạch sẽ
        DELETE FROM public.product_inventory WHERE product_id = p_id;
        
        FOR v_warehouse_key IN SELECT * FROM jsonb_object_keys(p_inventory_settings)
        LOOP
            SELECT id INTO v_warehouse_id FROM public.warehouses WHERE key = v_warehouse_key;
            IF v_warehouse_id IS NOT NULL THEN
                v_min_stock := (p_inventory_settings -> v_warehouse_key ->> 'min')::INT;
                v_max_stock := (p_inventory_settings -> v_warehouse_key ->> 'max')::INT;
                
                INSERT INTO public.product_inventory (product_id, warehouse_id, stock_quantity, min_stock, max_stock)
                VALUES (p_id, v_warehouse_id, 0, v_min_stock, v_max_stock)
                ON CONFLICT (product_id, warehouse_id) 
                DO UPDATE SET min_stock = EXCLUDED.min_stock, max_stock = EXCLUDED.max_stock;
            END IF;
        END LOOP;
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_product(p_id bigint, p_name text DEFAULT NULL::text, p_sku text DEFAULT NULL::text, p_barcode text DEFAULT NULL::text, p_active_ingredient text DEFAULT NULL::text, p_image_url text DEFAULT NULL::text, p_category_name text DEFAULT NULL::text, p_manufacturer_name text DEFAULT NULL::text, p_distributor_id bigint DEFAULT NULL::bigint, p_status text DEFAULT NULL::text, p_invoice_price numeric DEFAULT NULL::numeric, p_actual_cost numeric DEFAULT NULL::numeric, p_wholesale_unit text DEFAULT NULL::text, p_retail_unit text DEFAULT NULL::text, p_conversion_factor integer DEFAULT NULL::integer, p_wholesale_margin_value numeric DEFAULT NULL::numeric, p_wholesale_margin_type text DEFAULT NULL::text, p_retail_margin_value numeric DEFAULT NULL::numeric, p_retail_margin_type text DEFAULT NULL::text, p_items_per_carton integer DEFAULT NULL::integer, p_carton_weight numeric DEFAULT NULL::numeric, p_carton_dimensions text DEFAULT NULL::text, p_purchasing_policy text DEFAULT NULL::text, p_inventory_settings jsonb DEFAULT '{}'::jsonb, p_description text DEFAULT NULL::text, p_registration_number text DEFAULT NULL::text, p_packing_spec text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_warehouse_key TEXT;
    v_warehouse_id BIGINT;
    v_min_stock INT;
    v_max_stock INT;
BEGIN
    UPDATE public.products
    SET
        name = COALESCE(p_name, name),
        sku = COALESCE(p_sku, sku),
        barcode = COALESCE(p_barcode, barcode),
        active_ingredient = COALESCE(p_active_ingredient, active_ingredient),
        image_url = COALESCE(p_image_url, image_url),
        category_name = COALESCE(p_category_name, category_name),
        manufacturer_name = COALESCE(p_manufacturer_name, manufacturer_name),
        distributor_id = COALESCE(p_distributor_id, distributor_id),
        status = COALESCE(p_status, status),
        invoice_price = COALESCE(p_invoice_price, invoice_price),
        actual_cost = COALESCE(p_actual_cost, actual_cost),
        wholesale_unit = COALESCE(p_wholesale_unit, wholesale_unit),
        retail_unit = COALESCE(p_retail_unit, retail_unit),
        conversion_factor = COALESCE(p_conversion_factor, conversion_factor),
        wholesale_margin_value = COALESCE(p_wholesale_margin_value, wholesale_margin_value),
        wholesale_margin_type = COALESCE(p_wholesale_margin_type, wholesale_margin_type),
        retail_margin_value = COALESCE(p_retail_margin_value, retail_margin_value),
        retail_margin_type = COALESCE(p_retail_margin_type, retail_margin_type),
        items_per_carton = COALESCE(p_items_per_carton, items_per_carton),
        carton_weight = COALESCE(p_carton_weight, carton_weight),
        carton_dimensions = COALESCE(p_carton_dimensions, carton_dimensions),
        purchasing_policy = COALESCE(p_purchasing_policy, purchasing_policy),
        -- Cập nhật cột mới
        description = COALESCE(p_description, description),
        registration_number = COALESCE(p_registration_number, registration_number),
        packing_spec = COALESCE(p_packing_spec, packing_spec),
        updated_at = now()
    WHERE id = p_id;

    -- Cập nhật tồn kho (Xóa đi thêm lại)
    IF p_inventory_settings IS NOT NULL AND p_inventory_settings <> '{}'::jsonb THEN
        DELETE FROM public.product_inventory WHERE product_id = p_id;
        
        FOR v_warehouse_key IN SELECT * FROM jsonb_object_keys(p_inventory_settings)
        LOOP
            SELECT id INTO v_warehouse_id FROM public.warehouses WHERE key = v_warehouse_key;
            IF v_warehouse_id IS NOT NULL THEN
                v_min_stock := (p_inventory_settings -> v_warehouse_key ->> 'min')::INT;
                v_max_stock := (p_inventory_settings -> v_warehouse_key ->> 'max')::INT;
                
                INSERT INTO public.product_inventory (product_id, warehouse_id, stock_quantity, min_stock, max_stock)
                VALUES (p_id, v_warehouse_id, 0, COALESCE(v_min_stock,0), COALESCE(v_max_stock,0))
                ON CONFLICT (product_id, warehouse_id) 
                DO UPDATE SET min_stock = EXCLUDED.min_stock, max_stock = EXCLUDED.max_stock;
            END IF;
        END LOOP;
    END IF;
END;
$function$
;


