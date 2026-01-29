


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


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






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


CREATE TYPE "public"."appointment_service_type" AS ENUM (
    'examination',
    'vaccination'
);


ALTER TYPE "public"."appointment_service_type" OWNER TO "postgres";


CREATE TYPE "public"."appointment_status" AS ENUM (
    'pending',
    'confirmed',
    'completed',
    'cancelled',
    'checked_in'
);


ALTER TYPE "public"."appointment_status" OWNER TO "postgres";


CREATE TYPE "public"."asset_status" AS ENUM (
    'active',
    'storage',
    'repair',
    'disposed'
);


ALTER TYPE "public"."asset_status" OWNER TO "postgres";


CREATE TYPE "public"."business_type" AS ENUM (
    'trade',
    'advance',
    'reimbursement',
    'internal',
    'other',
    'opening_balance'
);


ALTER TYPE "public"."business_type" OWNER TO "postgres";


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


CREATE TYPE "public"."gift_type" AS ENUM (
    'artifact',
    'scratch_card',
    'gold',
    'money',
    'other'
);


ALTER TYPE "public"."gift_type" OWNER TO "postgres";


CREATE TYPE "public"."invoice_request_status" AS ENUM (
    'none',
    'pending',
    'exported',
    'issued'
);


ALTER TYPE "public"."invoice_request_status" OWNER TO "postgres";


CREATE TYPE "public"."maintenance_exec_type" AS ENUM (
    'internal',
    'external'
);


ALTER TYPE "public"."maintenance_exec_type" OWNER TO "postgres";


CREATE TYPE "public"."order_status" AS ENUM (
    'DRAFT',
    'QUOTE',
    'QUOTE_EXPIRED',
    'CONFIRMED',
    'PACKED',
    'SHIPPING',
    'DELIVERED',
    'CANCELLED'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."queue_priority" AS ENUM (
    'normal',
    'high'
);


ALTER TYPE "public"."queue_priority" OWNER TO "postgres";


CREATE TYPE "public"."queue_status" AS ENUM (
    'waiting',
    'examining',
    'completed',
    'skipped'
);


ALTER TYPE "public"."queue_status" OWNER TO "postgres";


CREATE TYPE "public"."service_package_type" AS ENUM (
    'service',
    'bundle'
);


ALTER TYPE "public"."service_package_type" OWNER TO "postgres";


CREATE TYPE "public"."shipping_partner_type" AS ENUM (
    'app',
    'coach',
    'internal'
);


ALTER TYPE "public"."shipping_partner_type" OWNER TO "postgres";


CREATE TYPE "public"."stock_management_type" AS ENUM (
    'lot_date',
    'lot_only',
    'serial',
    'simple'
);


ALTER TYPE "public"."stock_management_type" OWNER TO "postgres";


CREATE TYPE "public"."supplier_program_type" AS ENUM (
    'contract',
    'promotion'
);


ALTER TYPE "public"."supplier_program_type" OWNER TO "postgres";


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


CREATE TYPE "public"."transaction_flow" AS ENUM (
    'in',
    'out'
);


ALTER TYPE "public"."transaction_flow" OWNER TO "postgres";


CREATE TYPE "public"."transaction_status" AS ENUM (
    'pending',
    'confirmed',
    'cancelled',
    'completed',
    'approved'
);


ALTER TYPE "public"."transaction_status" OWNER TO "postgres";


CREATE TYPE "public"."transaction_type" AS ENUM (
    'thu',
    'chi'
);


ALTER TYPE "public"."transaction_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."allocate_inbound_costs"("p_receipt_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_shipping_fee NUMERIC;
        v_other_fee NUMERIC;
        v_total_fee NUMERIC;
        v_total_value NUMERIC;
        v_total_quantity NUMERIC;
        v_allocation_method TEXT;
        v_item RECORD;
        v_ratio NUMERIC;
        v_allocated_amt NUMERIC;
        v_final_cost NUMERIC;
    BEGIN
        -- 1. Lấy thông tin Phí từ Header
        SELECT COALESCE(shipping_fee, 0), COALESCE(other_fee, 0)
        INTO v_shipping_fee, v_other_fee
        FROM public.inventory_receipts
        WHERE id = p_receipt_id;

        v_total_fee := v_shipping_fee + v_other_fee;

        -- Nếu không có phí thì reset về 0 và thoát
        IF v_total_fee = 0 THEN
            UPDATE public.inventory_receipt_items
            SET allocated_cost = 0, final_unit_cost = unit_price
            WHERE receipt_id = p_receipt_id;
            
            RETURN jsonb_build_object('success', true, 'message', 'Không có chi phí phụ để phân bổ.');
        END IF;

        -- 2. Tính Tổng Giá Trị và Tổng Số Lượng của phiếu
        SELECT 
            SUM(quantity * unit_price), 
            SUM(quantity)
        INTO v_total_value, v_total_quantity
        FROM public.inventory_receipt_items
        WHERE receipt_id = p_receipt_id;

        -- 3. Quyết định phương pháp phân bổ
        IF v_total_value > 0 THEN
            v_allocation_method := 'VALUE'; -- Chia theo giá trị (Mặc định)
        ELSE
            v_allocation_method := 'QUANTITY'; -- Fallback: Chia theo số lượng (nếu toàn hàng tặng)
        END IF;

        -- 4. Thực hiện phân bổ từng dòng
        FOR v_item IN SELECT id, quantity, unit_price FROM public.inventory_receipt_items WHERE receipt_id = p_receipt_id
        LOOP
            IF v_allocation_method = 'VALUE' THEN
                -- Tỷ lệ = (Giá trị dòng / Tổng giá trị phiếu)
                v_ratio := (v_item.quantity * v_item.unit_price) / v_total_value;
            ELSE
                -- Tỷ lệ = (Số lượng dòng / Tổng số lượng phiếu)
                v_ratio := v_item.quantity / v_total_quantity;
            END IF;

            -- Tính tiền phí cho cả dòng -> Chia lại cho số lượng để ra đơn giá phí
            v_allocated_amt := (v_total_fee * v_ratio) / v_item.quantity;
            
            -- Giá vốn cuối = Giá nhập + Giá phí phân bổ
            v_final_cost := v_item.unit_price + v_allocated_amt;

            -- Update
            UPDATE public.inventory_receipt_items
            SET allocated_cost = v_allocated_amt,
                final_unit_cost = v_final_cost
            WHERE id = v_item.id;
        END LOOP;

        RETURN jsonb_build_object(
            'success', true, 
            'method', v_allocation_method,
            'total_fee_allocated', v_total_fee,
            'message', 'Đã phân bổ chi phí thành công theo phương pháp: ' || v_allocation_method
        );
    END;
    $$;


ALTER FUNCTION "public"."allocate_inbound_costs"("p_receipt_id" bigint) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."auto_allocate_payment_to_orders"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_remaining_amount NUMERIC;
    v_order RECORD;
    v_pay_amount NUMERIC;
    v_partner_id BIGINT;
    v_ref_order_code TEXT; 
BEGIN
    -- Điều kiện chạy: Phiếu Thu (IN) + Trạng thái Completed/Confirmed
    -- [CORE NOTE]: Bắt cả trường hợp Insert (Tạo mới đã hoàn tất ngay) hoặc Update (Duyệt sau)
    IF NEW.flow = 'in' 
       AND NEW.status IN ('completed', 'confirmed') 
       AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('completed', 'confirmed')) 
    THEN
        v_remaining_amount := NEW.amount;
        
        -- =================================================================
        -- ƯU TIÊN 1: TRẢ CHO ĐÚNG ĐƠN HÀNG ĐƯỢC CHỈ ĐỊNH (Explicit Allocation)
        -- =================================================================
        -- Điều kiện: ref_type = 'order' và ref_id chứa Mã đơn hàng (VD: SO-12345)
        IF NEW.ref_type = 'order' AND NEW.ref_id IS NOT NULL THEN
            v_ref_order_code := NEW.ref_id;
            
            -- Tìm đơn hàng khớp Mã (Code) và chưa thanh toán xong
            FOR v_order IN 
                SELECT id, final_amount, paid_amount 
                FROM public.orders 
                WHERE code = v_ref_order_code 
                  AND payment_status != 'paid'
                  AND status != 'CANCELLED'
            LOOP
                -- Tính số tiền trả cho đơn này
                v_pay_amount := LEAST(v_remaining_amount, v_order.final_amount - COALESCE(v_order.paid_amount, 0));
                
                IF v_pay_amount > 0 THEN
                    -- Update trạng thái đơn hàng
                    UPDATE public.orders 
                    SET paid_amount = COALESCE(paid_amount, 0) + v_pay_amount,
                        payment_status = CASE 
                            WHEN (COALESCE(paid_amount, 0) + v_pay_amount) >= (final_amount - 100) THEN 'paid' 
                            ELSE 'partial' 
                        END,
                        updated_at = NOW()
                    WHERE id = v_order.id;
                    
                    -- Trừ đi số tiền đã dùng
                    v_remaining_amount := v_remaining_amount - v_pay_amount;
                END IF;
            END LOOP;
        END IF;

        -- =================================================================
        -- ƯU TIÊN 2: NẾU CÒN TIỀN DƯ, TRẢ CHO NỢ CŨ (FIFO Allocation)
        -- =================================================================
        -- Chỉ áp dụng nếu có định danh Khách hàng (partner_type/partner_id hợp lệ)
        IF v_remaining_amount > 0 AND NEW.partner_type IN ('customer', 'customer_b2b') THEN
            
            BEGIN
                v_partner_id := NEW.partner_id::BIGINT;
            EXCEPTION WHEN OTHERS THEN
                RETURN NEW; -- Bỏ qua nếu ID khách hàng không phải số hợp lệ
            END;

            FOR v_order IN 
                SELECT id, final_amount, paid_amount 
                FROM public.orders 
                WHERE 
                    (
                        (NEW.partner_type = 'customer' AND customer_b2c_id = v_partner_id) OR
                        (NEW.partner_type = 'customer_b2b' AND customer_id = v_partner_id)
                    )
                    AND payment_status != 'paid'
                    AND status != 'CANCELLED'
                    -- [CORE NOTE]: Tránh trả lại đơn vừa trả ở trên (nếu Priority 1 đã xử lý nhưng chưa hết tiền)
                    AND (v_ref_order_code IS NULL OR code != v_ref_order_code)
                ORDER BY created_at ASC -- Cũ nhất trước
            LOOP
                IF v_remaining_amount <= 0 THEN EXIT; END IF;
                
                v_pay_amount := LEAST(v_remaining_amount, v_order.final_amount - COALESCE(v_order.paid_amount, 0));
                
                IF v_pay_amount > 0 THEN
                    UPDATE public.orders 
                    SET paid_amount = COALESCE(paid_amount, 0) + v_pay_amount,
                        payment_status = CASE 
                            WHEN (COALESCE(paid_amount, 0) + v_pay_amount) >= (final_amount - 100) THEN 'paid' 
                            ELSE 'partial' 
                        END,
                        updated_at = NOW()
                    WHERE id = v_order.id;

                    v_remaining_amount := v_remaining_amount - v_pay_amount;
                END IF;
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_allocate_payment_to_orders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_create_purchase_orders_min_max"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_b2b_warehouse_id BIGINT;
    v_po_count INTEGER := 0;
    v_new_po_id BIGINT;
    v_supplier_id BIGINT;
    v_supplier_record RECORD;
BEGIN
    -- 1. Tìm ID kho B2B
    SELECT id INTO v_b2b_warehouse_id FROM public.warehouses WHERE key = 'b2b';
    IF v_b2b_warehouse_id IS NULL THEN 
        SELECT id INTO v_b2b_warehouse_id FROM public.warehouses ORDER BY id ASC LIMIT 1;
    END IF;

    IF v_b2b_warehouse_id IS NULL THEN 
        RAISE EXCEPTION 'Hệ thống chưa có kho hàng nào.'; 
    END IF;

    -- 2. TÍNH TOÁN NHU CẦU
    CREATE TEMP TABLE temp_products_to_buy AS
    SELECT 
        p.id as product_id,
        p.distributor_id as supplier_id,
        p.wholesale_unit as unit_name,
        COALESCE(u.conversion_rate, 1) as conversion_factor,
        
        -- [FIX GIÁ] Nếu chưa có giá vốn (null hoặc 0), mặc định là 0 để không lỗi phép tính
        (COALESCE(p.actual_cost, 0) * COALESCE(u.conversion_rate, 1)) as unit_price,
        
        CEIL(
            (inv.max_stock - inv.stock_quantity)::NUMERIC / COALESCE(NULLIF(u.conversion_rate, 0), 1)
        )::INTEGER as quantity_needed

    FROM public.product_inventory inv
    JOIN public.products p ON inv.product_id = p.id
    LEFT JOIN public.product_units u ON u.product_id = p.id AND u.unit_name = p.wholesale_unit

    WHERE inv.warehouse_id = v_b2b_warehouse_id
      AND inv.stock_quantity < inv.min_stock
      AND p.status = 'active'
      AND p.distributor_id IS NOT NULL
      AND (inv.max_stock - inv.stock_quantity) > 0
      
      -- [ĐÃ GỠ BỎ ĐIỀU KIỆN p.actual_cost > 0] -> Cho phép sản phẩm giá 0 vẫn được tạo PO
      
      -- Chặn trùng đơn (Vẫn giữ để tránh spam đơn)
      AND NOT EXISTS (
          SELECT 1 
          FROM public.purchase_order_items poi
          JOIN public.purchase_orders po ON poi.po_id = po.id
          WHERE poi.product_id = p.id
            AND po.delivery_status IN ('draft', 'pending', 'ordered', 'shipping', 'partially_delivered')
      );

    -- 3. LOOP TẠO PO
    FOR v_supplier_record IN SELECT DISTINCT supplier_id FROM temp_products_to_buy
    LOOP
        v_supplier_id := v_supplier_record.supplier_id;

        -- Tạo Header PO (Status = draft)
        INSERT INTO public.purchase_orders (
            code, supplier_id, delivery_status, payment_status, note, created_at, updated_at
        ) VALUES (
            'PO-AUTO-' || to_char(now(), 'YYMMDD') || '-' || v_supplier_id || '-' || floor(random()*1000)::text,
            v_supplier_id, 
            'draft', 
            'unpaid',
            'Đơn dự trù tự động (Min/Max)', 
            now(), now()
        ) RETURNING id INTO v_new_po_id;

        -- Tạo Items
        INSERT INTO public.purchase_order_items (
            po_id, product_id, quantity_ordered, unit_price, unit, conversion_factor, base_quantity
        )
        SELECT 
            v_new_po_id, product_id, quantity_needed, unit_price, unit_name, conversion_factor,
            (quantity_needed * conversion_factor)
        FROM temp_products_to_buy
        WHERE supplier_id = v_supplier_id;

        -- Update Tổng tiền
        UPDATE public.purchase_orders
        SET total_amount = (SELECT COALESCE(SUM(quantity_ordered * unit_price), 0) FROM public.purchase_order_items WHERE po_id = v_new_po_id),
            final_amount = (SELECT COALESCE(SUM(quantity_ordered * unit_price), 0) FROM public.purchase_order_items WHERE po_id = v_new_po_id)
        WHERE id = v_new_po_id;

        v_po_count := v_po_count + 1;
    END LOOP;

    DROP TABLE temp_products_to_buy;
    RETURN v_po_count;
END;
$$;


ALTER FUNCTION "public"."auto_create_purchase_orders_min_max"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_update_product_barcodes"("p_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    item jsonb;
    v_product_id BIGINT;
    v_base_barcode TEXT;
    v_wholesale_barcode TEXT;
    
    v_wholesale_unit_name TEXT;
    v_retail_unit_name TEXT;
    v_has_base BOOLEAN;
    v_has_wholesale BOOLEAN;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(p_data)
    LOOP
        v_product_id := (item->>'product_id')::BIGINT;
        
        -- Check xem user có gửi dữ liệu lên không (để tránh ghi đè nhầm nếu chỉ muốn sửa 1 trong 2)
        v_has_base := (item ? 'base_barcode');
        v_has_wholesale := (item ? 'wholesale_barcode');

        -- Chuẩn hóa: Trim space, rỗng -> NULL
        v_base_barcode := NULLIF(TRIM(item->>'base_barcode'), '');
        v_wholesale_barcode := NULLIF(TRIM(item->>'wholesale_barcode'), '');

        -- 1. Lấy tên đơn vị được cấu hình làm chuẩn
        SELECT wholesale_unit, retail_unit 
        INTO v_wholesale_unit_name, v_retail_unit_name
        FROM public.products WHERE id = v_product_id;

        -- =================================================================
        -- NHÁNH 1: XỬ LÝ MÃ LẺ (BASE / RETAIL) - CẬP NHẬT 2 NƠI
        -- =================================================================
        IF v_has_base THEN
            -- Vị trí 1: Cột barcode trong bảng PRODUCTS (Master Key dùng để search nhanh)
            UPDATE public.products 
            SET barcode = v_base_barcode, 
                updated_at = NOW() 
            WHERE id = v_product_id;
            
            -- Vị trí 2: Cột barcode trong bảng PRODUCT_UNITS (Unit Lẻ & Base)
            -- Logic: Update dòng có tên trùng với Retail Unit HOẶC dòng là Base Unit
            UPDATE public.product_units 
            SET barcode = v_base_barcode, 
                updated_at = NOW()
            WHERE product_id = v_product_id 
              AND (
                  unit_name = v_retail_unit_name  -- Trùng tên đơn vị lẻ (VD: Vỉ)
                  OR is_base = true               -- Hoặc là đơn vị cơ sở (VD: Viên)
                  OR unit_type = 'retail'         -- Hoặc được đánh dấu là retail
              );
        END IF;

        -- =================================================================
        -- NHÁNH 2: XỬ LÝ MÃ BUÔN (WHOLESALE) - CẬP NHẬT 1 NƠI
        -- =================================================================
        IF v_has_wholesale THEN
            -- Vị trí 3: Cột barcode trong bảng PRODUCT_UNITS (Unit Buôn)
            UPDATE public.product_units 
            SET barcode = v_wholesale_barcode, 
                updated_at = NOW()
            WHERE product_id = v_product_id 
              AND (
                  unit_name = v_wholesale_unit_name -- Trùng tên đơn vị buôn (VD: Hộp)
                  OR unit_type = 'wholesale'        -- Hoặc được đánh dấu là wholesale
              );
        END IF;

    END LOOP;

    RETURN jsonb_build_object('success', true, 'count', jsonb_array_length(p_data));
END;
$$;


ALTER FUNCTION "public"."bulk_update_product_barcodes"("p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_update_product_prices"("p_data" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    item jsonb;
    v_product_id BIGINT;
    
    -- Biến lưu giá trị CŨ
    v_old_cost NUMERIC;
    v_old_retail_margin_val NUMERIC;
    v_old_retail_margin_type TEXT;
    v_old_wholesale_margin_val NUMERIC;
    v_old_wholesale_margin_type TEXT;
    v_wholesale_unit_name TEXT;
    v_retail_unit_name TEXT;

    -- Biến lưu giá trị MỚI
    v_final_cost NUMERIC;
    v_input_retail_price NUMERIC;
    v_input_wholesale_price NUMERIC;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(p_data)
    LOOP
        v_product_id := (item->>'product_id')::BIGINT;

        -- 1. Lấy dữ liệu CŨ từ Database
        SELECT 
            actual_cost, 
            retail_margin_value, retail_margin_type,
            wholesale_margin_value, wholesale_margin_type,
            wholesale_unit, retail_unit
        INTO 
            v_old_cost, 
            v_old_retail_margin_val, v_old_retail_margin_type,
            v_old_wholesale_margin_val, v_old_wholesale_margin_type,
            v_wholesale_unit_name, v_retail_unit_name
        FROM public.products 
        WHERE id = v_product_id;

        -- 2. TÍNH TOÁN (Merge Input)
        v_final_cost := COALESCE((item->>'actual_cost')::NUMERIC, v_old_cost, 0);
        
        -- 3. CẬP NHẬT BẢNG PRODUCTS (Lưu Cost & Margin)
        UPDATE public.products 
        SET 
            actual_cost = v_final_cost,
            
            retail_margin_value = COALESCE((item->>'retail_margin')::NUMERIC, v_old_retail_margin_val, 0),
            retail_margin_type = COALESCE(item->>'retail_margin_type', v_old_retail_margin_type, 'amount'),
            
            wholesale_margin_value = COALESCE((item->>'wholesale_margin')::NUMERIC, v_old_wholesale_margin_val, 0),
            wholesale_margin_type = COALESCE(item->>'wholesale_margin_type', v_old_wholesale_margin_type, 'amount'),
            
            updated_at = NOW()
        WHERE id = v_product_id;

        -- 4. ĐỒNG BỘ GIÁ VỐN CHO TẤT CẢ ĐƠN VỊ (product_units)
        UPDATE public.product_units
        SET price_cost = v_final_cost * conversion_rate,
            updated_at = NOW()
        WHERE product_id = v_product_id;

        -- 5. XỬ LÝ GIÁ BÁN LẺ (Retail Price)
        v_input_retail_price := (item->>'retail_price')::NUMERIC;
        
        IF v_input_retail_price IS NOT NULL THEN
            -- Update đơn vị Lẻ chính
            UPDATE public.product_units
            SET price_sell = v_input_retail_price,
                price = v_input_retail_price, -- [CORE FIX V23]: Đồng bộ cột Legacy
                updated_at = NOW()
            WHERE product_id = v_product_id 
              AND (
                  unit_type = 'retail' 
                  OR (unit_name = v_retail_unit_name AND v_retail_unit_name IS NOT NULL)
                  OR is_base = true -- Fallback
              );
              
            -- [Smart Sync] Đồng bộ các đơn vị phụ khác (trừ Buôn)
            UPDATE public.product_units
            SET price_sell = v_input_retail_price * conversion_rate,
                price = v_input_retail_price * conversion_rate, -- [CORE FIX]
                updated_at = NOW()
            WHERE product_id = v_product_id 
              AND unit_type <> 'wholesale'
              AND (v_wholesale_unit_name IS NULL OR unit_name <> v_wholesale_unit_name)
              AND price_sell = 0; -- Chỉ auto-fill cái chưa có giá
        END IF;

        -- 6. XỬ LÝ GIÁ BÁN BUÔN (Wholesale Price) - [LOGIC SENKO + CORE FIX]
        v_input_wholesale_price := (item->>'wholesale_price')::NUMERIC;

        IF v_input_wholesale_price IS NOT NULL AND v_input_wholesale_price > 0 THEN
            UPDATE public.product_units
            SET price_sell = v_input_wholesale_price,
                price = v_input_wholesale_price, -- [CORE FIX]: Đồng bộ cột Legacy
                updated_at = NOW()
            WHERE product_id = v_product_id 
              AND (
                  -- Ưu tiên 1: Cờ chuẩn
                  unit_type = 'wholesale' 
                  -- Ưu tiên 2: Trùng tên với cấu hình sản phẩm
                  OR (unit_name = v_wholesale_unit_name AND v_wholesale_unit_name IS NOT NULL) 
                  -- Ưu tiên 3 (Logic Senko): Quy cách lớn nhất (Thùng/Hộp to nhất)
                  OR (conversion_rate = (SELECT MAX(conversion_rate) FROM public.product_units WHERE product_id = v_product_id)) 
              );
        END IF;

    END LOOP;
END;
$$;


ALTER FUNCTION "public"."bulk_update_product_prices"("p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_update_product_strategy"("p_product_ids" bigint[], "p_strategy_type" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.products 
    SET stock_management_type = p_strategy_type::public.stock_management_type, 
        updated_at = now()
    WHERE id = ANY(p_product_ids);
END;
$$;


ALTER FUNCTION "public"."bulk_update_product_strategy"("p_product_ids" bigint[], "p_strategy_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_update_product_units_for_quick_unit_page"("p_data" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    item JSONB;
    v_product_id BIGINT;
    v_base_unit TEXT;
    v_retail_unit TEXT;
    v_retail_rate INT;
    v_wholesale_unit TEXT;
    v_wholesale_rate INT;
    v_cost NUMERIC;
BEGIN
    FOR item IN SELECT value FROM jsonb_array_elements(p_data) AS t(value)
    LOOP
        -- 1. Tìm Product ID
        v_product_id := (item->>'product_id')::BIGINT;
        IF v_product_id IS NULL THEN
            SELECT id INTO v_product_id FROM public.products 
            WHERE sku = (item->>'sku') AND status = 'active' LIMIT 1;
        END IF;

        IF v_product_id IS NOT NULL THEN
            -- Lấy dữ liệu
            v_base_unit := COALESCE(NULLIF(TRIM(item->>'base_unit'), ''), 'Viên');
            v_retail_unit := NULLIF(TRIM(item->>'retail_unit'), '');
            v_retail_rate := COALESCE((item->>'retail_rate')::INT, 1);
            v_wholesale_unit := NULLIF(TRIM(item->>'wholesale_unit'), '');
            v_wholesale_rate := COALESCE((item->>'wholesale_rate')::INT, 1);
            
            SELECT actual_cost INTO v_cost FROM public.products WHERE id = v_product_id;

            -- 2. XÓA SẠCH LÀM LẠI
            DELETE FROM public.product_units WHERE product_id = v_product_id;

            -- A. TẠO UNIT BASE
            INSERT INTO public.product_units (
                product_id, unit_name, conversion_rate, is_base, is_direct_sale, price_cost, unit_type
            ) VALUES (
                v_product_id, v_base_unit, 1, true, true, v_cost, 'base'
            );

            -- B. TẠO UNIT RETAIL (Chấp nhận trùng tên Base)
            IF v_retail_unit IS NOT NULL AND v_retail_unit <> '' THEN
                INSERT INTO public.product_units (
                    product_id, unit_name, conversion_rate, is_base, is_direct_sale, price_cost, unit_type
                ) VALUES (
                    v_product_id, v_retail_unit, v_retail_rate, false, true, v_cost * v_retail_rate, 'retail'
                );
            END IF;

            -- C. TẠO UNIT WHOLESALE (Chấp nhận Rate = 1)
            -- [FIX V6]: Đã bỏ điều kiện (AND v_wholesale_rate > 1)
            IF v_wholesale_unit IS NOT NULL AND v_wholesale_unit <> '' THEN
                INSERT INTO public.product_units (
                    product_id, unit_name, conversion_rate, is_base, is_direct_sale, price_cost, unit_type
                ) VALUES (
                    v_product_id, v_wholesale_unit, v_wholesale_rate, false, true, v_cost * v_wholesale_rate, 'wholesale'
                );
            END IF;

            -- 3. CẬP NHẬT BẢNG PRODUCTS (Hiển thị)
            UPDATE public.products
            SET 
                retail_unit = COALESCE(v_retail_unit, v_base_unit),
                wholesale_unit = v_wholesale_unit,
                -- Conversion factor lấy cái lớn nhất để hiển thị
                conversion_factor = GREATEST(v_wholesale_rate, v_retail_rate),
                updated_at = NOW()
            WHERE id = v_product_id;
        END IF;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."bulk_update_product_units_for_quick_unit_page"("p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_upsert_customers_b2b"("p_customers_array" "jsonb"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        customer_data JSONB;
        v_customer_code_from_excel TEXT;
        v_final_customer_code TEXT;
        v_customer_b2b_id BIGINT;
        v_sales_staff_id UUID;
        v_initial_debt NUMERIC;
        v_success_count INT := 0;
        v_debt_order_id UUID;
        v_paid_amount NUMERIC;
    BEGIN
        FOREACH customer_data IN ARRAY p_customers_array
        LOOP
            -- A. TÌM NHÂN VIÊN SALE
            v_sales_staff_id := NULL;
            IF customer_data->>'sales_staff_email' IS NOT NULL AND customer_data->>'sales_staff_email' <> '' THEN
                SELECT id INTO v_sales_staff_id FROM public.users WHERE email = TRIM(customer_data->>'sales_staff_email') LIMIT 1;
            END IF;

            -- B. XỬ LÝ MÃ KHÁCH HÀNG
            v_customer_code_from_excel := customer_data->>'customer_code';
            SELECT COALESCE(NULLIF(TRIM(v_customer_code_from_excel), ''), 'B2B-' || (nextval(pg_get_serial_sequence('public.customers_b2b', 'id')) + 10000)) 
            INTO v_final_customer_code;

            -- C. UPSERT KHÁCH HÀNG (FULL UPDATE)
            INSERT INTO public.customers_b2b (
                customer_code, name, tax_code, debt_limit, payment_term, 
                sales_staff_id, status, phone, email, vat_address, shipping_address,
                bank_name, bank_account_name, bank_account_number, loyalty_points
            ) VALUES (
                v_final_customer_code,
                customer_data->>'name',
                customer_data->>'tax_code',
                COALESCE((customer_data->>'debt_limit')::NUMERIC, 0),
                COALESCE((customer_data->>'payment_term')::INT, 0),
                v_sales_staff_id,
                'active',
                customer_data->>'phone',
                customer_data->>'email',
                customer_data->>'address', 
                customer_data->>'address',
                customer_data->>'bank_name',
                customer_data->>'bank_account_name',
                customer_data->>'bank_account_number',
                0 
            )
            ON CONFLICT (customer_code) 
            DO UPDATE SET
                -- [CORE FIX] Update đầy đủ các trường
                name = EXCLUDED.name,
                phone = EXCLUDED.phone,
                email = EXCLUDED.email,
                tax_code = EXCLUDED.tax_code,
                debt_limit = EXCLUDED.debt_limit,      -- [Update Hạn mức]
                payment_term = EXCLUDED.payment_term,  -- [Update Kỳ hạn]
                vat_address = EXCLUDED.vat_address,
                shipping_address = EXCLUDED.shipping_address,
                sales_staff_id = COALESCE(EXCLUDED.sales_staff_id, customers_b2b.sales_staff_id), -- Chỉ update nếu có dữ liệu mới
                updated_at = now()
            RETURNING id INTO v_customer_b2b_id;

            -- D. XỬ LÝ LIÊN HỆ
            IF customer_data->>'contact_person_name' IS NOT NULL THEN
                INSERT INTO public.customer_b2b_contacts (
                    customer_b2b_id, name, phone, position, is_primary
                ) VALUES (
                    v_customer_b2b_id,
                    customer_data->>'contact_person_name',
                    COALESCE(customer_data->>'contact_person_phone', customer_data->>'phone'),
                    'Liên hệ chính', true
                )
                ON CONFLICT (customer_b2b_id, phone) DO UPDATE SET name = EXCLUDED.name, is_primary = true;
            END IF;

            -- E. XỬ LÝ NỢ ĐẦU KỲ (LOGIC THÔNG MINH)
            v_initial_debt := COALESCE((customer_data->>'initial_debt')::NUMERIC, 0);
            
            IF v_initial_debt > 0 THEN
                -- Kiểm tra xem đã có đơn nợ đầu kỳ chưa
                SELECT id, paid_amount INTO v_debt_order_id, v_paid_amount
                FROM public.orders 
                WHERE code = 'DEBT-INIT-' || v_final_customer_code;

                IF v_debt_order_id IS NULL THEN
                    -- CHƯA CÓ -> TẠO MỚI
                    INSERT INTO public.orders (
                        code, customer_id, customer_b2c_id, order_type, status, payment_status, 
                        total_amount, final_amount, paid_amount, discount_amount, shipping_fee, 
                        payment_method, remittance_status, created_at, updated_at, note
                    ) VALUES (
                        'DEBT-INIT-' || v_final_customer_code,
                        v_customer_b2b_id, NULL, 'B2B', 'COMPLETED', 'unpaid',
                        v_initial_debt, v_initial_debt, 0, 0, 0,
                        'debt', 'deposited', NOW(), NOW(), 'Nợ tồn đọng đầu kỳ (Import Excel)'
                    );
                ELSE
                    -- ĐÃ CÓ -> CHECK XEM SỬA ĐƯỢC KHÔNG
                    IF v_paid_amount = 0 THEN
                        -- Chưa trả đồng nào -> Cho phép Update lại số tiền nợ
                        UPDATE public.orders
                        SET total_amount = v_initial_debt,
                            final_amount = v_initial_debt,
                            updated_at = NOW()
                        WHERE id = v_debt_order_id;
                    END IF;
                    -- Nếu v_paid_amount > 0 -> Đã phát sinh thanh toán -> Không sửa nữa để bảo toàn lịch sử.
                END IF;
            END IF;

            v_success_count := v_success_count + 1;
        END LOOP;

        RETURN jsonb_build_object('success', true, 'count', v_success_count);
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
    v_customer_id BIGINT;
    v_initial_debt NUMERIC;
    v_debt_order_id UUID;
    v_paid_amount NUMERIC;
BEGIN
    FOREACH customer_data IN ARRAY p_customers_array
    LOOP
        v_type := customer_data->>'type';
        v_customer_code_from_excel := customer_data->>'customer_code';

        -- 1. Tạo/Lấy Mã KH
        SELECT COALESCE(NULLIF(TRIM(v_customer_code_from_excel), ''), 'KH-' || (nextval(pg_get_serial_sequence('public.customers', 'id')) + 10000)) 
        INTO v_final_customer_code;

        -- 2. UPSERT Khách hàng (FULL UPDATE)
        IF v_type = 'CaNhan' THEN
            INSERT INTO public.customers (
                customer_code, name, type, phone, loyalty_points, status,
                email, address, dob, gender
            ) VALUES (
                v_final_customer_code, customer_data->>'name', 'CaNhan', customer_data->>'phone',
                (customer_data->>'loyalty_points')::INT, 'active',
                customer_data->>'email', customer_data->>'address',
                (customer_data->>'dob')::DATE, (customer_data->>'gender')::public.customer_gender
            )
            ON CONFLICT (customer_code) DO UPDATE SET 
                name = EXCLUDED.name, phone = EXCLUDED.phone, 
                address = EXCLUDED.address, email = EXCLUDED.email, -- [CORE FIX] Update thêm
                updated_at = now()
            RETURNING id INTO v_customer_id;

        ELSIF v_type = 'ToChuc' THEN
            INSERT INTO public.customers (
                customer_code, name, type, phone, tax_code, 
                contact_person_name, contact_person_phone, loyalty_points, status
            ) VALUES (
                v_final_customer_code, customer_data->>'name', 'ToChuc', customer_data->>'phone',
                customer_data->>'tax_code', customer_data->>'contact_person_name', 
                customer_data->>'contact_person_phone', (customer_data->>'loyalty_points')::INT, 'active'
            )
            ON CONFLICT (customer_code) DO UPDATE SET 
                name = EXCLUDED.name, phone = EXCLUDED.phone, tax_code = EXCLUDED.tax_code,
                contact_person_name = EXCLUDED.contact_person_name, -- [CORE FIX] Update thêm
                updated_at = now()
            RETURNING id INTO v_customer_id;
        END IF;

        -- 3. XỬ LÝ NỢ ĐẦU KỲ (LOGIC THÔNG MINH)
        v_initial_debt := COALESCE((customer_data->>'initial_debt')::NUMERIC, 0);
        
        IF v_initial_debt > 0 THEN
            SELECT id, paid_amount INTO v_debt_order_id, v_paid_amount
            FROM public.orders 
            WHERE code = 'DEBT-INIT-' || v_final_customer_code;

            IF v_debt_order_id IS NULL THEN
                -- CHƯA CÓ -> TẠO MỚI
                INSERT INTO public.orders (
                    code, customer_b2c_id, creator_id, status, total_amount, final_amount, 
                    paid_amount, payment_status, note, order_type
                ) VALUES (
                    'DEBT-INIT-' || v_final_customer_code, v_customer_id, auth.uid(), 'COMPLETED', 
                    v_initial_debt, v_initial_debt, 0, 'unpaid', 
                    'Nợ tồn đọng đầu kỳ (Import Excel)', 'opening_debt'
                );
            ELSE
                -- ĐÃ CÓ -> CHECK VÀ SỬA
                IF v_paid_amount = 0 THEN
                    UPDATE public.orders
                    SET total_amount = v_initial_debt,
                        final_amount = v_initial_debt,
                        updated_at = NOW()
                    WHERE id = v_debt_order_id;
                END IF;
            END IF;
        END IF;

    END LOOP;
END;
$$;


ALTER FUNCTION "public"."bulk_upsert_customers_b2c"("p_customers_array" "jsonb"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_upsert_products"("p_products_array" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    product_data JSONB;
    v_product_id BIGINT;
    v_warehouse_id BIGINT;
    v_branch_key TEXT;
    v_inventory_settings JSONB;
    
    -- Biến xử lý đơn vị
    v_retail_unit TEXT;
    v_wholesale_unit TEXT;
    v_conversion_factor INT;
    v_actual_cost NUMERIC;
BEGIN
    -- Loop qua từng sản phẩm trong mảng JSON từ Excel
    FOR product_data IN SELECT value FROM jsonb_array_elements(p_products_array) AS t(value)
    LOOP
        v_retail_unit := product_data->>'retail_unit';
        v_wholesale_unit := product_data->>'wholesale_unit';
        v_conversion_factor := COALESCE((product_data->>'conversion_factor')::INT, 1);
        v_actual_cost := COALESCE((product_data->>'actual_cost')::NUMERIC, 0);

        -- 1. UPSERT VÀO BẢNG CHÍNH (PRODUCTS)
        INSERT INTO public.products (
            name, sku, barcode, active_ingredient, image_url,
            category_name, manufacturer_name, distributor_id, status,
            invoice_price, actual_cost, 
            wholesale_unit, retail_unit, conversion_factor,
            updated_at
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
            COALESCE(product_data->>'status', 'active'),
            (product_data->>'invoice_price')::NUMERIC,
            v_actual_cost,
            v_wholesale_unit,
            v_retail_unit,
            v_conversion_factor,
            NOW()
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
            wholesale_unit = EXCLUDED.wholesale_unit,
            retail_unit = EXCLUDED.retail_unit,
            conversion_factor = EXCLUDED.conversion_factor,
            updated_at = now()
        RETURNING id INTO v_product_id;

        -- 2. TỰ ĐỘNG ĐỒNG BỘ 3 LOẠI ĐƠN VỊ VÀO BẢNG PRODUCT_UNITS
        
        -- A. TẠO ĐƠN VỊ BASE (HỆ THỐNG TỰ SINH)
        -- Tên = Retail Unit, Rate = 1, Type = 'base', IsBase = True
        IF v_retail_unit IS NOT NULL AND v_retail_unit <> '' THEN
            UPDATE public.product_units 
            SET unit_name = v_retail_unit, 
                price_cost = v_actual_cost, -- Giá vốn base
                updated_at = NOW()
            WHERE product_id = v_product_id AND unit_type = 'base';

            IF NOT FOUND THEN
                INSERT INTO public.product_units (
                    product_id, unit_name, conversion_rate, 
                    is_base, is_direct_sale, 
                    price_cost, price_sell, unit_type
                ) VALUES (
                    v_product_id, v_retail_unit, 1, 
                    true, true, -- Base: true, Direct Sale: true
                    v_actual_cost, 0, 'base'
                );
            END IF;
        END IF;

        -- B. TẠO ĐƠN VỊ RETAIL (TỪ EXCEL)
        -- Tên = Retail Unit, Rate = 1, Type = 'retail', IsBase = False (để phân biệt với dòng base)
        IF v_retail_unit IS NOT NULL AND v_retail_unit <> '' THEN
            UPDATE public.product_units 
            SET unit_name = v_retail_unit, 
                price_cost = v_actual_cost,
                updated_at = NOW()
            WHERE product_id = v_product_id AND unit_type = 'retail';

            IF NOT FOUND THEN
                INSERT INTO public.product_units (
                    product_id, unit_name, conversion_rate, 
                    is_base, is_direct_sale, 
                    price_cost, price_sell, unit_type
                ) VALUES (
                    v_product_id, v_retail_unit, 1, 
                    false, true, -- Base: false
                    v_actual_cost, 0, 'retail'
                );
            END IF;
        END IF;

        -- C. TẠO ĐƠN VỊ WHOLESALE (TỪ EXCEL)
        -- Chỉ tạo nếu có tên và hệ số > 1
        IF v_wholesale_unit IS NOT NULL AND v_wholesale_unit <> '' AND v_conversion_factor > 1 THEN
            UPDATE public.product_units 
            SET unit_name = v_wholesale_unit, 
                conversion_rate = v_conversion_factor,
                price_cost = v_actual_cost * v_conversion_factor, -- Giá vốn sỉ = Vốn base * hệ số
                updated_at = NOW()
            WHERE product_id = v_product_id AND unit_type = 'wholesale';

            IF NOT FOUND THEN
                INSERT INTO public.product_units (
                    product_id, unit_name, conversion_rate, 
                    is_base, is_direct_sale, 
                    price_cost, price_sell, unit_type
                ) VALUES (
                    v_product_id, v_wholesale_unit, v_conversion_factor, 
                    false, true, 
                    v_actual_cost * v_conversion_factor, 0, 'wholesale'
                );
            END IF;
        END IF;

        -- 3. XỬ LÝ TỒN KHO (Giữ nguyên logic)
        v_inventory_settings := product_data->'inventory_settings';
        IF v_inventory_settings IS NOT NULL THEN
            FOR v_branch_key IN SELECT key FROM jsonb_object_keys(v_inventory_settings) AS t(key)
            LOOP
                SELECT id INTO v_warehouse_id FROM public.warehouses WHERE key = v_branch_key;
                IF v_warehouse_id IS NOT NULL THEN
                    INSERT INTO public.product_inventory (product_id, warehouse_id, stock_quantity)
                    VALUES (
                        v_product_id, v_warehouse_id, (v_inventory_settings->>v_branch_key)::INT
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


CREATE OR REPLACE FUNCTION "public"."calculate_carton_breakdown"("p_product_id" bigint, "p_required_qty" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."calculate_carton_breakdown"("p_product_id" bigint, "p_required_qty" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_package_cost"("p_items" "jsonb") RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_total_cost NUMERIC := 0;
  v_item JSONB;
  v_product_cost NUMERIC;
BEGIN
  -- 1. Loop qua từng item trong mảng JSON
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- 2. Lấy giá vốn (actual_cost) của sản phẩm/dịch vụ con từ bảng 'products'
    SELECT COALESCE(p.actual_cost, 0)
    INTO v_product_cost
    FROM public.products p
    WHERE p.id = (v_item->>'item_id')::BIGINT;
    
    -- 3. Cộng dồn vào tổng giá vốn
    v_total_cost := v_total_cost + (v_product_cost * (v_item->>'quantity')::NUMERIC);
  END LOOP;
  
  RETURN v_total_cost;
END;
$$;


ALTER FUNCTION "public"."calculate_package_cost"("p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_receipt_totals"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    BEGIN
        -- Cập nhật lại tổng tiền hàng trong Header
        UPDATE public.inventory_receipts
        SET 
            total_goods_amount = (
                SELECT COALESCE(SUM(sub_total), 0) 
                FROM public.inventory_receipt_items 
                WHERE receipt_id = COALESCE(NEW.receipt_id, OLD.receipt_id)
            ),
            updated_at = NOW()
        WHERE id = COALESCE(NEW.receipt_id, OLD.receipt_id);
        
        -- Cập nhật Final Amount (Tổng hàng - CK + Ship + Phí)
        UPDATE public.inventory_receipts
        SET final_amount = total_goods_amount - discount_order + shipping_fee + other_fee
        WHERE id = COALESCE(NEW.receipt_id, OLD.receipt_id);

        RETURN NULL;
    END;
    $$;


ALTER FUNCTION "public"."calculate_receipt_totals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_inventory_check"("p_check_id" bigint, "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    BEGIN
        -- Chỉ hủy được khi đang là DRAFT
        UPDATE public.inventory_checks
        SET 
            status = 'CANCELLED',
            verified_by = p_user_id, -- Người hủy
            completed_at = NOW(),    -- Thời điểm hủy
            updated_at = NOW()
        WHERE id = p_check_id 
          AND status = 'DRAFT';
          
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Phiếu không tồn tại hoặc đã hoàn tất/hủy.';
        END IF;
    END;
    $$;


ALTER FUNCTION "public"."cancel_inventory_check"("p_check_id" bigint, "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_outbound_task"("p_order_id" "uuid", "p_reason" "text", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_user_email TEXT;
        v_current_status TEXT;
    BEGIN
        SELECT status INTO v_current_status FROM public.orders WHERE id = p_order_id;
        
        IF v_current_status = 'DELIVERED' THEN
            RAISE EXCEPTION 'Không thể hủy đơn đã giao thành công.';
        END IF;

        SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;

        UPDATE public.orders
        SET 
            status = 'CANCELLED',
            note = COALESCE(note, '') || E'\n[Hủy kho bởi ' || COALESCE(v_user_email, 'User') || ': ' || p_reason || ']',
            updated_at = NOW()
        WHERE id = p_order_id;

        RETURN jsonb_build_object('success', true, 'message', 'Đã hủy nhiệm vụ xuất kho.');
    END;
    $$;


ALTER FUNCTION "public"."cancel_outbound_task"("p_order_id" "uuid", "p_reason" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_in_patient"("p_customer_id" bigint, "p_doctor_id" "uuid" DEFAULT NULL::"uuid", "p_priority" "text" DEFAULT 'normal'::"text", "p_symptoms" "jsonb" DEFAULT '[]'::"jsonb", "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_queue_num INTEGER;
        v_appt_id UUID;
        v_queue_id BIGINT;
    BEGIN
        -- 1. Lấy số thứ tự tiếp theo trong ngày
        SELECT COALESCE(MAX(queue_number), 0) + 1 INTO v_queue_num
        FROM public.clinical_queues
        WHERE date(created_at) = CURRENT_DATE;

        -- 2. Tạo Appointment "tức thì" (Status = checked_in)
        INSERT INTO public.appointments (
            customer_id, 
            doctor_id, 
            appointment_time, 
            status, 
            symptoms, 
            note, 
            service_type
        ) VALUES (
            p_customer_id, 
            p_doctor_id, 
            now(), 
            'checked_in', 
            p_symptoms, 
            p_notes, 
            'examination'
        ) RETURNING id INTO v_appt_id;

        -- 3. Đẩy vào hàng đợi
        INSERT INTO public.clinical_queues (
            appointment_id, 
            customer_id, 
            doctor_id, 
            queue_number, 
            status, 
            priority_level
        ) VALUES (
            v_appt_id, 
            p_customer_id, 
            p_doctor_id, 
            v_queue_num, 
            'waiting', 
            p_priority::public.queue_priority
        ) RETURNING id INTO v_queue_id;

        RETURN jsonb_build_object(
            'success', true, 
            'queue_number', v_queue_num, 
            'queue_id', v_queue_id
        );
    END;
    $$;


ALTER FUNCTION "public"."check_in_patient"("p_customer_id" bigint, "p_doctor_id" "uuid", "p_priority" "text", "p_symptoms" "jsonb", "p_notes" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_in_patient"("p_customer_id" bigint, "p_doctor_id" "uuid", "p_priority" "text", "p_symptoms" "jsonb", "p_notes" "text") IS 'Check-in tại quầy: Tạo lịch hẹn ngay lập tức và xếp số vào hàng đợi';



CREATE OR REPLACE FUNCTION "public"."check_invoice_exists"("p_tax_code" "text", "p_symbol" "text", "p_number" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    BEGIN
        -- Trả về True nếu tìm thấy hóa đơn trùng mà chưa bị reject
        RETURN EXISTS (
            SELECT 1 
            FROM public.finance_invoices
            WHERE supplier_tax_code = p_tax_code
              AND invoice_symbol = p_symbol
              AND invoice_number = p_number
              AND status != 'rejected'
        );
    END;
    $$;


ALTER FUNCTION "public"."check_invoice_exists"("p_tax_code" "text", "p_symbol" "text", "p_number" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_invoice_exists"("p_tax_code" "text", "p_symbol" "text", "p_number" "text") IS 'Kiểm tra xem hóa đơn đã tồn tại trong hệ thống chưa (Bỏ qua Rejected)';



CREATE OR REPLACE FUNCTION "public"."check_product_dependencies"("p_product_ids" bigint[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_result JSONB;
    BEGIN
        SELECT jsonb_agg(
            jsonb_build_object(
                'product_id', p.id,
                'product_name', p.name,
                'package_names', used_packages.names
            )
        ) INTO v_result
        FROM public.products p
        JOIN (
            -- [FIXED] Sửa spi.product_id -> spi.item_id
            SELECT 
                spi.item_id, 
                array_agg(DISTINCT sp.name) as names
            FROM public.service_package_items spi
            JOIN public.service_packages sp ON spi.package_id = sp.id
            
            -- [FIXED] WHERE clause
            WHERE spi.item_id = ANY(p_product_ids)
            
            -- [FIXED] GROUP BY clause
            GROUP BY spi.item_id
            
        ) used_packages ON p.id = used_packages.item_id; -- [FIXED] JOIN condition

        -- Nếu không có ràng buộc nào, trả về mảng rỗng thay vì NULL
        RETURN COALESCE(v_result, '[]'::JSONB);
    END;
    $$;


ALTER FUNCTION "public"."check_product_dependencies"("p_product_ids" bigint[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_product_dependencies"("p_product_ids" bigint[]) IS 'Check Ràng buộc (Fixed: item_id column)';



CREATE OR REPLACE FUNCTION "public"."check_vat_availability"("p_product_id" bigint, "p_vat_rate" numeric, "p_qty_requested" numeric) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_balance NUMERIC;
    BEGIN
        SELECT quantity_balance INTO v_balance
        FROM public.vat_inventory_ledger
        WHERE product_id = p_product_id AND vat_rate = p_vat_rate;
        
        -- Nếu không tìm thấy dòng nào -> Tồn = 0 -> Trả về False (nếu request > 0)
        RETURN COALESCE(v_balance, 0) >= p_qty_requested;
    END;
    $$;


ALTER FUNCTION "public"."check_vat_availability"("p_product_id" bigint, "p_vat_rate" numeric, "p_qty_requested" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_vat_availability"("p_product_id" bigint, "p_vat_rate" numeric, "p_qty_requested" numeric) IS 'Kiểm tra khả năng đáp ứng xuất hóa đơn VAT (tránh âm kho)';



CREATE OR REPLACE FUNCTION "public"."complete_inventory_check"("p_check_id" bigint, "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_check_record RECORD;
        v_item RECORD;
        v_batch_id BIGINT;
        v_diff_qty INTEGER;
        v_trans_type TEXT;
    BEGIN
        -- A. Lấy thông tin phiếu (Khóa dòng để tránh conflict)
        SELECT * INTO v_check_record 
        FROM public.inventory_checks 
        WHERE id = p_check_id AND status = 'DRAFT' 
        FOR UPDATE;

        IF v_check_record IS NULL THEN 
            RAISE EXCEPTION 'Phiếu kiểm kê không hợp lệ (Không tồn tại hoặc đã hoàn tất).'; 
        END IF;

        -- B. Duyệt qua từng dòng chi tiết đã đếm
        FOR v_item IN SELECT * FROM public.inventory_check_items WHERE check_id = p_check_id
        LOOP
            -- 1. Tìm ID của Batch (hoặc tạo mới nếu kho lòi ra hàng lạ)
            SELECT id INTO v_batch_id 
            FROM public.batches 
            WHERE product_id = v_item.product_id AND batch_code = v_item.batch_code;

            IF v_batch_id IS NULL THEN
                -- Tạo Batch mới nếu chưa có
                INSERT INTO public.batches (product_id, batch_code, expiry_date, inbound_price)
                VALUES (v_item.product_id, v_item.batch_code, COALESCE(v_item.expiry_date, CURRENT_DATE + 365), 0)
                RETURNING id INTO v_batch_id;
            END IF;

            -- 2. Tính lệch để ghi Lịch sử (Transaction)
            -- Lệch = Thực tế - Sổ sách (Lúc tạo phiếu)
            -- Lưu ý: Ở đây ta so sánh với system_quantity (snapshot). 
            -- (Nếu muốn chính xác tuyệt đối với Live stock, cần tính toán lại, nhưng quy trình chuẩn là so với Snapshot).
            v_diff_qty := v_item.actual_quantity - v_item.system_quantity;

            IF v_diff_qty <> 0 THEN
                v_trans_type := CASE WHEN v_diff_qty > 0 THEN 'IN_ADJUST' ELSE 'OUT_ADJUST' END;
                
                INSERT INTO public.inventory_transactions (
                    warehouse_id, product_id, batch_id, 
                    type, quantity, ref_id, 
                    note, created_at, created_by
                )
                VALUES (
                    v_check_record.warehouse_id, v_item.product_id, v_batch_id,
                    v_trans_type, ABS(v_diff_qty), v_check_record.code, 
                    'Kiểm kê lệch: ' || COALESCE(v_item.difference_reason, ''), NOW(), p_user_id
                );
            END IF;

            -- 3. CẬP NHẬT TỒN KHO THẬT (GHI ĐÈ SỐ THỰC TẾ VÀO KHO)
            -- Logic: Inventory Batches = Actual Quantity
            INSERT INTO public.inventory_batches (
                warehouse_id, product_id, batch_id, quantity, updated_at
            )
            VALUES (
                v_check_record.warehouse_id, v_item.product_id, v_batch_id, v_item.actual_quantity, NOW()
            )
            ON CONFLICT (warehouse_id, product_id, batch_id)
            DO UPDATE SET 
                quantity = EXCLUDED.quantity, -- Quan trọng: Đè số lượng kiểm kê vào
                updated_at = NOW();
                
            -- Trigger 'sync_inventory_batch_to_total' sẽ tự động chạy để update bảng product_inventory
            
        END LOOP;

        -- C. Đổi trạng thái phiếu -> COMPLETED
        UPDATE public.inventory_checks
        SET 
            status = 'COMPLETED', 
            verified_by = p_user_id, 
            completed_at = NOW(),
            -- Tính lại tổng giá trị thực tế lần cuối
            total_actual_value = (
                SELECT SUM(actual_quantity * cost_price) 
                FROM public.inventory_check_items WHERE check_id = p_check_id
            )
        WHERE id = p_check_id;

    END;
    $$;


ALTER FUNCTION "public"."complete_inventory_check"("p_check_id" bigint, "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."complete_inventory_check"("p_check_id" bigint, "p_user_id" "uuid") IS 'Chốt kiểm kê: Cân bằng kho & Ghi log Transaction';



CREATE OR REPLACE FUNCTION "public"."confirm_finance_transaction"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_current_status public.transaction_status;
BEGIN
    -- Kiểm tra trạng thái
    SELECT status INTO v_current_status FROM public.finance_transactions WHERE id = p_id;
    
    IF v_current_status = 'confirmed' THEN
        RAISE EXCEPTION 'Giao dịch này đã được duyệt trước đó.';
    END IF;

    IF v_current_status = 'cancelled' THEN
        RAISE EXCEPTION 'Không thể duyệt giao dịch đã bị hủy.';
    END IF;

    -- Cập nhật (Trigger sẽ tự động trừ tiền quỹ)
    UPDATE public.finance_transactions 
    SET status = 'confirmed', updated_at = now()
    WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."confirm_finance_transaction"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_finance_transaction"("p_id" bigint, "p_target_status" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_current_status public.transaction_status;
    v_valid_target boolean;
BEGIN
    -- 1. Validate Target Status
    IF p_target_status NOT IN ('approved', 'completed') THEN
        RAISE EXCEPTION 'Trạng thái đích không hợp lệ. Chỉ chấp nhận approved hoặc completed.';
    END IF;

    -- 2. Kiểm tra trạng thái hiện tại
    SELECT status INTO v_current_status FROM public.finance_transactions WHERE id = p_id;
    
    IF v_current_status = 'cancelled' THEN
        RAISE EXCEPTION 'Không thể xử lý giao dịch đã bị hủy.';
    END IF;

    IF v_current_status = 'completed' THEN
        RAISE EXCEPTION 'Giao dịch này đã hoàn tất, không thể thay đổi trạng thái nữa.';
    END IF;
    
    -- Chặn việc approve lại cái đã approve rồi (tùy chọn, nhưng tốt cho UX)
    IF v_current_status = 'approved' AND p_target_status = 'approved' THEN
         RETURN TRUE; -- Coi như thành công nhưng không làm gì
    END IF;

    -- 3. Cập nhật (Trigger sẽ lo phần tiền nong)
    UPDATE public.finance_transactions 
    SET status = p_target_status::public.transaction_status, 
        updated_at = now()
    WHERE id = p_id;

    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."confirm_finance_transaction"("p_id" bigint, "p_target_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_order_payment"("p_order_ids" "uuid"[], "p_fund_account_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_order RECORD;
    v_count INT := 0;
    v_total_receipt NUMERIC := 0;
    v_remaining_amount NUMERIC;
    v_trans_code TEXT;
    v_partner_name TEXT;
    v_fund_name TEXT;
BEGIN
    -- 1. Validate Quỹ
    SELECT name INTO v_fund_name FROM public.fund_accounts WHERE id = p_fund_account_id;
    IF v_fund_name IS NULL THEN
        RAISE EXCEPTION 'Tài khoản quỹ không tồn tại (ID: %).', p_fund_account_id;
    END IF;

    -- 2. Duyệt qua từng đơn hàng được chọn
    FOR v_order IN 
        SELECT o.*, c.name as customer_name
        FROM public.orders o
        LEFT JOIN public.customers_b2b c ON o.customer_id = c.id
        WHERE o.id = ANY(p_order_ids) 
          AND o.status NOT IN ('DRAFT', 'CANCELLED')
          AND o.payment_status != 'paid' -- Chỉ xử lý đơn chưa thanh toán hết
    LOOP
        -- Tính số tiền còn thiếu (Thực thu)
        v_remaining_amount := v_order.final_amount - COALESCE(v_order.paid_amount, 0);

        IF v_remaining_amount > 0 THEN
            
            -- A. Update Đơn hàng: Đã thanh toán đủ
            -- (Lưu ý: Không update remittance_status nếu cột này chưa tồn tại trong bảng Orders của Schema hiện tại)
            UPDATE public.orders
            SET 
                paid_amount = final_amount,
                payment_status = 'paid',
                updated_at = NOW()
            WHERE id = v_order.id;

            -- B. Tạo Phiếu Thu (Dùng cấu trúc Polymorphic hiện có)
            v_trans_code := 'PT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || FLOOR(RANDOM() * 10000)::TEXT;
            
            -- Lấy tên đối tác để cache
            v_partner_name := COALESCE(v_order.customer_name, 'Khách B2B');

            INSERT INTO public.finance_transactions (
                code, 
                transaction_date,
                flow,           -- 'in' (Thu)
                business_type,  -- 'trade' (Bán hàng)
                amount, 
                fund_account_id,
                
                -- Mapping Polymorphic
                partner_type,       -- 'customer_b2b'
                partner_id,         -- ID khách hàng (lưu dạng text)
                partner_name_cache, -- Tên khách
                
                ref_type,           -- 'order'
                ref_id,             -- ID đơn hàng (lưu dạng text)
                
                description,
                created_by,
                status
            ) VALUES (
                v_trans_code,
                NOW(),
                'in',
                'trade',
                v_remaining_amount,
                p_fund_account_id,
                
                'customer_b2b',
                v_order.customer_id::TEXT,
                v_partner_name,
                
                'order',
                v_order.id::TEXT,
                
                'Thu tiền đơn hàng ' || v_order.code,
                auth.uid(),
                'completed' -- Hoàn tất ngay để cộng tiền vào quỹ
            );

            v_count := v_count + 1;
            v_total_receipt := v_total_receipt + v_remaining_amount;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'count', v_count,
        'total_amount', v_total_receipt,
        'message', 'Đã thu ' || v_total_receipt || ' vào quỹ ' || v_fund_name
    );
END;
$$;


ALTER FUNCTION "public"."confirm_order_payment"("p_order_ids" "uuid"[], "p_fund_account_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_outbound_packing"("p_order_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
        v_current_status TEXT;
        v_warehouse_id BIGINT;
        v_customer_id BIGINT;
        v_order_code TEXT;
        
        v_item RECORD;
        v_batch RECORD;
        v_qty_needed INTEGER; -- Số lượng theo Base Unit
        v_deduct_amount INTEGER;
        v_conversion_factor INTEGER;
    BEGIN
        -- A. Lấy thông tin đơn hàng
        SELECT status, warehouse_id, code, customer_id 
        INTO v_current_status, v_warehouse_id, v_order_code, v_customer_id
        FROM public.orders WHERE id = p_order_id;

        IF v_current_status IS NULL THEN RAISE EXCEPTION 'Không tìm thấy đơn hàng.'; END IF;
        
        -- Chỉ cho phép đóng gói khi đơn đang CONFIRMED (Đã duyệt)
        IF v_current_status != 'CONFIRMED' THEN
            RAISE EXCEPTION 'Đơn hàng không ở trạng thái chờ đóng gói (CONFIRMED).';
        END IF;

        IF v_warehouse_id IS NULL THEN v_warehouse_id := 1; END IF; -- Fallback an toàn

        -- B. LOOP: Duyệt từng sản phẩm trong đơn
        FOR v_item IN 
            SELECT oi.product_id, oi.quantity, oi.uom, oi.conversion_factor, p.name as product_name, p.actual_cost
            FROM public.order_items oi
            JOIN public.products p ON oi.product_id = p.id
            WHERE oi.order_id = p_order_id
        LOOP
            -- Tính tổng số lượng Base cần xuất (VD: 2 Thùng x 24 = 48 lon)
            -- Ưu tiên lấy conversion_factor đã lưu lúc đặt hàng, nếu null thì tra bảng units
            v_conversion_factor := COALESCE(v_item.conversion_factor, 1);
            v_qty_needed := v_item.quantity * v_conversion_factor;

            -- C. FEFO LOOP: Quét lô để trừ kho
            FOR v_batch IN 
                SELECT ib.id, ib.batch_id, ib.quantity, b.inbound_price -- [QUAN TRỌNG] Lấy giá vốn đích danh của lô
                FROM public.inventory_batches ib
                JOIN public.batches b ON ib.batch_id = b.id
                WHERE ib.product_id = v_item.product_id 
                  AND ib.warehouse_id = v_warehouse_id
                  AND ib.quantity > 0
                ORDER BY b.expiry_date ASC, b.created_at ASC -- Hết hạn trước -> Nhập trước -> Xuất trước
                FOR UPDATE
            LOOP
                EXIT WHEN v_qty_needed <= 0;

                -- Tính lượng trừ tại lô này
                IF v_batch.quantity >= v_qty_needed THEN
                    v_deduct_amount := v_qty_needed;
                ELSE
                    v_deduct_amount := v_batch.quantity;
                END IF;

                -- 1. Trừ kho chi tiết (Inventory Batches)
                UPDATE public.inventory_batches
                SET quantity = quantity - v_deduct_amount, updated_at = NOW()
                WHERE id = v_batch.id;

                -- 2. Ghi nhận giao dịch tài chính (Inventory Transactions) - [CHUẨN KẾ TOÁN]
                -- Unit Price = Giá vốn thực tế của lô (inbound_price)
                INSERT INTO public.inventory_transactions (
                    warehouse_id, product_id, batch_id, 
                    type, action_group, 
                    quantity, unit_price, -- Lưu ý: Quantity âm để thể hiện xuất
                    ref_id, description, partner_id, created_at, created_by
                ) VALUES (
                    v_warehouse_id, v_item.product_id, v_batch.batch_id,
                    'sale_order', 'SALE',
                    -v_deduct_amount, COALESCE(v_batch.inbound_price, v_item.actual_cost, 0), -- Giá vốn đích danh
                    v_order_code, 'Xuất kho đơn ' || v_order_code, v_customer_id, NOW(), auth.uid()
                );

                v_qty_needed := v_qty_needed - v_deduct_amount;
            END LOOP;

            -- D. Validation cuối cùng
            IF v_qty_needed > 0 THEN
                RAISE EXCEPTION 'Kho không đủ hàng xuất cho sản phẩm "%". Thiếu % (đvcs). Vui lòng kiểm tra tồn kho.', v_item.product_name, v_qty_needed;
            END IF;

            -- E. Cập nhật số lượng đã nhặt vào Order Items (Optional nhưng tốt cho tracking)
            UPDATE public.order_items 
            SET quantity_picked = (v_item.quantity * v_conversion_factor) -- Lưu số lượng base đã nhặt
            WHERE order_id = p_order_id AND product_id = v_item.product_id;

        END LOOP;

        -- F. Chuyển trạng thái đơn -> PACKED
        UPDATE public.orders
        SET status = 'PACKED', updated_at = NOW()
        WHERE id = p_order_id;

        RETURN jsonb_build_object('success', true, 'message', 'Đã xuất kho và đóng gói thành công.');
    END;
    $$;


ALTER FUNCTION "public"."confirm_outbound_packing"("p_order_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."confirm_outbound_packing"("p_order_id" "uuid") IS 'V5: Trừ kho thật theo nguyên tắc FEFO và chuyển trạng thái sang PACKED';



CREATE OR REPLACE FUNCTION "public"."confirm_purchase_order"("p_po_id" bigint, "p_status" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.purchase_orders
    SET 
        status = p_status,
        updated_at = NOW()
    WHERE id = p_po_id;
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."confirm_purchase_order"("p_po_id" bigint, "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_purchase_order_financials"("p_po_id" bigint, "p_items_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_item JSONB;
    v_po_record RECORD;
    v_total_rebate NUMERIC := 0;
    v_supplier_id BIGINT;
BEGIN
    SELECT * INTO v_po_record FROM public.purchase_orders WHERE id = p_po_id;
    
    IF v_po_record IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy đơn mua hàng ID %', p_po_id;
    END IF;

    v_supplier_id := v_po_record.supplier_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_data)
    LOOP
        -- Update các cột tài chính mới
        UPDATE public.purchase_order_items
        SET 
            vat_rate = COALESCE((v_item->>'vat_rate')::NUMERIC, 0),
            rebate_rate = COALESCE((v_item->>'rebate_rate')::NUMERIC, 0),
            bonus_quantity = COALESCE((v_item->>'bonus_quantity')::INTEGER, 0),
            allocated_shipping_fee = COALESCE((v_item->>'allocated_shipping_fee')::NUMERIC, 0),
            final_unit_cost = COALESCE((v_item->>'final_unit_cost')::NUMERIC, 0)
        WHERE id = (v_item->>'id')::BIGINT;

        -- Tính tổng Rebate
        v_total_rebate := v_total_rebate + 
            ( 
                ((v_item->>'unit_price')::NUMERIC * (v_item->>'quantity_ordered')::NUMERIC) 
                * ((v_item->>'rebate_rate')::NUMERIC / 100.0) 
            );
            
        -- Cập nhật giá nhập gần nhất vào Products
        UPDATE public.products
        SET actual_cost = COALESCE((v_item->>'final_unit_cost')::NUMERIC, actual_cost),
            updated_at = NOW()
        WHERE id = (v_item->>'product_id')::BIGINT;
    END LOOP;

    -- Cộng tiền vào Ví
    IF v_total_rebate > 0 THEN
        INSERT INTO public.supplier_wallets (supplier_id, balance, total_earned, updated_at)
        VALUES (v_supplier_id, v_total_rebate, v_total_rebate, NOW())
        ON CONFLICT (supplier_id) 
        DO UPDATE SET 
            balance = public.supplier_wallets.balance + v_total_rebate,
            total_earned = public.supplier_wallets.total_earned + v_total_rebate,
            updated_at = NOW();
    END IF;

    -- Đổi trạng thái PO
    UPDATE public.purchase_orders 
    SET status = 'COMPLETED', 
        updated_at = NOW() 
    WHERE id = p_po_id;

    RETURN jsonb_build_object(
        'success', true, 
        'total_rebate_earned', v_total_rebate,
        'message', 'Đã cập nhật giá vốn và tích lũy ví NCC thành công.'
    );
END;
$$;


ALTER FUNCTION "public"."confirm_purchase_order_financials"("p_po_id" bigint, "p_items_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_purchase_payment"("p_order_id" bigint, "p_amount" numeric, "p_fund_account_id" bigint, "p_payment_method" "text" DEFAULT 'bank_transfer'::"text", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_order RECORD;
    v_supplier_name TEXT;
    v_new_paid numeric;
    v_trans_code text;
    v_status text;
    v_fund_name text;
BEGIN
    -- 1. Lấy thông tin đơn hàng + Tên NCC
    SELECT po.*, s.name as supplier_name_text
    INTO v_order
    FROM public.purchase_orders po
    LEFT JOIN public.suppliers s ON po.supplier_id = s.id
    WHERE po.id = p_order_id;

    IF v_order.id IS NULL THEN 
        RAISE EXCEPTION 'Không tìm thấy đơn mua hàng ID %', p_order_id; 
    END IF;

    -- 2. Validate Quỹ
    SELECT name INTO v_fund_name FROM public.fund_accounts WHERE id = p_fund_account_id;
    IF v_fund_name IS NULL THEN 
        RAISE EXCEPTION 'Quỹ không tồn tại (ID: %)', p_fund_account_id; 
    END IF;

    -- 3. Tính toán tiền
    v_new_paid := COALESCE(v_order.total_paid, 0) + p_amount;
    
    -- Xác định trạng thái (Cho phép sai số nhỏ 500đ)
    IF v_new_paid >= (v_order.final_amount - 500) THEN 
        v_status := 'paid'; 
    ELSE 
        v_status := 'partial'; 
    END IF;

    -- 4. Update Đơn Mua Hàng
    UPDATE public.purchase_orders
    SET 
        total_paid = v_new_paid,
        payment_status = v_status,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 5. Tạo Phiếu Chi (Payment Voucher)
    v_trans_code := 'PC-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || FLOOR(RANDOM() * 10000)::TEXT;

    INSERT INTO public.finance_transactions (
        code, 
        transaction_date, 
        flow,           -- 'out' (Chi)
        business_type,  -- 'trade' (Thương mại)
        amount, 
        fund_account_id,
        
        partner_type,       -- 'supplier'
        partner_id,         -- ID lưu text
        partner_name_cache, -- Cache tên
        
        ref_type,           -- 'purchase_order'
        ref_id,             -- ID đơn mua
        
        description, 
        created_by, 
        status
    ) VALUES (
        v_trans_code, 
        NOW(), 
        'out', 
        'trade', 
        p_amount, 
        p_fund_account_id,
        
        'supplier', 
        v_order.supplier_id::TEXT, 
        COALESCE(v_order.supplier_name_text, 'NCC Lẻ'),
        
        'purchase_order', 
        p_order_id::TEXT,
        
        COALESCE(p_note, 'Chi thanh toán PO-' || p_order_id || ' (' || p_payment_method || ')'),
        auth.uid(), 
        'completed' -- Trigger sẽ tự trừ tiền quỹ
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_status', v_status,
        'paid_amount', v_new_paid,
        'trans_code', v_trans_code
    );
END;
$$;


ALTER FUNCTION "public"."confirm_purchase_payment"("p_order_id" bigint, "p_amount" numeric, "p_fund_account_id" bigint, "p_payment_method" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_transaction"("p_id" bigint) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_current_status public.transaction_status;
BEGIN
    -- 1. Kiểm tra trạng thái hiện tại
    SELECT status INTO v_current_status FROM public.finance_transactions WHERE id = p_id;
    
    IF v_current_status = 'confirmed' THEN
        RAISE EXCEPTION 'Giao dịch này đã được duyệt trước đó.';
    END IF;

    IF v_current_status = 'cancelled' THEN
        RAISE EXCEPTION 'Không thể duyệt giao dịch đã bị hủy.';
    END IF;

    -- 2. Cập nhật trạng thái -> Trigger sẽ tự động trừ/cộng tiền
    UPDATE public.finance_transactions 
    SET status = 'confirmed', updated_at = now()
    WHERE id = p_id;

    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."confirm_transaction"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_transfer_inbound"("p_transfer_id" bigint, "p_actor_warehouse_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_transfer_record RECORD;
    v_batch_track RECORD;
    v_received_count INT := 0;
    v_source_wh_name TEXT; -- [FIX] Biến lưu tên kho nguồn
BEGIN
    -- 1. Validate & Lock phiếu
    SELECT * INTO v_transfer_record 
    FROM public.inventory_transfers 
    WHERE id = p_transfer_id 
    FOR UPDATE;

    IF v_transfer_record IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy phiếu chuyển kho ID %', p_transfer_id;
    END IF;

    IF v_transfer_record.status != 'shipping' THEN
        RAISE EXCEPTION 'Phiếu không ở trạng thái chờ nhập kho (Status: %).', v_transfer_record.status;
    END IF;

    -- Validate đúng kho đích mới được nhập
    IF v_transfer_record.dest_warehouse_id != p_actor_warehouse_id THEN
        RAISE EXCEPTION 'Mã kho thực hiện (%) không trùng khớp với kho đích (%).', p_actor_warehouse_id, v_transfer_record.dest_warehouse_id;
    END IF;

    -- [FIX LOGIC]: Lấy tên kho nguồn từ bảng warehouses để ghi log cho đẹp
    SELECT name INTO v_source_wh_name FROM public.warehouses WHERE id = v_transfer_record.source_warehouse_id;

    -- 2. DUYỆT CÁC LÔ ĐÃ XUẤT (Tracking Logs) ĐỂ CỘNG VÀO KHO ĐÍCH
    FOR v_batch_track IN 
        SELECT 
            itbi.batch_id,
            itbi.quantity, 
            iti.product_id
        FROM public.inventory_transfer_batch_items itbi
        JOIN public.inventory_transfer_items iti ON itbi.transfer_item_id = iti.id
        WHERE iti.transfer_id = p_transfer_id
    LOOP
        -- A. Upsert vào Inventory Batches tại Kho Đích
        INSERT INTO public.inventory_batches (
            warehouse_id, 
            product_id, 
            batch_id, 
            quantity, 
            updated_at
        ) VALUES (
            v_transfer_record.dest_warehouse_id,
            v_batch_track.product_id, 
            v_batch_track.batch_id, 
            v_batch_track.quantity, 
            NOW()
        )
        ON CONFLICT (warehouse_id, product_id, batch_id) 
        DO UPDATE SET 
            quantity = public.inventory_batches.quantity + EXCLUDED.quantity,
            updated_at = NOW();

        -- B. Upsert vào Product Inventory (Tổng tồn kho)
        INSERT INTO public.product_inventory (
            warehouse_id, 
            product_id, 
            stock_quantity,
            updated_at
        ) VALUES (
            v_transfer_record.dest_warehouse_id,
            v_batch_track.product_id, 
            v_batch_track.quantity,
            NOW()
        )
        ON CONFLICT (warehouse_id, product_id)
        DO UPDATE SET 
            stock_quantity = public.product_inventory.stock_quantity + EXCLUDED.stock_quantity,
            updated_at = NOW();

        -- C. Ghi Log Giao dịch (Transaction)
        INSERT INTO public.inventory_transactions (
            warehouse_id, product_id, batch_id, 
            type, action_group, quantity, unit_price, 
            ref_id, description, created_by, created_at
        ) VALUES (
            v_transfer_record.dest_warehouse_id,
            v_batch_track.product_id,
            v_batch_track.batch_id,
            'transfer_in', 
            'TRANSFER',
            v_batch_track.quantity, 
            0,
            v_transfer_record.code,
            -- [FIX]: Dùng biến tên kho đã query, fallback về ID nếu null
            'Nhập kho chuyển từ ' || COALESCE(v_source_wh_name, 'Kho #' || v_transfer_record.source_warehouse_id),
            auth.uid(),
            NOW()
        );

        v_received_count := v_received_count + 1;
    END LOOP;

    -- 3. Cập nhật trạng thái phiếu -> COMPLETED
    UPDATE public.inventory_transfers
    SET status = 'completed',
        received_by = auth.uid(),
        received_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Đã nhập kho thành công.',
        'items_processed', v_received_count
    );
END;
$$;


ALTER FUNCTION "public"."confirm_transfer_inbound"("p_transfer_id" bigint, "p_actor_warehouse_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_transfer_outbound_fefo"("p_transfer_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_transfer_record RECORD;
    v_item RECORD;
    v_batch_record RECORD;
    v_qty_needed_base INTEGER; -- Số lượng cần xuất (Base Unit)
    v_qty_take INTEGER;        -- Số lượng lấy từ 1 lô
BEGIN
    -- 1. Lấy thông tin phiếu & Lock dòng để tránh tranh chấp
    SELECT * INTO v_transfer_record 
    FROM public.inventory_transfers 
    WHERE id = p_transfer_id 
    FOR UPDATE;

    IF v_transfer_record IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy phiếu chuyển kho ID %', p_transfer_id;
    END IF;

    IF v_transfer_record.status NOT IN ('pending', 'approved') THEN
        RAISE EXCEPTION 'Phiếu không ở trạng thái có thể xuất kho (Status: %)', v_transfer_record.status;
    END IF;

    -- 2. Duyệt qua từng sản phẩm trong phiếu
    FOR v_item IN 
        SELECT * FROM public.inventory_transfer_items 
        WHERE transfer_id = p_transfer_id
    LOOP
        -- Tính tổng số lượng Base Unit cần xuất
        -- Công thức: (Qty Requested * Conversion Factor) - (Đã xuất nếu có)
        v_qty_needed_base := (v_item.qty_requested * COALESCE(v_item.conversion_factor, 1))::INTEGER - COALESCE(v_item.qty_shipped, 0)::INTEGER;

        -- Nếu dòng này đã xuất đủ hoặc không cần xuất -> Bỏ qua
        IF v_qty_needed_base <= 0 THEN CONTINUE; END IF;

        -- 3. [CORE FIX]: Tìm các lô trong Kho Nguồn theo FEFO (Phải JOIN bảng batches)
        FOR v_batch_record IN 
            SELECT ib.id, ib.batch_id, ib.quantity 
            FROM public.inventory_batches ib
            JOIN public.batches b ON ib.batch_id = b.id -- Join để lấy expiry_date
            WHERE ib.warehouse_id = v_transfer_record.source_warehouse_id
              AND ib.product_id = v_item.product_id
              AND ib.quantity > 0
            ORDER BY b.expiry_date ASC, b.created_at ASC -- Ưu tiên hết hạn trước, nhập trước
        LOOP
            -- Tính số lượng lấy từ lô này
            IF v_batch_record.quantity >= v_qty_needed_base THEN
                v_qty_take := v_qty_needed_base;
            ELSE
                v_qty_take := v_batch_record.quantity;
            END IF;

            -- A. Trừ kho lô này (Inventory Batches)
            UPDATE public.inventory_batches
            SET quantity = quantity - v_qty_take,
                updated_at = NOW()
            WHERE id = v_batch_record.id;

            -- B. Ghi log tracking (Để biết phiếu này đã lấy hàng từ lô nào)
            INSERT INTO public.inventory_transfer_batch_items (
                transfer_item_id, batch_id, quantity
            ) VALUES (
                v_item.id, v_batch_record.batch_id, v_qty_take
            );
            
            -- C. [QUAN TRỌNG] Ghi Inventory Transactions (Sổ cái kho)
            INSERT INTO public.inventory_transactions (
                warehouse_id, product_id, batch_id, type, action_group, 
                quantity, unit_price, ref_id, description, created_by
            ) VALUES (
                v_transfer_record.source_warehouse_id,
                v_item.product_id,
                v_batch_record.batch_id,
                'transfer_out', -- Loại giao dịch
                'TRANSFER',
                -v_qty_take,    -- Số lượng âm (xuất)
                0,              -- Giá vốn (Có thể update sau hoặc lấy từ product)
                v_transfer_record.code,
                'Xuất chuyển kho tới ' || v_transfer_record.dest_warehouse_id,
                auth.uid()
            );

            -- D. Giảm số lượng cần tìm
            v_qty_needed_base := v_qty_needed_base - v_qty_take;

            -- Nếu đã đủ hàng -> Dừng tìm lô tiếp
            IF v_qty_needed_base = 0 THEN EXIT; END IF;
        END LOOP;

        -- 4. Nếu sau khi quét hết kho mà vẫn thiếu hàng -> Báo lỗi chặn lại
        IF v_qty_needed_base > 0 THEN
            RAISE EXCEPTION 'Kho nguồn không đủ hàng cho sản phẩm ID %. Thiếu % (Base Unit). Vui lòng kiểm tra tồn kho.', v_item.product_id, v_qty_needed_base;
        END IF;

        -- 5. Cập nhật số lượng đã xuất vào Item
        UPDATE public.inventory_transfer_items
        SET qty_shipped = (v_item.qty_requested * COALESCE(v_item.conversion_factor, 1)) -- Lưu theo Base
        WHERE id = v_item.id;

    END LOOP;

    -- 6. Cập nhật trạng thái phiếu -> SHIPPING
    UPDATE public.inventory_transfers
    SET status = 'shipping',
        updated_at = NOW()
    WHERE id = p_transfer_id;

    RETURN jsonb_build_object('success', true, 'message', 'Đã xuất kho thành công (Auto-FEFO).');
END;
$$;


ALTER FUNCTION "public"."confirm_transfer_outbound_fefo"("p_transfer_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_appointment_booking"("p_customer_id" bigint, "p_doctor_id" "uuid" DEFAULT NULL::"uuid", "p_time" timestamp with time zone DEFAULT "now"(), "p_symptoms" "jsonb" DEFAULT '[]'::"jsonb", "p_note" "text" DEFAULT NULL::"text", "p_type" "text" DEFAULT 'examination'::"text", "p_status" "text" DEFAULT 'confirmed'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_id UUID;
    BEGIN
        -- Thực hiện Insert
        INSERT INTO public.appointments (
            customer_id, 
            doctor_id, 
            appointment_time, 
            symptoms, 
            note, 
            service_type, 
            status -- Cột trạng thái
        ) VALUES (
            p_customer_id, 
            p_doctor_id, 
            p_time, 
            p_symptoms, 
            p_note, 
            p_type::public.appointment_service_type, 
            p_status::public.appointment_status -- Ép kiểu sang Enum (pending, confirmed...)
        ) RETURNING id INTO v_id;

        RETURN jsonb_build_object('success', true, 'appointment_id', v_id);
    END;
    $$;


ALTER FUNCTION "public"."create_appointment_booking"("p_customer_id" bigint, "p_doctor_id" "uuid", "p_time" timestamp with time zone, "p_symptoms" "jsonb", "p_note" "text", "p_type" "text", "p_status" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_appointment_booking"("p_customer_id" bigint, "p_doctor_id" "uuid", "p_time" timestamp with time zone, "p_symptoms" "jsonb", "p_note" "text", "p_type" "text", "p_status" "text") IS 'Tạo lịch hẹn: Mặc định là confirmed, có thể truyền pending để lưu nháp';



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


CREATE OR REPLACE FUNCTION "public"."create_auto_replenishment_request"("p_dest_warehouse_id" bigint, "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_source_warehouse_id BIGINT;
        v_transfer_id BIGINT;
        v_item_count INTEGER := 0;
        v_code TEXT;
        v_final_note TEXT;
    BEGIN
        -- 1. Xác định kho nguồn
        SELECT id INTO v_source_warehouse_id 
        FROM public.warehouses 
        WHERE key = 'b2b' OR type = 'central' 
        LIMIT 1;

        IF v_source_warehouse_id IS NULL THEN
            RAISE EXCEPTION 'Không tìm thấy Kho Tổng (Source Warehouse).';
        END IF;

        IF v_source_warehouse_id = p_dest_warehouse_id THEN
            RAISE EXCEPTION 'Kho nguồn và kho đích trùng nhau.';
        END IF;

        -- 2. Tạo Mã phiếu tạm
        v_code := 'TRF-' || to_char(now(), 'YYMMDD') || '-' || floor(random() * 10000)::text;

        -- 3. [CRITICAL LOGIC CHANGE]
        CREATE TEMP TABLE temp_replenish_items AS
        SELECT 
            pi.product_id,
            
            -- Ưu tiên theo thứ tự: Wholesale Unit -> Largest Unit -> Base Unit -> N/A
            COALESCE(target_unit.unit_name, largest_unit.unit_name, base_unit.unit_name, 'N/A') AS unit,
            
            COALESCE(target_unit.conversion_rate, largest_unit.conversion_rate, 1) AS conversion_factor,
            
            -- Công thức: (Max - Current) / Conversion_Factor_Of_Wholesale
            FLOOR(
                (pi.max_stock - pi.stock_quantity)::NUMERIC / 
                COALESCE(NULLIF(target_unit.conversion_rate, 0), NULLIF(largest_unit.conversion_rate, 0), 1)
            ) AS qty_needed
            
        FROM public.product_inventory pi
        JOIN public.products p ON pi.product_id = p.id
        
        -- A. Tìm Đơn vị Bán buôn (Ưu tiên số 1)
        LEFT JOIN LATERAL (
            SELECT unit_name, conversion_rate
            FROM public.product_units pu
            WHERE pu.product_id = pi.product_id
            AND pu.unit_type = 'wholesale' -- [KEY CHANGE] Chỉ tìm loại Wholesale
            LIMIT 1
        ) target_unit ON TRUE
        
        -- B. Tìm Đơn vị Lớn nhất (Dự phòng nếu chưa cấu hình Wholesale)
        LEFT JOIN LATERAL (
            SELECT unit_name, conversion_rate
            FROM public.product_units pu
            WHERE pu.product_id = pi.product_id
            ORDER BY pu.conversion_rate DESC
            LIMIT 1
        ) largest_unit ON TRUE

        -- C. Tìm Đơn vị Cơ sở (Dự phòng cuối cùng)
        LEFT JOIN LATERAL (
            SELECT unit_name
            FROM public.product_units pu_base
            WHERE pu_base.product_id = pi.product_id 
            AND pu_base.unit_type = 'base'
            LIMIT 1
        ) base_unit ON TRUE
        
        WHERE pi.warehouse_id = p_dest_warehouse_id
          AND pi.max_stock > 0
          AND p.status = 'active';

        -- Lọc bỏ dòng qty <= 0
        DELETE FROM temp_replenish_items WHERE qty_needed <= 0;

        GET DIAGNOSTICS v_item_count = ROW_COUNT;

        -- Thoát nếu không có item
        IF v_item_count = 0 THEN
            DROP TABLE temp_replenish_items;
            RETURN jsonb_build_object('success', false, 'message', 'Kho đã đủ hàng (theo đơn vị bán buôn), không cần bù.');
        END IF;

        -- 4. Xử lý Ghi chú
        v_final_note := 'Yêu cầu bù kho (Ưu tiên đơn vị Bán buôn)';
        IF p_note IS NOT NULL AND TRIM(p_note) <> '' THEN
            v_final_note := v_final_note || '. ' || p_note;
        END IF;

        -- 5. Tạo Header
        INSERT INTO public.inventory_transfers (
            code, source_warehouse_id, dest_warehouse_id, status, created_by, note, is_urgent
        ) VALUES (
            v_code, v_source_warehouse_id, p_dest_warehouse_id, 'pending', auth.uid(), v_final_note, false
        ) RETURNING id INTO v_transfer_id;

        -- 6. Insert Items
        INSERT INTO public.inventory_transfer_items (
            transfer_id, product_id, unit, conversion_factor, qty_requested, qty_approved
        )
        SELECT v_transfer_id, product_id, unit, conversion_factor, qty_needed, qty_needed
        FROM temp_replenish_items;

        DROP TABLE temp_replenish_items;

        RETURN jsonb_build_object(
            'success', true, 
            'transfer_id', v_transfer_id, 
            'item_count', v_item_count, 
            'message', 'Đã tạo phiếu yêu cầu (Tính theo đơn vị Wholesale).'
        );
    END;
    $$;


ALTER FUNCTION "public"."create_auto_replenishment_request"("p_dest_warehouse_id" bigint, "p_note" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_auto_replenishment_request"("p_dest_warehouse_id" bigint, "p_note" "text") IS 'V3.2: Bù kho tự động (Ưu tiên unit_type = wholesale)';



CREATE OR REPLACE FUNCTION "public"."create_check_session"("p_warehouse_id" bigint, "p_note" "text", "p_scope" "text", "p_text_val" "text" DEFAULT NULL::"text", "p_int_val" bigint DEFAULT NULL::bigint, "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_check_id BIGINT;
    v_code TEXT;
BEGIN
    -- A. Tạo mã phiếu KK-YYMMDD-HHMMSS
    v_code := 'KK-' || TO_CHAR(NOW(), 'YYMMDD-HH24MISS');

    -- B. Insert Header
    INSERT INTO public.inventory_checks (
        code, warehouse_id, status, note, created_by, total_system_value
    )
    VALUES (
        v_code, p_warehouse_id, 'DRAFT', p_note, p_user_id, 0
    )
    RETURNING id INTO v_check_id;

    -- C. Insert Items (SNAPSHOT)
    INSERT INTO public.inventory_check_items (
        check_id, product_id, batch_code, expiry_date, 
        system_quantity, actual_quantity, cost_price, location_snapshot
    )
    SELECT 
        v_check_id,
        ib.product_id,
        b.batch_code,
        b.expiry_date,
        ib.quantity, -- System Quantity
        ib.quantity, -- Actual Default = System (Ban đầu coi như khớp)
        p.actual_cost,
        
        -- [CORE OPTIMIZATION] Snapshot vị trí đầy đủ
        -- Nếu có cả Tủ và Kệ -> "Tủ A - Kệ 01"
        -- Nếu chỉ có Tủ -> "Tủ A"
        -- Nếu rỗng -> NULL
        TRIM(BOTH ' - ' FROM COALESCE(inv.location_cabinet, '') || CASE WHEN inv.shelf_location IS NOT NULL AND inv.shelf_location <> '' THEN ' - ' || inv.shelf_location ELSE '' END)
    FROM public.inventory_batches ib
    JOIN public.batches b ON ib.batch_id = b.id
    JOIN public.products p ON ib.product_id = p.id
    LEFT JOIN public.product_inventory inv ON ib.product_id = inv.product_id AND ib.warehouse_id = inv.warehouse_id
    
    WHERE ib.warehouse_id = p_warehouse_id 
      AND ib.quantity > 0 -- Chỉ kiểm những lô còn hàng
      
      -- [LOGIC LỌC ĐA NĂNG]
      AND (
          (p_scope = 'ALL') 
          OR
          (p_scope = 'CATEGORY' AND p.category_name = p_text_val) 
          OR
          (p_scope = 'MANUFACTURER' AND p.manufacturer_name = p_text_val) 
          OR
          -- [FIXED] Tìm kiếm linh hoạt trong cả Cabinet và Shelf
          (p_scope = 'CABINET' AND (
              inv.location_cabinet = p_text_val 
              OR inv.shelf_location = p_text_val
          ))
      );

    -- D. Cập nhật tổng tiền sổ sách (Total System Value)
    UPDATE public.inventory_checks 
    SET total_system_value = (
        SELECT COALESCE(SUM(system_quantity * cost_price), 0) 
        FROM public.inventory_check_items WHERE check_id = v_check_id
    )
    WHERE id = v_check_id;

    RETURN v_check_id;
END;
$$;


ALTER FUNCTION "public"."create_check_session"("p_warehouse_id" bigint, "p_note" "text", "p_scope" "text", "p_text_val" "text", "p_int_val" bigint, "p_user_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."create_finance_transaction"("p_amount" numeric, "p_business_type" "text", "p_cash_tally" "jsonb" DEFAULT NULL::"jsonb", "p_category_id" bigint DEFAULT NULL::bigint, "p_description" "text" DEFAULT NULL::"text", "p_flow" "text" DEFAULT 'out'::"text", "p_fund_id" bigint DEFAULT NULL::bigint, "p_partner_id" "text" DEFAULT NULL::"text", "p_partner_name" "text" DEFAULT NULL::"text", "p_partner_type" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT 'pending'::"text", "p_transaction_date" timestamp with time zone DEFAULT "now"(), "p_code" "text" DEFAULT NULL::"text", "p_ref_type" "text" DEFAULT NULL::"text", "p_ref_id" "text" DEFAULT NULL::"text", "p_evidence_url" "text" DEFAULT NULL::"text", "p_ref_advance_id" bigint DEFAULT NULL::bigint, "p_created_by" "uuid" DEFAULT NULL::"uuid", "p_target_bank_info" "jsonb" DEFAULT NULL::"jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
        v_new_id BIGINT;
        v_final_code TEXT;
        v_prefix TEXT;
        v_partner_name_final TEXT;
        v_creator_id UUID;
        
        v_flow_enum public.transaction_flow;
        v_biz_enum public.business_type;
        v_status_enum public.transaction_status;
    BEGIN
        -- A. Chuẩn hóa dữ liệu
        v_flow_enum := p_flow::public.transaction_flow;
        BEGIN v_biz_enum := p_business_type::public.business_type; EXCEPTION WHEN OTHERS THEN v_biz_enum := 'other'; END;
        v_status_enum := COALESCE(p_status, 'pending')::public.transaction_status;
        v_creator_id := COALESCE(p_created_by, auth.uid());

        -- B. Sinh mã phiếu
        IF v_flow_enum = 'in' THEN v_prefix := 'PT'; ELSE v_prefix := 'PC'; END IF;
        IF p_code IS NOT NULL AND p_code <> '' THEN 
            v_final_code := p_code;
        ELSE 
            v_final_code := v_prefix || '-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'); 
        END IF;

        -- C. Lấy tên đối tác
        v_partner_name_final := p_partner_name;
        IF v_partner_name_final IS NULL AND p_partner_id IS NOT NULL AND p_partner_id <> '' THEN
            BEGIN
                IF p_partner_type = 'supplier' THEN SELECT name INTO v_partner_name_final FROM public.suppliers WHERE id = p_partner_id::bigint;
                ELSIF p_partner_type = 'customer' THEN SELECT name INTO v_partner_name_final FROM public.customers WHERE id = p_partner_id::bigint;
                ELSIF p_partner_type = 'customer_b2b' THEN SELECT name INTO v_partner_name_final FROM public.customers_b2b WHERE id = p_partner_id::bigint;
                ELSIF p_partner_type = 'employee' THEN SELECT full_name INTO v_partner_name_final FROM public.users WHERE id = p_partner_id::uuid;
                END IF;
            EXCEPTION WHEN OTHERS THEN v_partner_name_final := 'N/A'; END;
        END IF;

        -- D. Insert
        INSERT INTO public.finance_transactions (
            code, flow, business_type, category_id, amount, fund_account_id,
            partner_type, partner_id, partner_name_cache,
            ref_type, ref_id, description, evidence_url, created_by, status, 
            transaction_date, ref_advance_id, 
            cash_tally, target_bank_info, -- [UPDATED]
            updated_at
        ) VALUES (
            v_final_code, v_flow_enum, v_biz_enum, p_category_id, p_amount, p_fund_id,
            p_partner_type, p_partner_id, v_partner_name_final,
            p_ref_type, p_ref_id, p_description, p_evidence_url, v_creator_id, v_status_enum, 
            COALESCE(p_transaction_date, NOW()), p_ref_advance_id, 
            p_cash_tally, p_target_bank_info,
            NOW()
        )
        RETURNING id INTO v_new_id;

        -- E. Hoàn ứng
        IF p_ref_advance_id IS NOT NULL THEN
            UPDATE public.finance_transactions SET status = 'completed', updated_at = now() WHERE id = p_ref_advance_id;
        END IF;

        RETURN v_new_id;
    END;
    $$;


ALTER FUNCTION "public"."create_finance_transaction"("p_amount" numeric, "p_business_type" "text", "p_cash_tally" "jsonb", "p_category_id" bigint, "p_description" "text", "p_flow" "text", "p_fund_id" bigint, "p_partner_id" "text", "p_partner_name" "text", "p_partner_type" "text", "p_status" "text", "p_transaction_date" timestamp with time zone, "p_code" "text", "p_ref_type" "text", "p_ref_id" "text", "p_evidence_url" "text", "p_ref_advance_id" bigint, "p_created_by" "uuid", "p_target_bank_info" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_full_supplier_program"("p_program_data" "jsonb", "p_groups_data" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_program_id BIGINT;
    v_group JSONB;
    v_group_id BIGINT;
    v_prod_id BIGINT;
BEGIN
    -- A. Insert Header
    INSERT INTO public.supplier_programs (
        supplier_id, code, name, type, 
        valid_from, valid_to, status, 
        document_code, attachment_url, description
    ) VALUES (
        (p_program_data->>'supplier_id')::BIGINT,
        p_program_data->>'code',
        p_program_data->>'name',
        (p_program_data->>'type')::public.supplier_program_type,
        (p_program_data->>'valid_from')::DATE,
        (p_program_data->>'valid_to')::DATE,
        'active',
        p_program_data->>'document_code',
        p_program_data->>'attachment_url',
        p_program_data->>'description'
    ) RETURNING id INTO v_program_id;

    -- B. Loop Insert Groups
    FOR v_group IN SELECT * FROM jsonb_array_elements(p_groups_data)
    LOOP
        INSERT INTO public.supplier_program_groups (
            program_id, name, rule_type, rules, price_basis
        ) VALUES (
            v_program_id,
            v_group->>'name',
            v_group->>'rule_type',
            v_group->'rules',
            COALESCE(v_group->>'price_basis', 'pre_vat')
        ) RETURNING id INTO v_group_id;

        -- C. Loop Insert Products (Scope)
        -- Sử dụng INSERT SELECT UNNEST để tối ưu hiệu năng thay vì loop từng dòng
        INSERT INTO public.supplier_program_products (group_id, product_id)
        SELECT v_group_id, (value::BIGINT)
        FROM jsonb_array_elements_text(v_group->'product_ids');
    END LOOP;

    RETURN v_program_id;
END;
$$;


ALTER FUNCTION "public"."create_full_supplier_program"("p_program_data" "jsonb", "p_groups_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_inventory_check"("p_warehouse_id" bigint, "p_user_id" "uuid", "p_note" "text" DEFAULT NULL::"text", "p_scope" "text" DEFAULT 'ALL'::"text", "p_text_val" "text" DEFAULT NULL::"text", "p_int_val" bigint DEFAULT NULL::bigint) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_check_id BIGINT;
        v_code TEXT;
    BEGIN
        -- A. Tạo mã phiếu KK-YYMMDD-HHMMSS
        v_code := 'KK-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS');

        -- B. Insert Header
        INSERT INTO public.inventory_checks (
            code, warehouse_id, status, note, created_by, total_system_value
        )
        VALUES (
            v_code, p_warehouse_id, 'DRAFT', p_note, p_user_id, 0
        )
        RETURNING id INTO v_check_id;

        -- C. Insert Items (SNAPSHOT)
        INSERT INTO public.inventory_check_items (
            check_id, product_id, batch_code, expiry_date, 
            system_quantity, actual_quantity, cost_price, location_snapshot
        )
        SELECT 
            v_check_id,
            ib.product_id,
            b.batch_code,
            b.expiry_date,
            ib.quantity, -- System Quantity
            ib.quantity, -- Actual Default = System
            p.actual_cost,
            inv.shelf_location
        FROM public.inventory_batches ib
        JOIN public.batches b ON ib.batch_id = b.id
        JOIN public.products p ON ib.product_id = p.id
        LEFT JOIN public.product_inventory inv ON ib.product_id = inv.product_id AND ib.warehouse_id = inv.warehouse_id
        
        WHERE ib.warehouse_id = p_warehouse_id 
          AND ib.quantity > 0
          
          -- [LOGIC LỌC MỚI THEO YÊU CẦU]
          AND (
              (p_scope = 'ALL') 
              OR
              (p_scope = 'CATEGORY' AND p.category_name = p_text_val) 
              OR
              -- Thay đổi từ Supplier ID sang Manufacturer Name
              (p_scope = 'MANUFACTURER' AND p.manufacturer_name = p_text_val) 
              OR
              (p_scope = 'CABINET' AND inv.location_cabinet = p_text_val)
          );

        -- D. Cập nhật tổng tiền sổ sách
        UPDATE public.inventory_checks 
        SET total_system_value = (
            SELECT COALESCE(SUM(system_quantity * cost_price), 0) 
            FROM public.inventory_check_items WHERE check_id = v_check_id
        )
        WHERE id = v_check_id;

        RETURN v_check_id;
    END;
    $$;


ALTER FUNCTION "public"."create_inventory_check"("p_warehouse_id" bigint, "p_user_id" "uuid", "p_note" "text", "p_scope" "text", "p_text_val" "text", "p_int_val" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_inventory_check"("p_warehouse_id" bigint, "p_user_id" "uuid", "p_note" "text", "p_scope" "text", "p_text_val" "text", "p_int_val" bigint) IS 'Tạo phiếu kiểm kê V2: Lọc theo Manufacturer Name';



CREATE OR REPLACE FUNCTION "public"."create_inventory_receipt"("p_po_id" bigint, "p_warehouse_id" bigint, "p_note" "text", "p_items" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
        v_receipt_id BIGINT;
        v_item JSONB;
        v_code TEXT;
    BEGIN
        -- A. Tạo Mã Phiếu Nhập (PNK-YYMMDD-XXXX)
        v_code := 'PNK-' || to_char(now(), 'YYMMDD') || '-' || floor(random() * 10000)::text;

        -- B. Insert Header Phiếu Nhập
        INSERT INTO public.inventory_receipts (
            code, po_id, warehouse_id, creator_id, receipt_date, note, status
        )
        VALUES (
            v_code, p_po_id, p_warehouse_id, auth.uid(), now(), p_note, 'completed'
        )
        RETURNING id INTO v_receipt_id;

        -- C. Insert Chi Tiết & Cập nhật Tồn Kho
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            -- 1. Lưu dòng chi tiết nhập
            INSERT INTO public.inventory_receipt_items (
                receipt_id, product_id, quantity, lot_number, expiry_date
            )
            VALUES (
                v_receipt_id,
                (v_item->>'product_id')::BIGINT,
                (v_item->>'quantity')::INTEGER,
                v_item->>'lot_number',
                (v_item->>'expiry_date')::DATE
            );

            -- 2. Cộng Tồn Kho (Vào bảng product_inventory)
            UPDATE public.product_inventory
            SET stock_quantity = stock_quantity + (v_item->>'quantity')::INTEGER
            WHERE product_id = (v_item->>'product_id')::BIGINT 
              AND warehouse_id = p_warehouse_id;
            
            -- Nếu chưa có dòng tồn kho thì insert (phòng hờ)
            IF NOT FOUND THEN
                INSERT INTO public.product_inventory (product_id, warehouse_id, stock_quantity, min_stock, max_stock)
                VALUES ((v_item->>'product_id')::BIGINT, p_warehouse_id, (v_item->>'quantity')::INTEGER, 0, 100);
            END IF;

            -- 3. Cập nhật số lượng đã nhập vào PO Items (Quan trọng để tính công nợ/đối chiếu)
            UPDATE public.purchase_order_items
            SET quantity_received = COALESCE(quantity_received, 0) + (v_item->>'quantity')::INTEGER
            WHERE po_id = p_po_id 
              AND product_id = (v_item->>'product_id')::BIGINT;
        END LOOP;

        -- D. Cập nhật trạng thái PO thành ĐÃ NHẬP (Theo yêu cầu AURA)
        UPDATE public.purchase_orders
        SET 
            delivery_status = 'delivered', -- Đã giao hàng
            status = 'COMPLETED',          -- Quy trình hoàn tất
            updated_at = now()
        WHERE id = p_po_id;

        RETURN v_receipt_id;
    END;
    $$;


ALTER FUNCTION "public"."create_inventory_receipt"("p_po_id" bigint, "p_warehouse_id" bigint, "p_note" "text", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_manual_transfer"("p_source_warehouse_id" bigint, "p_dest_warehouse_id" bigint, "p_note" "text", "p_items" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_transfer_id BIGINT;
    v_code TEXT;
    v_item JSONB;
BEGIN
    -- 1. Validate
    IF p_source_warehouse_id = p_dest_warehouse_id THEN
        RAISE EXCEPTION 'Kho nguồn và đích không được trùng nhau';
    END IF;

    -- 2. Sinh mã phiếu (TRF-YYMMDD-XXXX)
    v_code := 'TRF-' || to_char(now(), 'YYMMDD') || '-' || floor(random() * 10000)::text;

    -- 3. Tạo Header
    -- [CORE CONFIRM]: Dựa trên Schema, bảng inventory_transfers dùng 'created_by' (uuid)
    INSERT INTO public.inventory_transfers (
        code, 
        source_warehouse_id, 
        dest_warehouse_id, 
        status, 
        created_by,   -- [CORRECTED]: Tuân thủ schema
        note, 
        is_urgent,
        created_at,
        updated_at
    ) VALUES (
        v_code, 
        p_source_warehouse_id, 
        p_dest_warehouse_id, 
        'pending', 
        auth.uid(), 
        p_note, 
        false,
        NOW(),
        NOW()
    ) RETURNING id INTO v_transfer_id;

    -- 4. Tạo Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.inventory_transfer_items (
            transfer_id, 
            product_id, 
            unit, 
            conversion_factor, 
            qty_requested, 
            qty_approved, -- Mặc định bằng Requested
            qty_shipped,  -- Mặc định 0
            qty_received, -- Mặc định 0
            created_at
        ) VALUES (
            v_transfer_id,
            (v_item->>'product_id')::BIGINT,
            v_item->>'unit',
            COALESCE((v_item->>'conversion_factor')::INTEGER, 1),
            (v_item->>'quantity')::NUMERIC,
            (v_item->>'quantity')::NUMERIC, -- Auto approve
            0,
            0,
            NOW()
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'transfer_id', v_transfer_id, 'code', v_code);
END;
$$;


ALTER FUNCTION "public"."create_manual_transfer"("p_source_warehouse_id" bigint, "p_dest_warehouse_id" bigint, "p_note" "text", "p_items" "jsonb") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."create_prescription_template"("p_data" "jsonb", "p_items" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_new_id BIGINT;
    v_item JSONB;
BEGIN
    -- Insert Header
    INSERT INTO public.prescription_templates (name, diagnosis, note, status)
    VALUES (
        p_data->>'name',
        p_data->>'diagnosis',
        p_data->>'note',
        COALESCE(p_data->>'status', 'active')
    )
    RETURNING id INTO v_new_id;

    -- Insert Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.prescription_template_items (template_id, product_id, quantity, usage_instruction)
        VALUES (
            v_new_id,
            (v_item->>'product_id')::BIGINT, -- <-- QUAN TRỌNG: Ép kiểu sang BIGINT
            (v_item->>'quantity')::INTEGER,
            v_item->>'usage_instruction'
        );
    END LOOP;

    RETURN v_new_id;
END;
$$;


ALTER FUNCTION "public"."create_prescription_template"("p_data" "jsonb", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_product"("p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_items_per_carton" integer, "p_inventory_settings" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_product_id BIGINT;
    v_warehouse_key TEXT;
    v_warehouse_id BIGINT;
    v_min_stock INT;
    v_max_stock INT;
BEGIN
    -- Insert Sản phẩm
    INSERT INTO public.products (
        name, sku, barcode, active_ingredient, image_url,
        category_name, manufacturer_name, distributor_id, status,
        invoice_price, actual_cost, wholesale_unit, retail_unit, conversion_factor,
        wholesale_margin_value, wholesale_margin_type, retail_margin_value, retail_margin_type,
        items_per_carton -- <-- CẬP NHẬT
    )
    VALUES (
        p_name, p_sku, p_barcode, p_active_ingredient, p_image_url,
        p_category_name, p_manufacturer_name, p_distributor_id, p_status,
        p_invoice_price, p_actual_cost, p_wholesale_unit, p_retail_unit, p_conversion_factor,
        p_wholesale_margin_value, p_wholesale_margin_type, p_retail_margin_value, p_retail_margin_type,
        COALESCE(p_items_per_carton, 1) -- Mặc định là 1
    )
    RETURNING id INTO v_product_id;

    -- Insert Tồn kho Min/Max
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

    RETURN v_product_id;
END;
$$;


ALTER FUNCTION "public"."create_product"("p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_items_per_carton" integer, "p_inventory_settings" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_product"("p_name" "text" DEFAULT NULL::"text", "p_sku" "text" DEFAULT NULL::"text", "p_barcode" "text" DEFAULT NULL::"text", "p_active_ingredient" "text" DEFAULT NULL::"text", "p_image_url" "text" DEFAULT NULL::"text", "p_category_name" "text" DEFAULT NULL::"text", "p_manufacturer_name" "text" DEFAULT NULL::"text", "p_distributor_id" bigint DEFAULT NULL::bigint, "p_status" "text" DEFAULT 'active'::"text", "p_invoice_price" numeric DEFAULT 0, "p_actual_cost" numeric DEFAULT 0, "p_wholesale_unit" "text" DEFAULT 'Hộp'::"text", "p_retail_unit" "text" DEFAULT 'Vỉ'::"text", "p_conversion_factor" integer DEFAULT 1, "p_wholesale_margin_value" numeric DEFAULT 0, "p_wholesale_margin_type" "text" DEFAULT '%'::"text", "p_retail_margin_value" numeric DEFAULT 0, "p_retail_margin_type" "text" DEFAULT '%'::"text", "p_items_per_carton" integer DEFAULT 1, "p_carton_weight" numeric DEFAULT 0, "p_carton_dimensions" "text" DEFAULT NULL::"text", "p_purchasing_policy" "text" DEFAULT 'ALLOW_LOOSE'::"text", "p_inventory_settings" "jsonb" DEFAULT '{}'::"jsonb") RETURNS bigint
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."create_product"("p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_items_per_carton" integer, "p_carton_weight" numeric, "p_carton_dimensions" "text", "p_purchasing_policy" "text", "p_inventory_settings" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_product"("p_name" "text" DEFAULT NULL::"text", "p_sku" "text" DEFAULT NULL::"text", "p_barcode" "text" DEFAULT NULL::"text", "p_active_ingredient" "text" DEFAULT NULL::"text", "p_image_url" "text" DEFAULT NULL::"text", "p_category_name" "text" DEFAULT NULL::"text", "p_manufacturer_name" "text" DEFAULT NULL::"text", "p_distributor_id" bigint DEFAULT NULL::bigint, "p_status" "text" DEFAULT 'active'::"text", "p_invoice_price" numeric DEFAULT 0, "p_actual_cost" numeric DEFAULT 0, "p_wholesale_unit" "text" DEFAULT 'Hộp'::"text", "p_retail_unit" "text" DEFAULT 'Vỉ'::"text", "p_conversion_factor" integer DEFAULT 1, "p_wholesale_margin_value" numeric DEFAULT 0, "p_wholesale_margin_type" "text" DEFAULT '%'::"text", "p_retail_margin_value" numeric DEFAULT 0, "p_retail_margin_type" "text" DEFAULT '%'::"text", "p_items_per_carton" integer DEFAULT 1, "p_carton_weight" numeric DEFAULT 0, "p_carton_dimensions" "text" DEFAULT NULL::"text", "p_purchasing_policy" "text" DEFAULT 'ALLOW_LOOSE'::"text", "p_inventory_settings" "jsonb" DEFAULT '{}'::"jsonb", "p_description" "text" DEFAULT NULL::"text", "p_registration_number" "text" DEFAULT NULL::"text", "p_packing_spec" "text" DEFAULT NULL::"text") RETURNS bigint
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."create_product"("p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_items_per_carton" integer, "p_carton_weight" numeric, "p_carton_dimensions" "text", "p_purchasing_policy" "text", "p_inventory_settings" "jsonb", "p_description" "text", "p_registration_number" "text", "p_packing_spec" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_purchase_order"("p_supplier_id" bigint, "p_expected_date" timestamp with time zone, "p_note" "text", "p_delivery_method" "text", "p_shipping_partner_id" bigint, "p_shipping_fee" numeric, "p_items" "jsonb", "p_status" "text" DEFAULT 'DRAFT'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_po_id BIGINT;
    v_po_code TEXT;
    v_item JSONB;
    v_total_amount NUMERIC := 0;
    
    -- Biến xử lý item
    v_qty_ordered INT;
    v_unit_price NUMERIC;
    v_is_bonus BOOLEAN;
    v_product_record RECORD;
    v_conversion_factor INT;
    v_base_qty INT;
BEGIN
    -- Sinh mã phiếu
    v_po_code := 'PO-' || to_char(NOW(), 'YYMM') || '-' || upper(substring(md5(random()::text) from 1 for 4));

    -- Insert Header
    INSERT INTO public.purchase_orders (
        code, supplier_id, expected_delivery_date, note, delivery_method, 
        shipping_partner_id, shipping_fee, status, 
        delivery_status, payment_status, creator_id, created_at, updated_at
    ) VALUES (
        v_po_code, p_supplier_id, p_expected_date, p_note, p_delivery_method, 
        p_shipping_partner_id, COALESCE(p_shipping_fee, 0), p_status, 
        'pending', 'unpaid', auth.uid(), NOW(), NOW()
    ) RETURNING id INTO v_po_id;

    -- Insert Items
    IF p_items IS NOT NULL THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_qty_ordered := COALESCE((v_item->>'quantity')::INT, (v_item->>'quantity_ordered')::INT, 0);
            v_is_bonus := COALESCE((v_item->>'is_bonus')::BOOLEAN, false);
            
            IF v_is_bonus THEN
                v_unit_price := 0;
            ELSE
                v_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, 0);
            END IF;

            IF v_qty_ordered > 0 THEN
                -- Lấy quy đổi
                SELECT items_per_carton, wholesale_unit INTO v_product_record
                FROM public.products WHERE id = (v_item->>'product_id')::BIGINT;

                IF (v_item->>'unit') = v_product_record.wholesale_unit THEN
                    v_conversion_factor := COALESCE(v_product_record.items_per_carton, 1);
                ELSE
                    v_conversion_factor := 1;
                END IF;
                v_base_qty := v_qty_ordered * v_conversion_factor;

                -- Insert Item (Đầy đủ cột mới)
                INSERT INTO public.purchase_order_items (
                    po_id, product_id, quantity_ordered, uom_ordered, unit, 
                    unit_price, is_bonus, conversion_factor, base_quantity
                ) VALUES (
                    v_po_id, (v_item->>'product_id')::BIGINT, v_qty_ordered, 
                    (v_item->>'unit')::TEXT, (v_item->>'unit')::TEXT, 
                    v_unit_price, v_is_bonus, v_conversion_factor, v_base_qty
                );
                
                v_total_amount := v_total_amount + (v_qty_ordered * v_unit_price);
            END IF;
        END LOOP;
    END IF;

    -- Update Total
    UPDATE public.purchase_orders 
    SET total_amount = v_total_amount,
        final_amount = v_total_amount + COALESCE(p_shipping_fee, 0)
    WHERE id = v_po_id;

    RETURN jsonb_build_object('id', v_po_id, 'code', v_po_code, 'message', 'Tạo đơn thành công');
END;
$$;


ALTER FUNCTION "public"."create_purchase_order"("p_supplier_id" bigint, "p_expected_date" timestamp with time zone, "p_note" "text", "p_delivery_method" "text", "p_shipping_partner_id" bigint, "p_shipping_fee" numeric, "p_items" "jsonb", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_sales_order"("p_customer_b2b_id" bigint DEFAULT NULL::bigint, "p_customer_b2c_id" bigint DEFAULT NULL::bigint, "p_discount_amount" numeric DEFAULT 0, "p_items" "jsonb" DEFAULT '[]'::"jsonb", "p_order_type" "text" DEFAULT 'POS'::"text", "p_payment_method" "text" DEFAULT 'cash'::"text", "p_shipping_fee" numeric DEFAULT 0, "p_status" "text" DEFAULT 'COMPLETED'::"text", "p_warehouse_id" bigint DEFAULT 1, "p_note" "text" DEFAULT NULL::"text", "p_delivery_address" "text" DEFAULT NULL::"text", "p_delivery_time" "text" DEFAULT NULL::"text", "p_shipping_partner_id" bigint DEFAULT NULL::bigint, "p_delivery_method" "text" DEFAULT 'internal'::"text", "p_customer_id" bigint DEFAULT NULL::bigint) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_order_id UUID;
    v_code TEXT;
    v_item JSONB;
    v_total_amount NUMERIC := 0;
    v_final_amount NUMERIC := 0;
    v_unit_price NUMERIC;
    v_quantity NUMERIC;
    v_discount NUMERIC;
    v_conversion_factor INTEGER;
    v_prefix TEXT;
    
    -- Biến xử lý ID khách hàng cuối cùng
    v_final_b2b_id BIGINT;
    
    -- Biến tích điểm
    v_loyalty_points_earned INT := 0;
BEGIN
    -- 1. Validation & Setup
    IF p_warehouse_id IS NULL THEN RAISE EXCEPTION 'Bắt buộc phải chọn Kho xuất hàng.'; END IF;

    -- Map ID cũ sang mới (Ưu tiên tham số mới, fallback về tham số cũ)
    v_final_b2b_id := COALESCE(p_customer_b2b_id, p_customer_id);

    -- Sinh mã đơn
    IF p_order_type = 'POS' THEN v_prefix := 'POS-'; ELSE v_prefix := 'SO-'; END IF;
    v_code := v_prefix || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- 2. Insert Header
    INSERT INTO public.orders (
        code, 
        customer_id,        -- Cột B2B trong DB
        customer_b2c_id,    -- Cột B2C trong DB
        creator_id, 
        status, 
        order_type, 
        payment_method, 
        remittance_status, 
        delivery_address, delivery_time, note,
        discount_amount, shipping_fee, shipping_partner_id, delivery_method, warehouse_id,
        total_amount, final_amount, paid_amount, payment_status, created_at, updated_at
    ) VALUES (
        v_code, 
        v_final_b2b_id, 
        p_customer_b2c_id, 
        auth.uid(), 
        p_status, 
        p_order_type,
        p_payment_method, 
        -- Logic nộp tiền: Tiền mặt -> Pending (Chờ nộp), Khác -> Skipped
        CASE WHEN p_payment_method = 'cash' THEN 'pending' ELSE 'skipped' END,
        COALESCE(p_delivery_address, ''), p_delivery_time, p_note,
        p_discount_amount, p_shipping_fee, p_shipping_partner_id, p_delivery_method, p_warehouse_id,
        0, 0, -- Tạm tính 0
        0, 'unpaid', NOW(), NOW()
    ) RETURNING id INTO v_order_id;

    -- 3. Insert Items & Tính tiền
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_quantity := (v_item->>'quantity')::NUMERIC;
        v_unit_price := (v_item->>'unit_price')::NUMERIC;
        v_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);
        
        -- Logic tìm tỷ lệ quy đổi (Ưu tiên JSON -> DB)
        v_conversion_factor := COALESCE((v_item->>'conversion_factor')::INTEGER, 0);
        IF v_conversion_factor = 0 THEN
             SELECT conversion_rate INTO v_conversion_factor
             FROM public.product_units 
             WHERE product_id = (v_item->>'product_id')::BIGINT AND unit_name = (v_item->>'uom')
             LIMIT 1;
             v_conversion_factor := COALESCE(v_conversion_factor, 1);
        END IF;

        INSERT INTO public.order_items (
            order_id, product_id, quantity, uom, conversion_factor, 
            unit_price, discount, is_gift, note
        ) VALUES (
            v_order_id, 
            (v_item->>'product_id')::BIGINT, 
            v_quantity, 
            v_item->>'uom', 
            v_conversion_factor, 
            v_unit_price, 
            v_discount, 
            COALESCE((v_item->>'is_gift')::BOOLEAN, false), 
            v_item->>'note'
        );

        v_total_amount := v_total_amount + ((v_quantity * v_unit_price) - v_discount);
    END LOOP;

    -- 4. Update Tổng tiền
    v_final_amount := v_total_amount - p_discount_amount + p_shipping_fee;
    IF v_final_amount < 0 THEN v_final_amount := 0; END IF;

    UPDATE public.orders 
    SET total_amount = v_total_amount,
        final_amount = v_final_amount,
        -- Nếu POS Hoàn tất & Không nợ -> Đánh dấu đã trả đủ
        paid_amount = CASE WHEN p_status = 'COMPLETED' AND p_payment_method != 'debt' THEN v_final_amount ELSE 0 END,
        payment_status = CASE WHEN p_status = 'COMPLETED' AND p_payment_method != 'debt' THEN 'paid' ELSE 'unpaid' END
    WHERE id = v_order_id;

    -- 5. [CORE NEW]: Tính điểm thưởng (100k = 1 điểm)
    v_loyalty_points_earned := FLOOR(v_final_amount / 100000); 

    IF p_status = 'COMPLETED' AND v_loyalty_points_earned > 0 THEN
        IF p_customer_b2c_id IS NOT NULL THEN
            UPDATE public.customers 
            SET loyalty_points = COALESCE(loyalty_points, 0) + v_loyalty_points_earned, updated_at = NOW()
            WHERE id = p_customer_b2c_id;
        ELSIF v_final_b2b_id IS NOT NULL THEN
            UPDATE public.customers_b2b 
            SET loyalty_points = COALESCE(loyalty_points, 0) + v_loyalty_points_earned, updated_at = NOW()
            WHERE id = v_final_b2b_id;
        END IF;
    END IF;

    RETURN v_order_id;
END;
$$;


ALTER FUNCTION "public"."create_sales_order"("p_customer_b2b_id" bigint, "p_customer_b2c_id" bigint, "p_discount_amount" numeric, "p_items" "jsonb", "p_order_type" "text", "p_payment_method" "text", "p_shipping_fee" numeric, "p_status" "text", "p_warehouse_id" bigint, "p_note" "text", "p_delivery_address" "text", "p_delivery_time" "text", "p_shipping_partner_id" bigint, "p_delivery_method" "text", "p_customer_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_service_package"("p_data" "jsonb", "p_items" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_package_id BIGINT;
  v_calculated_cost NUMERIC;
  v_item JSONB;
BEGIN
  -- 1. Gọi "Cỗ máy #1" để tính giá vốn thực tế
  v_calculated_cost := public.calculate_package_cost(p_items);

  -- 2. Thêm vào bảng chính (service_packages)
  INSERT INTO public.service_packages (
    name, sku, unit, type,
    price, total_cost_price, -- Dùng giá vốn đã tính
    revenue_account_id,
    valid_from, valid_to, status,
    validity_days,
    applicable_branches,
    applicable_channels
  )
  VALUES (
    p_data->>'name',
    p_data->>'sku',
    p_data->>'unit',
    (p_data->>'type')::public.service_package_type,
    (p_data->>'price')::NUMERIC,
    v_calculated_cost, -- Dùng giá vốn đã tính
    p_data->>'revenueAccountId',
    (p_data->>'validFrom')::DATE,
    (p_data->>'validTo')::DATE,
    (p_data->>'status')::public.account_status,
    (p_data->>'validityDays')::INT,
    (SELECT array_agg(value::BIGINT) FROM jsonb_array_elements_text(p_data->'applicableBranches') AS t(value)),
    p_data->>'applicableChannels'
  )
  RETURNING id INTO v_package_id;

  -- 3. Loop qua mảng items và thêm vào bảng con (service_package_items)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.service_package_items (
      package_id,
      item_id,
      quantity,
      item_type,
      schedule_days
    )
    VALUES (
      v_package_id,
      (v_item->>'item_id')::BIGINT,
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'item_type')::TEXT,
      (v_item->>'schedule_days')::INT
    );
  END LOOP;
  
  RETURN v_package_id;
END;
$$;


ALTER FUNCTION "public"."create_service_package"("p_data" "jsonb", "p_items" "jsonb") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."create_supplier"("p_name" "text", "p_tax_code" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_address" "text", "p_payment_term" "text", "p_bank_account" "text", "p_bank_name" "text", "p_bank_holder" "text", "p_delivery_method" "text", "p_lead_time" integer, "p_status" "text", "p_notes" "text") RETURNS bigint
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_supplier_id BIGINT;
    v_bank_bin TEXT;
BEGIN
    -- LOGIC TỰ ĐỘNG TÌM BIN NGÂN HÀNG
    -- Tìm theo tên đầy đủ HOẶC tên viết tắt (short_name)
    IF p_bank_name IS NOT NULL AND p_bank_name <> '' THEN
        SELECT bin INTO v_bank_bin 
        FROM public.banks 
        WHERE name ILIKE p_bank_name 
           OR short_name ILIKE p_bank_name 
           OR code ILIKE p_bank_name
        LIMIT 1;
    END IF;

    -- Insert với bank_bin tự động
    INSERT INTO public.suppliers (
        name, tax_code, contact_person, phone, email, address, 
        payment_term, bank_account, bank_name, bank_holder, delivery_method, lead_time,
        status, notes, 
        bank_bin -- Cột mới
    )
    VALUES (
        p_name, p_tax_code, p_contact_person, p_phone, p_email, p_address, 
        p_payment_term, p_bank_account, p_bank_name, p_bank_holder, p_delivery_method, p_lead_time,
        p_status, p_notes,
        v_bank_bin -- Giá trị tự động tìm được
    )
    RETURNING id INTO v_supplier_id;
    
    RETURN v_supplier_id;
END;
$$;


ALTER FUNCTION "public"."create_supplier"("p_name" "text", "p_tax_code" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_address" "text", "p_payment_term" "text", "p_bank_account" "text", "p_bank_name" "text", "p_bank_holder" "text", "p_delivery_method" "text", "p_lead_time" integer, "p_status" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_vaccination_template"("p_data" "jsonb", "p_items" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_new_id BIGINT;
    v_item JSONB;
BEGIN
    INSERT INTO public.vaccination_templates (name, description, min_age_months, max_age_months, status)
    VALUES (
        p_data->>'name',
        p_data->>'description',
        (p_data->>'min_age_months')::INTEGER,
        (p_data->>'max_age_months')::INTEGER,
        COALESCE(p_data->>'status', 'active')
    )
    RETURNING id INTO v_new_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.vaccination_template_items (template_id, product_id, shot_name, days_after_start, note)
        VALUES (
            v_new_id,
            (v_item->>'product_id')::BIGINT,
            v_item->>'shot_name',
            COALESCE((v_item->>'days_after_start')::INTEGER, 0),
            v_item->>'note'
        );
    END LOOP;

    RETURN v_new_id;
END;
$$;


ALTER FUNCTION "public"."create_vaccination_template"("p_data" "jsonb", "p_items" "jsonb") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."delete_prescription_template"("p_id" bigint) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    DELETE FROM public.prescription_template_items WHERE template_id = p_id;
    DELETE FROM public.prescription_templates WHERE id = p_id;
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."delete_prescription_template"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_products"("p_ids" bigint[]) RETURNS "void"
    LANGUAGE "sql"
    AS $$
    DELETE FROM public.products
    WHERE id = ANY(p_ids);
$$;


ALTER FUNCTION "public"."delete_products"("p_ids" bigint[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_purchase_order"("p_id" bigint) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT delivery_status INTO v_status FROM public.purchase_orders WHERE id = p_id;
    IF v_status <> 'pending' THEN
        RAISE EXCEPTION 'Không thể xóa Đơn hàng đã có dữ liệu nhập kho.';
    END IF;
    
    DELETE FROM public.purchase_orders WHERE id = p_id;
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."delete_purchase_order"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_service_packages"("p_ids" bigint[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    BEGIN
        -- Cập nhật trạng thái sang 'deleted' cho các ID nằm trong danh sách
        UPDATE public.service_packages
        SET 
            status = 'deleted',
            updated_at = NOW()
        WHERE id = ANY(p_ids);
        
        -- (Optional) Có thể xóa mềm luôn các items con trong service_package_items nếu cần,
        -- nhưng thường giữ nguyên để truy vết lịch sử gói lúc xóa gồm những gì.
    END;
    $$;


ALTER FUNCTION "public"."delete_service_packages"("p_ids" bigint[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_service_packages"("p_ids" bigint[]) IS 'Xóa mềm gói dịch vụ (Chuyển status sang deleted)';



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


CREATE OR REPLACE FUNCTION "public"."delete_vaccination_template"("p_id" bigint) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    DELETE FROM public.vaccination_templates WHERE id = p_id;
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."delete_vaccination_template"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."distribute_voucher_to_segment"("p_promotion_id" "uuid", "p_segment_id" bigint) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
        v_count INT;
        v_promo_code TEXT;
    BEGIN
        -- 1. Lấy mã hiển thị (code) từ bảng gốc
        SELECT code INTO v_promo_code FROM public.promotions WHERE id = p_promotion_id;
        
        IF v_promo_code IS NULL THEN
            RAISE EXCEPTION 'Không tìm thấy chương trình khuyến mãi ID %', p_promotion_id;
        END IF;

        -- 2. Thực hiện phát tặng (Insert Bulk)
        WITH inserted AS (
            INSERT INTO public.customer_vouchers (customer_id, promotion_id, code, status, usage_remaining)
            SELECT 
                m.customer_id, 
                p_promotion_id, 
                v_promo_code, 
                'active',
                1 -- Tặng 1 vé
            FROM public.customer_segment_members m
            WHERE m.segment_id = p_segment_id
            -- Điều kiện loại trừ: Không tặng nếu khách đã có voucher này rồi (tránh spam)
            AND NOT EXISTS (
                SELECT 1 FROM public.customer_vouchers cv 
                WHERE cv.customer_id = m.customer_id 
                AND cv.promotion_id = p_promotion_id
            )
            RETURNING id
        )
        SELECT COUNT(*) INTO v_count FROM inserted;

        -- 3. Ghi nhận vào bảng Target (để UI hiển thị là nhóm này đã được chọn)
        INSERT INTO public.promotion_targets (promotion_id, target_type, target_id)
        VALUES (p_promotion_id, 'segment', p_segment_id)
        ON CONFLICT DO NOTHING;

        RETURN v_count;
    END;
    $$;


ALTER FUNCTION "public"."distribute_voucher_to_segment"("p_promotion_id" "uuid", "p_segment_id" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."distribute_voucher_to_segment"("p_promotion_id" "uuid", "p_segment_id" bigint) IS 'Engine phát voucher hàng loạt cho thành viên thuộc phân khúc';



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


CREATE OR REPLACE FUNCTION "public"."get_active_shipping_partners"() RETURNS TABLE("id" bigint, "name" "text", "phone" "text", "contact_person" "text", "speed_hours" integer, "base_fee" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        id, name, phone, contact_person, 
        -- Lấy tốc độ trung bình của vùng đầu tiên làm chuẩn (hoặc logic phức tạp hơn tùy sau này)
        COALESCE((SELECT speed_hours FROM public.shipping_rules sr WHERE sr.partner_id = sp.id LIMIT 1), 24) as speed_hours,
        COALESCE((SELECT fee FROM public.shipping_rules sr WHERE sr.partner_id = sp.id LIMIT 1), 0) as base_fee
    FROM public.shipping_partners sp
    WHERE status = 'active';
END;
$$;


ALTER FUNCTION "public"."get_active_shipping_partners"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_warehouses"() RETURNS TABLE("id" bigint, "name" "text", "latitude" numeric, "longitude" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
        SELECT 
            id, 
            name, 
            latitude, 
            longitude
        FROM public.warehouses 
        WHERE status = 'active'
        ORDER BY name ASC;
    $$;


ALTER FUNCTION "public"."get_active_warehouses"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_active_warehouses"() IS 'Lấy danh sách kho active kèm tọa độ GPS (cho POS auto-select)';



CREATE OR REPLACE FUNCTION "public"."get_applicable_vouchers"("p_customer_id" bigint, "p_order_total" numeric) RETURNS TABLE("id" "uuid", "code" "text", "description" "text", "discount_value" numeric, "discount_type" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id, p.code, p.name as description, p.discount_value, p.discount_type
    FROM public.promotions p
    WHERE 
        p.status = 'active'
        AND now() BETWEEN p.valid_from AND p.valid_to
        AND p.min_order_value <= p_order_total
        AND (
            p.apply_to_scope = 'all' 
            OR (p.apply_to_scope = 'personal' AND p.customer_id = p_customer_id)
        )
    ORDER BY p.discount_value DESC;
END;
$$;


ALTER FUNCTION "public"."get_applicable_vouchers"("p_customer_id" bigint, "p_order_total" numeric) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."get_available_vat_rates_for_product"("p_product_id" bigint) RETURNS TABLE("vat_rate" numeric, "quantity_base" numeric, "unit_base" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.vat_rate,
        l.quantity_balance,
        p.retail_unit -- Lấy tên đơn vị lẻ để hiển thị
    FROM public.vat_inventory_ledger l
    JOIN public.products p ON l.product_id = p.id
    WHERE l.product_id = p_product_id AND l.quantity_balance > 0
    ORDER BY l.vat_rate DESC;
END;
$$;


ALTER FUNCTION "public"."get_available_vat_rates_for_product"("p_product_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_available_vouchers"("p_customer_id" bigint, "p_order_total" numeric) RETURNS TABLE("id" "uuid", "code" "text", "name" "text", "description" "text", "discount_type" "text", "discount_value" numeric, "max_discount_value" numeric, "min_order_value" numeric, "valid_to" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id, p.code, p.name, p.description, 
        p.discount_type, p.discount_value, p.max_discount_value, 
        p.min_order_value, p.valid_to
    FROM public.promotions p
    WHERE 
        p.status = 'active'
        AND now() BETWEEN p.valid_from AND p.valid_to
        AND p_order_total >= p.min_order_value
        -- Kiểm tra giới hạn tổng
        AND (p.total_usage_limit IS NULL OR p.usage_count < p.total_usage_limit)
        -- Kiểm tra phạm vi áp dụng (Scope)
        AND (
            p.apply_to_scope = 'all' 
            OR (p.apply_to_scope = 'personal' AND p.customer_id = p_customer_id)
        )
        -- Kiểm tra giới hạn từng người (Subquery)
        AND (
            p.usage_limit_per_user IS NULL 
            OR (
                SELECT COUNT(*) 
                FROM public.promotion_usages pu 
                WHERE pu.promotion_id = p.id AND pu.customer_id = p_customer_id
            ) < p.usage_limit_per_user
        )
    ORDER BY p.discount_value DESC; -- Ưu tiên giảm giá cao nhất
END;
$$;


ALTER FUNCTION "public"."get_available_vouchers"("p_customer_id" bigint, "p_order_total" numeric) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."get_customer_debt_info"("p_customer_id" bigint) RETURNS TABLE("customer_id" bigint, "customer_name" "text", "debt_limit" numeric, "current_debt" numeric, "available_credit" numeric, "is_bad_debt" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_limit NUMERIC;
    v_debt NUMERIC;
    v_name TEXT;
BEGIN
    -- Lấy thông tin hạn mức
    SELECT name, debt_limit INTO v_name, v_limit 
    FROM public.customers_b2b 
    WHERE id = p_customer_id;

    IF v_name IS NULL THEN RETURN; END IF; -- Không tìm thấy khách

    -- Tính nợ hiện tại: Tổng (Final Amount - Paid Amount) của các đơn chưa hoàn tất thanh toán
    -- Loại trừ đơn Đã hủy (CANCELLED) và Đơn Nháp (DRAFT - chưa chốt nợ)
    SELECT COALESCE(SUM(final_amount - paid_amount), 0)
    INTO v_debt
    FROM public.orders
    WHERE customer_id = p_customer_id
      AND status NOT IN ('DRAFT', 'CANCELLED') -- Chỉ tính nợ các đơn đã chốt
      AND payment_status != 'paid';            -- Chưa thanh toán hết

    -- Trả về kết quả
    RETURN QUERY SELECT 
        p_customer_id,
        v_name,
        COALESCE(v_limit, 0),
        v_debt,
        (COALESCE(v_limit, 0) - v_debt),
        (v_debt > COALESCE(v_limit, 0));
END;
$$;


ALTER FUNCTION "public"."get_customer_debt_info"("p_customer_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_customers_b2b_list"("search_query" "text", "sales_staff_filter" "uuid", "status_filter" "text", "page_num" integer, "page_size" integer, "sort_by_debt" "text" DEFAULT NULL::"text") RETURNS TABLE("key" "text", "id" bigint, "customer_code" "text", "name" "text", "phone" "text", "sales_staff_name" "text", "debt_limit" numeric, "status" "public"."account_status", "current_debt" numeric, "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    BEGIN
        RETURN QUERY
        WITH debt_calc AS (
            -- Tính nợ B2B: Dựa trên customer_id
            SELECT 
                o.customer_id,
                SUM(o.final_amount - COALESCE(o.paid_amount, 0)) as debt
            FROM public.orders o
            WHERE o.payment_status != 'paid' 
              AND o.status NOT IN ('DRAFT', 'QUOTE', 'QUOTE_EXPIRED', 'CANCELLED')
              AND o.customer_id IS NOT NULL -- Chỉ tính đơn B2B
            GROUP BY o.customer_id
        ),
        filtered_customers AS (
            SELECT 
                c.id, 
                c.customer_code, 
                c.name, 
                c.phone, 
                -- Lấy tên nhân viên sales từ bảng users (auth + public users)
                -- Lưu ý: c.sales_staff_id là UUID, join với public.users.id hoặc auth.users.id đều được
                -- Ở đây ta ưu tiên lấy từ public.users (vì có full_name chuẩn)
                COALESCE(u.full_name, 'Chưa phân công') as sales_staff_name,
                c.debt_limit, 
                c.status,
                COALESCE(d.debt, 0) as current_debt
            FROM public.customers_b2b c
            LEFT JOIN public.users u ON c.sales_staff_id = u.id
            LEFT JOIN debt_calc d ON c.id = d.customer_id
            WHERE 
                (search_query IS NULL OR search_query = '' OR 
                    c.name ILIKE ('%' || search_query || '%') OR 
                    c.customer_code ILIKE ('%' || search_query || '%') OR
                    c.phone ILIKE ('%' || search_query || '%') OR
                    c.tax_code ILIKE ('%' || search_query || '%')
                )
                AND (sales_staff_filter IS NULL OR c.sales_staff_id = sales_staff_filter)
                AND (status_filter IS NULL OR c.status = status_filter::public.account_status)
        )
        SELECT 
            fc.id::TEXT as key, -- Cast sang Text cho Frontend
            fc.id,
            fc.customer_code,
            fc.name,
            fc.phone,
            fc.sales_staff_name,
            fc.debt_limit,
            fc.status,
            fc.current_debt,
            (COUNT(*) OVER())::bigint as total_count
        FROM filtered_customers fc
        ORDER BY 
            -- Logic Sắp xếp theo Nợ
            CASE WHEN sort_by_debt = 'desc' THEN fc.current_debt END DESC NULLS LAST,
            CASE WHEN sort_by_debt = 'asc' THEN fc.current_debt END ASC NULLS LAST,
            -- Default sort
            fc.id DESC
        LIMIT page_size OFFSET (page_num - 1) * page_size;
    END;
    $$;


ALTER FUNCTION "public"."get_customers_b2b_list"("search_query" "text", "sales_staff_filter" "uuid", "status_filter" "text", "page_num" integer, "page_size" integer, "sort_by_debt" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_customers_b2b_list"("search_query" "text", "sales_staff_filter" "uuid", "status_filter" "text", "page_num" integer, "page_size" integer, "sort_by_debt" "text") IS 'V2: Get Customers B2B List with Debt Calculation';



CREATE OR REPLACE FUNCTION "public"."get_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text", "page_num" integer, "page_size" integer, "sort_by_debt" "text" DEFAULT NULL::"text") RETURNS TABLE("key" "text", "id" bigint, "customer_code" "text", "name" "text", "type" "public"."customer_b2c_type", "phone" "text", "loyalty_points" integer, "status" "public"."account_status", "avatar_url" "text", "current_debt" numeric, "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    BEGIN
        RETURN QUERY
        WITH debt_calc AS (
            -- Tính công nợ (Chỉ tính các đơn hàng có hiệu lực chưa thanh toán)
            SELECT 
                o.customer_b2c_id,
                SUM(o.final_amount - COALESCE(o.paid_amount, 0)) as debt
            FROM public.orders o
            WHERE o.payment_status != 'paid' 
              AND o.status NOT IN ('DRAFT', 'QUOTE', 'QUOTE_EXPIRED', 'CANCELLED')
            GROUP BY o.customer_b2c_id
        ),
        filtered_customers AS (
            SELECT 
                c.id, 
                c.customer_code, 
                c.name, 
                c.type,
                c.phone, 
                c.loyalty_points, 
                c.status,
                c.avatar_url,
                COALESCE(d.debt, 0) as current_debt
            FROM public.customers c
            LEFT JOIN debt_calc d ON c.id = d.customer_b2c_id
            WHERE 
                (status_filter IS NULL OR c.status = status_filter::public.account_status)
                AND (type_filter IS NULL OR c.type = type_filter::public.customer_b2c_type)
                AND (
                    search_query IS NULL OR search_query = '' OR 
                    
                    -- 1. Tìm theo tên, mã KH
                    c.name ILIKE ('%' || search_query || '%') OR 
                    c.customer_code ILIKE ('%' || search_query || '%') OR
                    
                    -- 2. Tìm SĐT (Cá nhân)
                    c.phone ILIKE ('%' || search_query || '%') OR
                    
                    -- 3. Tìm SĐT (Người liên hệ của Tổ chức) - Nâng cấp
                    c.contact_person_phone ILIKE ('%' || search_query || '%') OR
                    
                    -- 4. [QUAN TRỌNG] Tìm SĐT (Người Giám hộ) - Giữ nguyên logic cũ
                    c.id IN (
                        SELECT cg.customer_id
                        FROM public.customer_guardians cg
                        JOIN public.customers guardian ON cg.guardian_id = guardian.id
                        WHERE guardian.phone ILIKE ('%' || search_query || '%')
                    )
                )
        )
        SELECT 
            fc.id::TEXT as key,
            fc.id,
            fc.customer_code,
            fc.name,
            fc.type,
            fc.phone,
            fc.loyalty_points,
            fc.status,
            fc.avatar_url,
            fc.current_debt,
            (COUNT(*) OVER())::bigint as total_count
        FROM filtered_customers fc
        ORDER BY 
            -- Ưu tiên sắp xếp theo Nợ nếu có yêu cầu
            CASE WHEN sort_by_debt = 'desc' THEN fc.current_debt END DESC NULLS LAST,
            CASE WHEN sort_by_debt = 'asc' THEN fc.current_debt END ASC NULLS LAST,
            -- Mặc định: Mới nhất lên đầu
            fc.id DESC
        LIMIT page_size OFFSET (page_num - 1) * page_size;
    END;
    $$;


ALTER FUNCTION "public"."get_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text", "page_num" integer, "page_size" integer, "sort_by_debt" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text", "page_num" integer, "page_size" integer, "sort_by_debt" "text") IS 'V5: Safe Update - Giữ logic search cũ + Thêm tính Nợ/Sort';



CREATE OR REPLACE FUNCTION "public"."get_distinct_categories"() RETURNS TABLE("category_name" "text")
    LANGUAGE "sql"
    AS $$
  SELECT DISTINCT category_name 
  FROM public.products 
  WHERE category_name IS NOT NULL AND category_name <> ''
  ORDER BY category_name;
$$;


ALTER FUNCTION "public"."get_distinct_categories"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_distinct_manufacturers"() RETURNS TABLE("manufacturer_name" "text")
    LANGUAGE "sql"
    AS $$
  SELECT DISTINCT manufacturer_name 
  FROM public.products 
  WHERE manufacturer_name IS NOT NULL AND manufacturer_name <> ''
  ORDER BY manufacturer_name;
$$;


ALTER FUNCTION "public"."get_distinct_manufacturers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_inbound_detail"("p_po_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_po_info JSONB;
        v_items JSONB;
    BEGIN
        -- A. Header Info (Đã bổ sung Logistics)
        SELECT jsonb_build_object(
            'id', po.id,
            'code', po.code,
            'supplier_name', COALESCE(s.name, 'N/A'),
            'note', po.note,
            'status', po.delivery_status,
            'expected_date', po.expected_delivery_date,
            'expected_time', po.expected_delivery_time, -- New
            
            -- Logistics Group
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

        -- B. Items List (Giữ nguyên logic cũ)
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
                'quantity_remaining', GREATEST(0, poi.quantity_ordered - COALESCE(poi.quantity_received, 0))
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
    $$;


ALTER FUNCTION "public"."get_inbound_detail"("p_po_id" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_inbound_detail"("p_po_id" bigint) IS 'V1.1: Chi tiết nhập kho với thông tin Logistics';



CREATE OR REPLACE FUNCTION "public"."get_inventory_check_list"("p_warehouse_id" bigint) RETURNS TABLE("product_id" bigint, "product_name" "text", "sku" "text", "unit" "text", "batch_code" "text", "expiry_date" "date", "system_quantity" integer, "cost_price" numeric, "location_cabinet" "text", "location_row" "text", "location_slot" "text", "full_location" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    BEGIN
        RETURN QUERY
        SELECT 
            p.id as product_id,
            p.name as product_name,
            p.sku,
            p.retail_unit as unit, -- Kiểm kê thường theo đơn vị nhỏ nhất
            
            -- Thông tin Lô (Từ bảng Inventory Batches)
            b.batch_code,
            b.expiry_date,
            ib.quantity as system_quantity,
            
            -- Giá vốn (Snapshot)
            p.actual_cost as cost_price,
            
            -- Vị trí (Từ bảng Product Inventory - Tổng)
            inv.location_cabinet,
            inv.location_row,
            inv.location_slot,
            inv.shelf_location as full_location

        FROM public.inventory_batches ib
        JOIN public.products p ON ib.product_id = p.id
        JOIN public.batches b ON ib.batch_id = b.id
        -- Join sang bảng tổng để lấy vị trí xếp hàng
        JOIN public.product_inventory inv ON ib.product_id = inv.product_id AND ib.warehouse_id = inv.warehouse_id

        WHERE ib.warehouse_id = p_warehouse_id
          AND ib.quantity > 0 -- Chỉ kiểm những lô máy báo còn tồn (Lô âm hoặc = 0 xử lý riêng)
        
        -- SẮP XẾP TỐI ƯU CHO NGƯỜI ĐI KIỂM
        ORDER BY 
            COALESCE(inv.location_cabinet, 'ZZZ'), -- Chưa xếp đi cuối
            COALESCE(inv.location_row, 'ZZZ'),
            COALESCE(inv.location_slot, 'ZZZ'),
            p.name ASC;
    END;
    $$;


ALTER FUNCTION "public"."get_inventory_check_list"("p_warehouse_id" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_inventory_check_list"("p_warehouse_id" bigint) IS 'Lấy danh sách kiểm kê theo Lô, sắp xếp theo lộ trình đi trong kho';



CREATE OR REPLACE FUNCTION "public"."get_inventory_checks_list"("p_warehouse_id" bigint DEFAULT NULL::bigint, "p_search" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT NULL::"text", "p_start_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_end_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" bigint, "code" "text", "warehouse_name" "text", "status" "text", "created_at" timestamp with time zone, "completed_at" timestamp with time zone, "total_system_value" numeric, "total_actual_value" numeric, "total_diff_value" numeric, "created_by_name" "text", "verified_by_name" "text", "note" "text", "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_search_term TEXT;
    BEGIN
        -- Chuẩn hóa từ khóa tìm kiếm
        IF p_search IS NOT NULL AND p_search <> '' THEN
            v_search_term := '%' || p_search || '%';
        ELSE
            v_search_term := NULL;
        END IF;

        RETURN QUERY
        SELECT 
            ic.id,
            ic.code,
            w.name as warehouse_name,
            ic.status,
            ic.created_at,
            ic.completed_at,
            ic.total_system_value,
            ic.total_actual_value,
            ic.total_diff_value,
            
            -- Lấy tên hiển thị (Ưu tiên Fullname, fallback Email)
            COALESCE(u1.full_name, u1.email) as created_by_name,
            COALESCE(u2.full_name, u2.email) as verified_by_name,
            
            ic.note,
            
            -- Đếm tổng số dòng (Window Function - Tối ưu hiệu năng)
            COUNT(*) OVER() as total_count
            
        FROM public.inventory_checks ic
        JOIN public.warehouses w ON ic.warehouse_id = w.id
        LEFT JOIN public.users u1 ON ic.created_by = u1.id
        LEFT JOIN public.users u2 ON ic.verified_by = u2.id
        WHERE 
            -- 1. Lọc theo Kho
            (p_warehouse_id IS NULL OR ic.warehouse_id = p_warehouse_id)
            
            -- 2. Lọc theo Trạng thái
            AND (p_status IS NULL OR ic.status = p_status)
            
            -- 3. Lọc theo Khoảng ngày
            AND (p_start_date IS NULL OR ic.created_at >= p_start_date)
            AND (p_end_date IS NULL OR ic.created_at <= p_end_date)
            
            -- 4. Tìm kiếm nâng cao (Mã, Note, Người tạo, Người kiểm)
            AND (
                v_search_term IS NULL 
                OR ic.code ILIKE v_search_term
                OR ic.note ILIKE v_search_term
                OR u1.full_name ILIKE v_search_term
                OR u1.email ILIKE v_search_term
                OR u2.full_name ILIKE v_search_term
            )
            
        ORDER BY ic.created_at DESC
        LIMIT p_limit OFFSET p_offset;
    END;
    $$;


ALTER FUNCTION "public"."get_inventory_checks_list"("p_warehouse_id" bigint, "p_search" "text", "p_status" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_inventory_checks_list"("p_warehouse_id" bigint, "p_search" "text", "p_status" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer) IS 'Lấy danh sách phiếu kiểm kê (Full Filter & Search)';



CREATE OR REPLACE FUNCTION "public"."get_inventory_drift"("p_check_id" bigint) RETURNS TABLE("product_id" bigint, "product_name" "text", "batch_code" "text", "system_snapshot" integer, "current_live" integer, "diff" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_warehouse_id BIGINT;
    BEGIN
        SELECT warehouse_id INTO v_warehouse_id FROM public.inventory_checks WHERE id = p_check_id;

        RETURN QUERY
        SELECT 
            ici.product_id,
            p.name,
            ici.batch_code,
            ici.system_quantity as system_snapshot,
            COALESCE(ib.quantity, 0)::INTEGER as current_live,
            (COALESCE(ib.quantity, 0)::INTEGER - ici.system_quantity) as diff
        FROM public.inventory_check_items ici
        JOIN public.products p ON ici.product_id = p.id
        -- Join lại vào kho thật (inventory_batches) để lấy số hiện tại
        LEFT JOIN public.batches b ON ici.batch_code = b.batch_code AND b.product_id = ici.product_id
        LEFT JOIN public.inventory_batches ib ON ib.batch_id = b.id AND ib.warehouse_id = v_warehouse_id
        WHERE ici.check_id = p_check_id
        -- Chỉ lấy dòng có sự thay đổi
        AND (COALESCE(ib.quantity, 0) <> ici.system_quantity);
    END;
    $$;


ALTER FUNCTION "public"."get_inventory_drift"("p_check_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_mapped_product"("p_tax_code" "text", "p_product_name" "text", "p_vendor_unit" "text" DEFAULT NULL::"text") RETURNS TABLE("internal_product_id" bigint, "internal_unit" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    BEGIN
        RETURN QUERY
        SELECT m.internal_product_id, m.internal_unit
        FROM public.vendor_product_mappings m
        WHERE m.vendor_tax_code = p_tax_code 
          AND m.vendor_product_name = p_product_name
          -- Logic so sánh đơn vị:
          -- 1. Nếu input có đơn vị -> tìm match chính xác (case-insensitive)
          -- 2. Nếu input NULL -> chấp nhận tất cả (để Client tự xử lý hoặc lấy dòng mới nhất)
          AND (
              (p_vendor_unit IS NOT NULL AND LOWER(m.vendor_unit) = LOWER(p_vendor_unit))
              OR 
              (p_vendor_unit IS NULL)
          )
        ORDER BY m.last_used_at DESC -- Ưu tiên mapping mới dùng gần đây
        LIMIT 1; 
        
        -- Lưu ý: Hàm SELECT này không thực hiện UPDATE last_used_at để tối ưu performance đọc.
        -- Việc update usage nên tách ra 1 RPC khác hoặc thực hiện ở tầng application nếu cần thiết.
    END;
    $$;


ALTER FUNCTION "public"."get_mapped_product"("p_tax_code" "text", "p_product_name" "text", "p_vendor_unit" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_mapped_product"("p_tax_code" "text", "p_product_name" "text", "p_vendor_unit" "text") IS 'Lấy mapping sản phẩm có hỗ trợ đơn vị tính (Unit)';



CREATE OR REPLACE FUNCTION "public"."get_my_permissions"() RETURNS "text"[]
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
      SELECT COALESCE(array_agg(DISTINCT rp.permission_key), '{}')
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON ur.role_id = rp.role_id
      WHERE ur.user_id = auth.uid();
    $$;


ALTER FUNCTION "public"."get_my_permissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_outbound_order_detail"("p_order_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_order_info JSONB;
        v_items JSONB;
        v_warehouse_id BIGINT := 1; -- Vẫn giữ Hardcode Kho B2B Tổng cho V1
    BEGIN
        -- A. Lấy thông tin Header + Shipping Info (REAL DATA)
        SELECT jsonb_build_object(
            'id', o.id,
            'code', o.code,
            'customer_name', COALESCE(c.name, 'Khách lẻ'),
            'delivery_address', o.delivery_address,
            'note', o.note,
            'status', o.status,
            'shipping_partner', COALESCE(sp.name, 'Tự vận chuyển'),
            'shipping_phone', sp.phone,
            
            -- [UPDATE]: Lấy giờ cắt thực tế và format sang chuỗi 'HH:MM'
            -- Nếu null thì trả về null (Frontend tự xử lý hiển thị)
            'cutoff_time', TO_CHAR(sp.cut_off_time, 'HH24:MI') 
        ) INTO v_order_info
        FROM public.orders o
        LEFT JOIN public.customers_b2b c ON o.customer_id = c.id
        LEFT JOIN public.shipping_partners sp ON o.shipping_partner_id = sp.id
        WHERE o.id = p_order_id;

        -- Nếu không tìm thấy đơn
        IF v_order_info IS NULL THEN RETURN NULL; END IF;

        -- B. Lấy Items + FEFO Suggestion (Giữ nguyên logic V4)
        SELECT jsonb_agg(
            jsonb_build_object(
                'product_id', oi.product_id,
                'product_name', p.name,
                'sku', p.sku,
                'barcode', p.barcode,
                'unit', COALESCE(oi.uom, p.wholesale_unit, 'Hộp'),
                'quantity_ordered', oi.quantity,
                'quantity_picked', COALESCE(oi.quantity_picked, 0),
                'image_url', COALESCE(p.image_url, ''),
                
                -- Vị trí kệ
                'shelf_location', COALESCE((
                    SELECT pi.shelf_location 
                    FROM public.product_inventory pi 
                    WHERE pi.product_id = p.id AND pi.warehouse_id = v_warehouse_id 
                    LIMIT 1
                ), 'Chưa xếp'),

                -- FEFO Suggestion
                'fefo_suggestion', (
                    SELECT jsonb_build_object(
                        'batch_code', b.batch_code,
                        'expiry_date', b.expiry_date,
                        'quantity_available', ib.quantity
                    )
                    FROM public.inventory_batches ib
                    JOIN public.batches b ON ib.batch_id = b.id
                    WHERE ib.product_id = p.id 
                      AND ib.warehouse_id = v_warehouse_id
                      AND ib.quantity > 0 
                      AND b.expiry_date >= CURRENT_DATE 
                    ORDER BY b.expiry_date ASC 
                    LIMIT 1
                )
            )
        ) INTO v_items
        FROM public.order_items oi
        JOIN public.products p ON oi.product_id = p.id
        WHERE oi.order_id = p_order_id;

        RETURN jsonb_build_object(
            'order_info', v_order_info,
            'items', COALESCE(v_items, '[]'::jsonb)
        );
    END;
    $$;


ALTER FUNCTION "public"."get_outbound_order_detail"("p_order_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_outbound_order_detail"("p_order_id" "uuid") IS 'V4.1: Chi tiết đơn hàng + FEFO + Real Cut-off Time';



CREATE OR REPLACE FUNCTION "public"."get_outbound_stats"("p_warehouse_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_pending_packing INT;
        v_shipping INT;
        v_completed_today INT;
    BEGIN
        -- 1. Chờ đóng gói (CONFIRMED)
        SELECT COUNT(*) INTO v_pending_packing
        FROM public.orders
        WHERE status = 'CONFIRMED';

        -- 2. Đang giao hàng (SHIPPING)
        SELECT COUNT(*) INTO v_shipping
        FROM public.orders
        WHERE status = 'SHIPPING';

        -- 3. Hoàn thành hôm nay (DELIVERED & Updated hôm nay)
        SELECT COUNT(*) INTO v_completed_today
        FROM public.orders
        WHERE status = 'DELIVERED'
          AND updated_at >= date_trunc('day', now());

        RETURN jsonb_build_object(
            'pending_packing', v_pending_packing,
            'shipping', v_shipping,
            'completed_today', v_completed_today
        );
    END;
    $$;


ALTER FUNCTION "public"."get_outbound_stats"("p_warehouse_id" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_outbound_stats"("p_warehouse_id" bigint) IS 'Thống kê số lượng đơn xuất kho theo trạng thái';



CREATE OR REPLACE FUNCTION "public"."get_partner_debt_live"("p_partner_id" bigint, "p_partner_type" "text") RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_total_sales numeric := 0;
    v_total_paid_via_finance numeric := 0;
BEGIN
    -- 1. TÍNH TỔNG PHẢI THU
    -- Bao gồm cả đơn bán hàng bình thường VÀ đơn nợ ảo (status = COMPLETED, order_type = opening_debt)
    SELECT COALESCE(SUM(final_amount), 0)
    INTO v_total_sales
    FROM public.orders
    WHERE status IN ('CONFIRMED', 'PACKED', 'SHIPPING', 'DELIVERED', 'COMPLETED', 'PARTIAL')
    AND (
        (p_partner_type = 'customer' AND customer_b2c_id = p_partner_id)
        OR
        (p_partner_type = 'customer_b2b' AND customer_id = p_partner_id)
    );

    -- 2. TÍNH TỔNG ĐÃ THU (Qua phiếu thu)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid_via_finance
    FROM public.finance_transactions
    WHERE flow = 'in' AND status = 'completed'
    AND partner_id = p_partner_id::text
    AND partner_type = p_partner_type;

    -- 3. KẾT QUẢ: (Tổng phải thu - Tổng đã thu)
    RETURN v_total_sales - v_total_paid_via_finance;
END;
$$;


ALTER FUNCTION "public"."get_partner_debt_live"("p_partner_id" bigint, "p_partner_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_reconciliation_orders"() RETURNS TABLE("order_id" "uuid", "order_code" "text", "created_at" timestamp with time zone, "customer_code" "text", "customer_name" "text", "final_amount" numeric, "paid_amount" numeric, "remaining_amount" numeric, "payment_method" "text", "source" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id as order_id,
        o.code as order_code,
        o.created_at,
        
        -- Lấy mã khách hàng (Ưu tiên B2B -> B2C -> N/A)
        COALESCE(cb.customer_code, cc.customer_code, 'N/A') as customer_code,
        
        -- Lấy tên khách (Ưu tiên B2B -> B2C -> Khách lẻ)
        COALESCE(cb.name, cc.name, 'Khách lẻ') as customer_name,
        
        o.final_amount,
        COALESCE(o.paid_amount, 0) as paid_amount,
        (o.final_amount - COALESCE(o.paid_amount, 0)) as remaining_amount,
        
        COALESCE(o.payment_method, 'unknown') as payment_method,
        o.order_type as source
    FROM public.orders o
    LEFT JOIN public.customers_b2b cb ON o.customer_id = cb.id
    LEFT JOIN public.customers cc ON o.customer_b2c_id = cc.id
    WHERE 
        o.status NOT IN ('DRAFT', 'CANCELLED', 'QUOTE', 'QUOTE_EXPIRED') -- Loại bỏ các trạng thái rác
        AND o.payment_status != 'paid' -- Chỉ lấy đơn chưa trả hết
        -- Chỉ lấy các phương thức cần đối soát qua ngân hàng
        -- (Loại bỏ 'cash' hoặc các phương thức trả ngay tại quầy nếu có)
        AND (o.payment_method IN ('bank_transfer', 'debt', 'transfer') OR o.payment_method IS NULL)
    ORDER BY o.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_pending_reconciliation_orders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_po_logistics_stats"("p_search" "text" DEFAULT NULL::"text", "p_status_delivery" "text" DEFAULT NULL::"text", "p_status_payment" "text" DEFAULT NULL::"text", "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("method" "text", "total_cartons" bigint, "order_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    BEGIN
        RETURN QUERY
        SELECT 
            -- Group theo phương thức vận chuyển (nếu null thì gom vào 'other')
            COALESCE(po.delivery_method, 'other') AS method,
            
            -- Tính tổng số kiện (dựa trên cột real data total_packages)
            COALESCE(SUM(po.total_packages), 0)::BIGINT AS total_cartons,
            
            -- Đếm số đơn hàng
            COUNT(po.id)::BIGINT AS order_count

        FROM public.purchase_orders po
        LEFT JOIN public.suppliers s ON po.supplier_id = s.id
        WHERE 
            -- BỘ LỌC ĐỒNG BỘ VỚI DANH SÁCH MASTER (get_purchase_orders_master)
            (p_status_delivery IS NULL OR po.delivery_status = p_status_delivery)
            AND (p_status_payment IS NULL OR po.payment_status = p_status_payment)
            AND (p_date_from IS NULL OR po.created_at >= p_date_from)
            AND (p_date_to IS NULL OR po.created_at <= p_date_to)
            AND (
                p_search IS NULL OR p_search = '' 
                OR po.code ILIKE ('%' || p_search || '%')
                OR s.name ILIKE ('%' || p_search || '%')
            )
        GROUP BY po.delivery_method
        ORDER BY total_cartons DESC; -- Sắp xếp phương thức nào nhiều hàng lên trước
    END;
    $$;


ALTER FUNCTION "public"."get_po_logistics_stats"("p_search" "text", "p_status_delivery" "text", "p_status_payment" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_po_logistics_stats"("p_search" "text", "p_status_delivery" "text", "p_status_payment" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) IS 'Thống kê tổng số kiện hàng theo phương thức vận chuyển (dùng cho Dashboard Header)';



CREATE OR REPLACE FUNCTION "public"."get_pos_usable_promotions"("p_customer_id" bigint, "p_order_total" numeric DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_result JSONB;
    BEGIN
        SELECT jsonb_agg(t) INTO v_result
        FROM (
            SELECT * FROM (
                SELECT DISTINCT ON (p.id)
                    p.id, p.code, p.name, p.description,
                    p.discount_type, p.discount_value,
                    p.min_order_value, p.max_discount_value,
                    p.valid_to,
                    
                    -- Nguồn gốc (Badge)
                    CASE 
                        WHEN cv.id IS NOT NULL OR (p.type = 'personal' AND p.customer_id = p_customer_id) THEN 'personal' 
                        ELSE 'campaign' 
                    END as voucher_source,
                    
                    -- Trạng thái sở hữu
                    (cv.id IS NOT NULL OR (p.type = 'personal' AND p.customer_id = p_customer_id)) as is_owned,

                    -- [SHOPEE LOGIC 1] Check điều kiện (Boolean)
                    (p.min_order_value IS NULL OR p.min_order_value <= p_order_total) as is_eligible,
                    
                    -- [SHOPEE LOGIC 2] Tính tiền cần mua thêm (Upsell)
                    GREATEST(0, COALESCE(p.min_order_value, 0) - p_order_total) as missing_amount,

                    EXTRACT(DAY FROM (p.valid_to - NOW()))::INT as days_remaining

                FROM public.promotions p
                
                LEFT JOIN public.customer_vouchers cv 
                    ON p.id = cv.promotion_id 
                    AND cv.customer_id = p_customer_id 
                    AND cv.status = 'active'
                    AND (cv.usage_remaining IS NULL OR cv.usage_remaining > 0)
                
                LEFT JOIN public.promotion_targets pt 
                    ON p.id = pt.promotion_id
                
                LEFT JOIN public.customer_segment_members csm 
                    ON pt.target_type = 'segment' 
                    AND pt.target_id = csm.segment_id 
                    AND csm.customer_id = p_customer_id

                WHERE 
                    p.status = 'active'
                    AND p.valid_from <= now() 
                    AND p.valid_to >= now()
                    -- Chỉ lấy Voucher B2C (Hệ thống bán lẻ)
                    AND (p.customer_type = 'B2C' OR p.customer_type IS NULL)
                    
                    -- [THAY ĐỔI LỚN]: KHÔNG check min_order_value ở đây nữa
                    -- Để trả về cả voucher chưa đủ điều kiện cho Frontend hiển thị mờ
                    AND (
                        cv.id IS NOT NULL  
                        OR pt.id IS NOT NULL 
                        OR (p.type = 'public' AND p.apply_to_scope = 'all')
                        OR (p.type = 'personal' AND p.customer_id = p_customer_id AND (p.total_usage_limit IS NULL OR p.usage_count < p.total_usage_limit))
                    )
                
                ORDER BY p.id -- Bắt buộc của DISTINCT ON
            ) sub_query
            
            -- [SHOPEE LOGIC 3] Sắp xếp danh sách trả về
            ORDER BY 
                sub_query.is_eligible DESC,       -- 1. Voucher dùng được ngay lên đầu
                sub_query.missing_amount ASC,     -- 2. Voucher gần đạt được nhất (Upsell dễ nhất) lên nhì
                sub_query.discount_value DESC     -- 3. Giảm giá sâu xếp trước
        ) t;

        RETURN COALESCE(v_result, '[]'::jsonb);
    END;
    $$;


ALTER FUNCTION "public"."get_pos_usable_promotions"("p_customer_id" bigint, "p_order_total" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_pos_usable_promotions"("p_customer_id" bigint, "p_order_total" numeric) IS 'Core V6: Shopee Style - Trả về ALL voucher + Missing Amount để Upsell';



CREATE OR REPLACE FUNCTION "public"."get_prescription_template_details"("p_id" bigint) RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_template RECORD;
    v_items JSON;
BEGIN
    -- Lấy Header
    SELECT * INTO v_template FROM public.prescription_templates WHERE id = p_id;
    
    IF v_template IS NULL THEN RETURN NULL; END IF;

    -- Lấy Items (FIX: product_id là BIGINT nên join bình thường)
    SELECT json_agg(json_build_object(
        'id', i.id,
        'product_id', i.product_id,
        'product_name', p.name,
        'product_unit', p.retail_unit, -- Giả sử bảng products có cột retail_unit
        'quantity', i.quantity,
        'usage_instruction', i.usage_instruction
    ))
    INTO v_items
    FROM public.prescription_template_items i
    JOIN public.products p ON i.product_id = p.id
    WHERE i.template_id = p_id;

    RETURN json_build_object(
        'template', row_to_json(v_template),
        'items', COALESCE(v_items, '[]'::json)
    );
END;
$$;


ALTER FUNCTION "public"."get_prescription_template_details"("p_id" bigint) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."prescription_templates" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "diagnosis" "text",
    "note" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "prescription_templates_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."prescription_templates" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_prescription_templates"("p_search" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."prescription_templates"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.prescription_templates
    WHERE 
        (p_status IS NULL OR status = p_status)
        AND
        (p_search IS NULL OR name ILIKE '%' || p_search || '%' OR diagnosis ILIKE '%' || p_search || '%')
    ORDER BY created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_prescription_templates"("p_search" "text", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_product_available_stock"("p_warehouse_id" bigint, "p_product_ids" bigint[]) RETURNS TABLE("product_id" bigint, "real_stock" integer, "committed_stock" integer, "available_stock" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    BEGIN
        RETURN QUERY
        WITH real_inv AS (
            -- Lấy tồn kho thực tế
            SELECT pi.product_id, pi.stock_quantity
            FROM public.product_inventory pi
            WHERE pi.warehouse_id = p_warehouse_id 
              AND pi.product_id = ANY(p_product_ids)
        ),
        committed_inv AS (
            -- Tính hàng đang bị giữ (Chỉ tính đơn CONFIRMED)
            SELECT oi.product_id, SUM(oi.quantity * COALESCE(oi.conversion_factor, 1))::INT as qty_held
            FROM public.order_items oi
            JOIN public.orders o ON oi.order_id = o.id
            WHERE o.warehouse_id = p_warehouse_id
              AND o.status = 'CONFIRMED' -- [CORE FIXED]: Chỉ trừ CONFIRMED
              AND oi.product_id = ANY(p_product_ids)
            GROUP BY oi.product_id
        )
        SELECT 
            id as product_id,
            COALESCE(r.stock_quantity, 0) as real_stock,
            COALESCE(c.qty_held, 0) as committed_stock,
            (COALESCE(r.stock_quantity, 0) - COALESCE(c.qty_held, 0)) as available_stock
        FROM unnest(p_product_ids) as id
        LEFT JOIN real_inv r ON r.product_id = id
        LEFT JOIN committed_inv c ON c.product_id = id;
    END;
    $$;


ALTER FUNCTION "public"."get_product_available_stock"("p_warehouse_id" bigint, "p_product_ids" bigint[]) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."get_purchase_order_detail"("p_po_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_result JSONB;
    BEGIN
        SELECT jsonb_build_object(
            -- Header fields (giữ nguyên)
            'id', po.id, 'code', po.code, 'status', po.status, 'delivery_status', po.delivery_status,
            'payment_status', po.payment_status, 'expected_delivery_date', po.expected_delivery_date,
            'created_at', po.created_at, 'note', po.note, 'total_amount', po.total_amount,
            'final_amount', po.final_amount, 'discount_amount', po.discount_amount,
            'delivery_method', po.delivery_method, 'shipping_fee', po.shipping_fee,
            'shipping_partner_id', po.shipping_partner_id, 'total_packages', po.total_packages,
            'carrier_name', po.carrier_name, 'carrier_contact', po.carrier_contact,
            'carrier_phone', po.carrier_phone, 'expected_delivery_time', po.expected_delivery_time,
            
            'supplier', jsonb_build_object('id', s.id, 'name', s.name, 'phone', s.phone, 'address', s.address, 'tax_code', s.tax_code, 'debt', 0),

            'items', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'key', poi.id, 'id', poi.id, 
                    'quantity_ordered', poi.quantity_ordered, 'quantity_received', COALESCE(poi.quantity_received, 0),
                    'uom_ordered', poi.uom_ordered, 'unit', poi.unit, 
                    'unit_price', poi.unit_price, 'total_line', (poi.quantity_ordered * poi.unit_price),
                    'conversion_factor', poi.conversion_factor, 'base_quantity', poi.base_quantity,
                    
                    'is_bonus', poi.is_bonus, -- [NEW FIELD RETURN]
                    
                    'product_id', p.id, 'product_name', p.name, 'sku', p.sku, 'image_url', p.image_url,
                    'stock_management_type', p.stock_management_type,
                    'available_units', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', pu.id, 'unit_name', pu.unit_name, 'conversion_rate', pu.conversion_rate, 'is_base', pu.is_base, 'barcode', pu.barcode, 'price_sell', pu.price_sell) ORDER BY pu.conversion_rate ASC) FROM public.product_units pu WHERE pu.product_id = p.id), '[]'::jsonb)
                ) ORDER BY poi.id ASC)
                FROM public.purchase_order_items poi
                JOIN public.products p ON poi.product_id = p.id
                WHERE poi.po_id = po.id
            ), '[]'::jsonb)
        )
        INTO v_result
        FROM public.purchase_orders po
        LEFT JOIN public.suppliers s ON po.supplier_id = s.id
        WHERE po.id = p_po_id;

        IF v_result IS NULL THEN RETURN NULL; END IF;
        RETURN v_result;
    END;
    $$;


ALTER FUNCTION "public"."get_purchase_order_detail"("p_po_id" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_purchase_order_detail"("p_po_id" bigint) IS 'V2: PO Detail + Logistics Info + Available Units';



CREATE OR REPLACE FUNCTION "public"."get_purchase_order_details"("p_id" bigint) RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_po RECORD;
    v_items JSON;
BEGIN
    SELECT po.*, s.name as supplier_name 
    INTO v_po 
    FROM public.purchase_orders po
    LEFT JOIN public.suppliers s ON po.supplier_id = s.id
    WHERE po.id = p_id;
    
    IF v_po IS NULL THEN RETURN NULL; END IF;
    
    SELECT json_agg(json_build_object(
        'id', poi.id,
        'product_id', poi.product_id,
        'product_name', prod.name,
        'product_sku', prod.sku,
        'quantity_ordered', poi.quantity_ordered,
        'quantity_received', poi.quantity_received,
        'unit_price', poi.unit_price,
        'unit', poi.unit,
        'total_line', (poi.quantity_ordered * poi.unit_price)
    )) INTO v_items
    FROM public.purchase_order_items poi
    JOIN public.products prod ON poi.product_id = prod.id
    WHERE poi.po_id = p_id;
    
    RETURN json_build_object(
        'po', row_to_json(v_po),
        'items', COALESCE(v_items, '[]'::json)
    );
END;
$$;


ALTER FUNCTION "public"."get_purchase_order_details"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_purchase_orders_master"("p_page" integer DEFAULT 1, "p_page_size" integer DEFAULT 10, "p_search" "text" DEFAULT NULL::"text", "p_status_delivery" "text" DEFAULT NULL::"text", "p_status_payment" "text" DEFAULT NULL::"text", "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("id" bigint, "code" "text", "supplier_id" bigint, "supplier_name" "text", "delivery_method" "text", "shipping_partner_name" "text", "delivery_status" "text", "payment_status" "text", "status" "text", "final_amount" numeric, "total_paid" numeric, "total_quantity" bigint, "total_cartons" numeric, "delivery_progress" numeric, "expected_delivery_date" timestamp with time zone, "expected_delivery_time" timestamp with time zone, "created_at" timestamp with time zone, "full_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
                po.id, 
                po.code, 
                po.supplier_id, 
                COALESCE(s.name, 'N/A') as supplier_name,
                po.delivery_method,
                sp.name as shipping_partner_name,
                po.delivery_status, 
                po.payment_status,
                po.status,
                po.final_amount, 
                
                COALESCE(po.total_paid, 0) as total_paid, -- [FIX] Lấy dữ liệu thanh toán
                
                COALESCE(pm._total_qty, 0) as total_quantity,
                COALESCE(pm._total_cartons, 0) as total_cartons,
                
                CASE 
                    WHEN COALESCE(pm._total_qty, 0) = 0 THEN 0
                    ELSE ROUND((COALESCE(pm._total_received, 0)::NUMERIC / pm._total_qty) * 100, 0)
                END as delivery_progress,

                po.expected_delivery_date, 
                po.expected_delivery_time,
                po.created_at

            FROM public.purchase_orders po
            LEFT JOIN po_metrics pm ON po.id = pm.po_id
            LEFT JOIN public.suppliers s ON po.supplier_id = s.id
            LEFT JOIN public.shipping_partners sp ON po.shipping_partner_id = sp.id
            WHERE 
                (p_status_delivery IS NULL OR po.delivery_status = p_status_delivery)
                AND (p_status_payment IS NULL OR po.payment_status = p_status_payment)
                AND (p_date_from IS NULL OR po.created_at >= p_date_from)
                AND (p_date_to IS NULL OR po.created_at <= p_date_to)
                
                -- [CORE RESTORED] Giữ lại logic tìm kiếm sâu (Deep Search)
                AND (
                    p_search IS NULL OR p_search = '' 
                    -- 1. Tìm theo Mã đơn hoặc Tên NCC
                    OR po.code ILIKE ('%' || p_search || '%')
                    OR s.name ILIKE ('%' || p_search || '%')
                    -- 2. Tìm sâu vào sản phẩm (Tên hoặc SKU)
                    OR EXISTS (
                        SELECT 1 
                        FROM public.purchase_order_items sub_poi
                        JOIN public.products sub_p ON sub_poi.product_id = sub_p.id
                        WHERE sub_poi.po_id = po.id
                        AND (
                            sub_p.name ILIKE ('%' || p_search || '%')
                            OR sub_p.sku ILIKE ('%' || p_search || '%')
                        )
                    )
                )
        )
        SELECT 
            *,
            COUNT(*) OVER() AS full_count
        FROM base_query
        ORDER BY created_at DESC
        LIMIT p_page_size OFFSET v_offset;
    END;
    $$;


ALTER FUNCTION "public"."get_purchase_orders_master"("p_page" integer, "p_page_size" integer, "p_search" "text", "p_status_delivery" "text", "p_status_payment" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sales_orders_view"("p_page" integer DEFAULT 1, "p_page_size" integer DEFAULT 10, "p_search" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT NULL::"text", "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_order_type" "text" DEFAULT NULL::"text", "p_remittance_status" "text" DEFAULT NULL::"text", "p_creator_id" "uuid" DEFAULT NULL::"uuid", "p_payment_status" "text" DEFAULT NULL::"text", "p_invoice_status" "text" DEFAULT NULL::"text", "p_payment_method" "text" DEFAULT NULL::"text", "p_warehouse_id" bigint DEFAULT NULL::bigint, "p_customer_id" bigint DEFAULT NULL::bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_offset INT := (p_page - 1) * p_page_size;
        v_result JSONB;
        v_stats JSONB;
    BEGIN
        -- A. STATS (Tính toán thống kê theo bộ lọc hiện tại để chính xác hơn)
        -- Lưu ý: Stats này tính trên TOÀN BỘ dữ liệu thỏa mãn filter (không bị paging)
        WITH stats_filter AS (
            SELECT final_amount, paid_amount, remittance_status, payment_method, status
            FROM public.orders o
            WHERE 
                (p_order_type IS NULL OR o.order_type = p_order_type)
                AND (p_status IS NULL OR o.status = p_status)
                AND (p_date_from IS NULL OR o.created_at >= p_date_from)
                AND (p_date_to IS NULL OR o.created_at <= p_date_to)
                AND (p_creator_id IS NULL OR o.creator_id = p_creator_id)
                AND (p_warehouse_id IS NULL OR o.warehouse_id = p_warehouse_id) -- Filter kho
        )
        SELECT jsonb_build_object(
            'total_sales', COALESCE(SUM(final_amount) FILTER (WHERE status NOT IN ('DRAFT', 'CANCELLED')), 0),
            'count_pending_remittance', COUNT(*) FILTER (WHERE remittance_status = 'pending' AND payment_method = 'cash'),
            'total_cash_pending', COALESCE(SUM(paid_amount) FILTER (WHERE remittance_status = 'pending' AND payment_method = 'cash'), 0)
        ) INTO v_stats
        FROM stats_filter;

        -- B. MAIN QUERY
        WITH filtered_data AS (
            SELECT 
                o.id, o.code, o.created_at, o.status, o.order_type,
                o.final_amount, o.paid_amount, o.payment_method, 
                o.remittance_status, o.payment_status, o.invoice_status,
                o.note,
                o.warehouse_id,
                
                COALESCE(w.name, 'Kho mặc định') as warehouse_name,
                
                -- Customer Info
                COALESCE(cb.name, cc.name, 'Khách lẻ') as customer_name,
                COALESCE(cb.phone, cc.phone) as customer_phone,
                COALESCE(cb.tax_code, cc.tax_code) as customer_tax_code,
                COALESCE(cb.email, cc.email) as customer_email,
                
                -- Creator Info
                COALESCE(u.full_name, u.email) as creator_name,
                o.creator_id,

                -- Invoice Info
                (SELECT to_jsonb(inv) FROM public.sales_invoices inv WHERE inv.order_id = o.id ORDER BY inv.created_at DESC LIMIT 1) as sales_invoice,

                -- Items Info
                (
                    SELECT jsonb_agg(jsonb_build_object(
                        'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 
                        'unit_price', oi.unit_price, 'uom', oi.uom, 'discount', oi.discount,
                        'product', jsonb_build_object('id', p.id, 'name', p.name, 'retail_unit', p.retail_unit, 'wholesale_unit', p.wholesale_unit)
                    ))
                    FROM public.order_items oi
                    JOIN public.products p ON oi.product_id = p.id
                    WHERE oi.order_id = o.id
                ) as order_items
                
            FROM public.orders o
            LEFT JOIN public.customers_b2b cb ON o.customer_id = cb.id
            LEFT JOIN public.customers cc ON o.customer_b2c_id = cc.id
            LEFT JOIN public.users u ON o.creator_id = u.id
            LEFT JOIN public.warehouses w ON o.warehouse_id = w.id
            WHERE 
                (p_order_type IS NULL OR o.order_type = p_order_type)
                AND (p_status IS NULL OR o.status = p_status)
                AND (p_remittance_status IS NULL OR o.remittance_status = p_remittance_status)
                AND (p_date_from IS NULL OR o.created_at >= p_date_from)
                AND (p_date_to IS NULL OR o.created_at <= p_date_to)
                AND (p_creator_id IS NULL OR o.creator_id = p_creator_id)
                AND (p_payment_status IS NULL OR o.payment_status = p_payment_status)
                AND (p_invoice_status IS NULL OR o.invoice_status::text = p_invoice_status)
                
                -- [NEW FILTERS V9.2]
                AND (p_payment_method IS NULL OR o.payment_method = p_payment_method)
                AND (p_warehouse_id IS NULL OR o.warehouse_id = p_warehouse_id)
                AND (p_customer_id IS NULL OR (o.customer_id = p_customer_id OR o.customer_b2c_id = p_customer_id))

                -- SEARCH
                AND (
                    p_search IS NULL OR p_search = '' 
                    OR o.code ILIKE '%' || p_search || '%'
                    OR cb.name ILIKE '%' || p_search || '%'
                    OR cc.name ILIKE '%' || p_search || '%'
                    OR cc.phone ILIKE '%' || p_search || '%'
                    OR EXISTS (
                        SELECT 1 FROM public.order_items oi_search
                        JOIN public.products prod ON oi_search.product_id = prod.id 
                        WHERE oi_search.order_id = o.id 
                          AND (prod.name ILIKE '%' || p_search || '%' OR prod.sku ILIKE '%' || p_search || '%')
                    )
                )
        ),
        paginated AS (
            SELECT * FROM filtered_data
            ORDER BY created_at DESC
            LIMIT p_page_size OFFSET v_offset
        )
        SELECT jsonb_build_object(
            'data', COALESCE(jsonb_agg(to_jsonb(t.*)), '[]'::jsonb),
            'total', (SELECT COUNT(*) FROM filtered_data),
            'stats', v_stats
        ) INTO v_result
        FROM paginated t;

        RETURN COALESCE(v_result, jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'stats', v_stats));
    END;
    $$;


ALTER FUNCTION "public"."get_sales_orders_view"("p_page" integer, "p_page_size" integer, "p_search" "text", "p_status" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_order_type" "text", "p_remittance_status" "text", "p_creator_id" "uuid", "p_payment_status" "text", "p_invoice_status" "text", "p_payment_method" "text", "p_warehouse_id" bigint, "p_customer_id" bigint) OWNER TO "postgres";


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
    "profile_updated_at" timestamp with time zone,
    "work_state" "text" DEFAULT 'working'::"text",
    CONSTRAINT "users_work_state_check" CHECK (("work_state" = ANY (ARRAY['working'::"text", 'on_leave'::"text", 'resigned'::"text", 'test'::"text"])))
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


CREATE OR REPLACE FUNCTION "public"."get_service_package_details"("p_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_details JSONB;
BEGIN
  SELECT
    jsonb_build_object(
      -- 1. Thông tin chính (từ bảng 'service_packages')
      'package_data', to_jsonb(p.*),
      
      -- 2. Gom mảng items con (từ bảng 'service_package_items')
      'package_items', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'key', i.id,
            'item_id', i.item_id,
            'quantity', i.quantity,
            'item_type', i.item_type,
            'schedule_days', i.schedule_days,
            -- Tích hợp: Lấy tên và đơn vị từ bảng 'products'
            'name', prod.name,
            'unit', prod.retail_unit -- Mặc định lấy đơn vị lẻ
          )
        ), '[]'::JSONB)
        FROM public.service_package_items i
        JOIN public.products prod ON i.item_id = prod.id
        WHERE i.package_id = p.id
      )
    )
  INTO v_details
  FROM public.service_packages p
  WHERE p.id = p_id;
  
  RETURN v_details;
END;
$$;


ALTER FUNCTION "public"."get_service_package_details"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_service_packages_list"("p_search_query" "text", "p_type_filter" "text", "p_status_filter" "text", "p_page_num" integer, "p_page_size" integer) RETURNS TABLE("key" "text", "id" bigint, "name" "text", "sku" "text", "type" "public"."service_package_type", "price" numeric, "total_cost_price" numeric, "valid_from" "date", "valid_to" "date", "status" "public"."account_status", "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
      COUNT(*) OVER() AS total_count
    FROM
      public.service_packages s
    WHERE
      (p_type_filter IS NULL OR s.type = p_type_filter::public.service_package_type)
    AND
      (p_status_filter IS NULL OR s.status = p_status_filter::public.account_status)
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
$$;


ALTER FUNCTION "public"."get_service_packages_list"("p_search_query" "text", "p_type_filter" "text", "p_status_filter" "text", "p_page_num" integer, "p_page_size" integer) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."get_supplier_quick_info"("p_supplier_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_total_purchase NUMERIC;
    v_opening_debt NUMERIC;
    v_total_paid NUMERIC;
    v_total_purchase_month NUMERIC;
BEGIN
    -- 1. Tổng giá trị mua hàng
    SELECT COALESCE(SUM(final_amount), 0) INTO v_total_purchase
    FROM public.purchase_orders
    WHERE supplier_id = p_supplier_id AND status <> 'CANCELLED';

    -- 2. Nợ đầu kỳ
    SELECT COALESCE(SUM(amount), 0) INTO v_opening_debt
    FROM public.finance_transactions
    WHERE partner_type = 'supplier' AND partner_id = p_supplier_id::TEXT AND business_type = 'opening_balance';

    -- 3. Tổng đã chi trả
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM public.finance_transactions
    WHERE partner_type = 'supplier' AND partner_id = p_supplier_id::TEXT AND flow = 'out' AND status = 'completed' AND business_type <> 'opening_balance';

    -- 4. Tổng mua trong tháng (KPI)
    SELECT COALESCE(SUM(final_amount), 0) INTO v_total_purchase_month
    FROM public.purchase_orders
    WHERE supplier_id = p_supplier_id AND created_at >= date_trunc('month', CURRENT_DATE);

    RETURN jsonb_build_object(
        'current_debt', (v_total_purchase + v_opening_debt) - v_total_paid, -- Công thức thông minh
        'purchased_this_month', v_total_purchase_month,
        'opening_debt', v_opening_debt
    );
END;
$$;


ALTER FUNCTION "public"."get_supplier_quick_info"("p_supplier_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_suppliers_list"("search_query" "text", "status_filter" "text", "page_num" integer, "page_size" integer) RETURNS TABLE("id" bigint, "key" "text", "code" "text", "name" "text", "contact_person" "text", "phone" "text", "status" "text", "debt" numeric, "bank_bin" "text", "bank_account" "text", "bank_name" "text", "bank_holder" "text", "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
            
            -- [CORE FIX]: Tạo mã hiển thị từ ID, KHÔNG gọi s.code
            ('NCC-' || s.id::TEXT) AS code,
            
            s.name,
            s.contact_person,
            s.phone,
            s.status, 
            
            -- Công thức tính nợ thông minh
            (
                COALESCE(pt.amount, 0) +      -- Tổng giá trị đơn hàng
                COALESCE(od.amount, 0) -      -- Cộng nợ đầu kỳ
                COALESCE(pd.amount, 0)        -- Trừ tổng tiền đã trả
            ) AS debt,
            
            s.bank_bin,
            s.bank_account,
            s.bank_name,
            s.bank_holder,
            
            COUNT(*) OVER() as total_count
        FROM 
            public.suppliers s
        LEFT JOIN po_total pt ON s.id = pt.supplier_id
        LEFT JOIN opening_debt od ON s.id = od.supplier_id
        LEFT JOIN paid_total pd ON s.id = pd.supplier_id
        WHERE 
            (search_query IS NULL OR search_query = '' OR (
                s.name ILIKE ('%' || search_query || '%') OR
                s.phone ILIKE ('%' || search_query || '%')
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


CREATE OR REPLACE FUNCTION "public"."get_transaction_history"("p_flow" "public"."transaction_flow" DEFAULT NULL::"public"."transaction_flow", "p_fund_id" bigint DEFAULT NULL::bigint, "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0, "p_search" "text" DEFAULT NULL::"text", "p_created_by" "uuid" DEFAULT NULL::"uuid", "p_status" "public"."transaction_status" DEFAULT NULL::"public"."transaction_status") RETURNS TABLE("id" bigint, "code" "text", "transaction_date" timestamp with time zone, "flow" "public"."transaction_flow", "amount" numeric, "fund_name" "text", "partner_name" "text", "category_name" "text", "description" "text", "business_type" "public"."business_type", "created_by_name" "text", "status" "public"."transaction_status", "ref_advance_id" bigint, "ref_advance_code" "text", "target_bank_info" "jsonb", "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    BEGIN
        RETURN QUERY
        SELECT 
            t.id, 
            t.code, 
            t.transaction_date, 
            t.flow, 
            t.amount, 
            f.name as fund_name, 
            COALESCE(t.partner_name_cache, 'Khác') as partner_name, 
            cat.name as category_name, 
            t.description, 
            t.business_type, 
            u.full_name as created_by_name, 
            t.status, 
            t.ref_advance_id, 
            parent.code as ref_advance_code,
            t.target_bank_info, 
            COUNT(*) OVER() as total_count
        FROM public.finance_transactions t
        JOIN public.fund_accounts f ON t.fund_account_id = f.id
        LEFT JOIN public.transaction_categories cat ON t.category_id = cat.id
        LEFT JOIN public.users u ON t.created_by = u.id
        LEFT JOIN public.finance_transactions parent ON t.ref_advance_id = parent.id
        WHERE 
            (p_flow IS NULL OR t.flow = p_flow)
            AND (p_fund_id IS NULL OR t.fund_account_id = p_fund_id)
            AND (p_date_from IS NULL OR t.transaction_date >= p_date_from)
            AND (p_date_to IS NULL OR t.transaction_date <= p_date_to)
            AND (p_status IS NULL OR t.status = p_status)
            AND (p_created_by IS NULL OR t.created_by = p_created_by)
            AND (
                p_search IS NULL OR 
                t.code ILIKE '%' || p_search || '%' OR 
                t.description ILIKE '%' || p_search || '%' OR
                t.partner_name_cache ILIKE '%' || p_search || '%'
            )
        ORDER BY t.transaction_date DESC
        LIMIT p_limit OFFSET p_offset;
    END;
    $$;


ALTER FUNCTION "public"."get_transaction_history"("p_flow" "public"."transaction_flow", "p_fund_id" bigint, "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_limit" integer, "p_offset" integer, "p_search" "text", "p_created_by" "uuid", "p_status" "public"."transaction_status") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_transactions"("p_page" integer, "p_page_size" integer, "p_search" "text", "p_flow" "text", "p_status" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_creator_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" bigint, "code" "text", "flow" "text", "amount" numeric, "status" "text", "partner_name" "text", "transaction_date" timestamp with time zone, "description" "text", "business_type" "text", "creator_name" "text", "full_count" bigint, "metadata" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.code,
        t.flow::TEXT,
        t.amount,
        t.status::TEXT,
        COALESCE(t.partner_name_cache, 'Khách lẻ') as partner_name,
        t.transaction_date,
        t.description,
        t.business_type::TEXT,
        COALESCE(u.full_name, u.email, 'N/A') as creator_name,
        COUNT(*) OVER() as full_count,
        COALESCE(t.target_bank_info, '{}'::jsonb) AS metadata
    FROM public.finance_transactions t
    LEFT JOIN public.users u ON t.created_by = u.id 
    WHERE 
        -- [CORE UPGRADE]: Tìm kiếm đa năng 4 trường
        (
            p_search IS NULL 
            OR t.code ILIKE '%' || p_search || '%'                  -- 1. Tìm theo Mã
            OR t.partner_name_cache ILIKE '%' || p_search || '%'    -- 2. Tìm theo Đối tác
            OR t.description ILIKE '%' || p_search || '%'           -- 3. Tìm theo Nội dung (Mới)
            OR u.full_name ILIKE '%' || p_search || '%'             -- 4. Tìm theo Người tạo (Mới)
            OR u.email ILIKE '%' || p_search || '%'                 -- (Backup) Tìm theo Email người tạo
        )
        
        AND (p_flow IS NULL OR t.flow::TEXT = p_flow)
        AND (p_status IS NULL OR t.status::TEXT = p_status)
        AND (p_date_from IS NULL OR t.transaction_date >= p_date_from)
        AND (p_date_to IS NULL OR t.transaction_date <= p_date_to)
        AND (p_creator_id IS NULL OR t.created_by = p_creator_id) 
    ORDER BY t.transaction_date DESC
    LIMIT p_page_size OFFSET (p_page - 1) * p_page_size;
END;
$$;


ALTER FUNCTION "public"."get_transactions"("p_page" integer, "p_page_size" integer, "p_search" "text", "p_flow" "text", "p_status" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_creator_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_transfers"("p_page" integer, "p_page_size" integer, "p_search" "text", "p_status" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_creator_id" "uuid" DEFAULT NULL::"uuid", "p_receiver_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" bigint, "code" "text", "source_warehouse_name" "text", "dest_warehouse_name" "text", "status" "text", "created_at" timestamp with time zone, "creator_name" "text", "receiver_name" "text", "note" "text", "full_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.code,
        w1.name as source_warehouse_name,
        w2.name as dest_warehouse_name,
        t.status,
        t.created_at,
        
        -- Lấy tên người tạo
        COALESCE(u1.full_name, u1.email, 'System') as creator_name,
        
        -- [NEW] Lấy tên người nhận (Nếu chưa có thì hiện ---)
        COALESCE(u2.full_name, u2.email, '---') as receiver_name,
        
        t.note,
        COUNT(*) OVER() as full_count
    FROM public.inventory_transfers t
    JOIN public.warehouses w1 ON t.source_warehouse_id = w1.id
    JOIN public.warehouses w2 ON t.dest_warehouse_id = w2.id
    LEFT JOIN public.users u1 ON t.created_by = u1.id
    LEFT JOIN public.users u2 ON t.received_by = u2.id -- [NEW] Join người nhận
    WHERE 
        -- 1. TÌM KIẾM ĐA NĂNG (Deep Search)
        (p_search IS NULL OR p_search = '' OR 
            -- A. Tìm theo Mã phiếu
            t.code ILIKE '%' || p_search || '%' OR
            
            -- B. Tìm theo Tên người tạo
            COALESCE(u1.full_name, '') ILIKE '%' || p_search || '%' OR
            
            -- C. [NEW] Tìm theo Tên người nhận
            COALESCE(u2.full_name, '') ILIKE '%' || p_search || '%' OR
            
            -- D. Tìm theo Ghi chú
            COALESCE(t.note, '') ILIKE '%' || p_search || '%' OR

            -- E. Tìm theo Sản phẩm bên trong phiếu
            EXISTS (
                SELECT 1 
                FROM public.inventory_transfer_items iti
                JOIN public.products p ON iti.product_id = p.id
                WHERE iti.transfer_id = t.id 
                AND (
                    p.name ILIKE '%' || p_search || '%' 
                    OR p.sku ILIKE '%' || p_search || '%'
                )
            )
        )
        
        -- 2. Các bộ lọc khác
        AND (p_status IS NULL OR t.status = p_status)
        AND (p_date_from IS NULL OR t.created_at >= p_date_from)
        AND (p_date_to IS NULL OR t.created_at <= p_date_to)
        AND (p_creator_id IS NULL OR t.created_by = p_creator_id)
        AND (p_receiver_id IS NULL OR t.received_by = p_receiver_id) -- [NEW] Filter
        
    ORDER BY t.created_at DESC
    LIMIT p_page_size OFFSET (p_page - 1) * p_page_size;
END;
$$;


ALTER FUNCTION "public"."get_transfers"("p_page" integer, "p_page_size" integer, "p_search" "text", "p_status" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_creator_id" "uuid", "p_receiver_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_pending_revenue"("p_user_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
        v_total numeric;
    BEGIN
        SELECT COALESCE(SUM(final_amount), 0)
        INTO v_total
        FROM public.orders
        WHERE creator_id = p_user_id -- [CORE FIX]: Dùng đúng cột creator_id
          AND payment_method = 'cash' 
          AND remittance_status = 'pending' 
          AND status IN ('COMPLETED', 'DELIVERED', 'SHIPPING', 'PACKED', 'CONFIRMED');
          
        RETURN v_total;
    END;
    $$;


ALTER FUNCTION "public"."get_user_pending_revenue"("p_user_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."get_vaccination_template_details"("p_id" bigint) RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_template RECORD;
    v_items JSON;
BEGIN
    SELECT * INTO v_template FROM public.vaccination_templates WHERE id = p_id;
    IF v_template IS NULL THEN RETURN NULL; END IF;

    SELECT json_agg(json_build_object(
        'id', i.id,
        'product_id', i.product_id,
        'product_name', p.name,
        'product_sku', p.sku, -- Thêm SKU cho dễ nhìn
        'shot_name', i.shot_name,
        'days_after_start', i.days_after_start,
        'note', i.note
    ) ORDER BY i.days_after_start ASC)
    INTO v_items
    FROM public.vaccination_template_items i
    LEFT JOIN public.products p ON i.product_id = p.id
    WHERE i.template_id = p_id;

    RETURN json_build_object(
        'template', row_to_json(v_template),
        'items', COALESCE(v_items, '[]'::json)
    );
END;
$$;


ALTER FUNCTION "public"."get_vaccination_template_details"("p_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_vaccination_templates"("p_search" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT NULL::"text") RETURNS TABLE("id" bigint, "name" "text", "description" "text", "min_age_months" integer, "max_age_months" integer, "status" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "item_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
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
        (SELECT COUNT(*) FROM public.vaccination_template_items i WHERE i.template_id = t.id) AS item_count -- Logic đếm
    FROM public.vaccination_templates t
    WHERE 
        (p_status IS NULL OR t.status = p_status)
        AND
        (p_search IS NULL OR t.name ILIKE '%' || p_search || '%')
    ORDER BY t.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_vaccination_templates"("p_search" "text", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_valid_vouchers_for_checkout"("p_customer_id" bigint, "p_cart_total" numeric DEFAULT 0) RETURNS TABLE("voucher_id" bigint, "code" "text", "promo_name" "text", "discount_type" "text", "discount_value" numeric, "max_discount" numeric, "min_order_value" numeric, "is_eligible" boolean, "ineligibility_reason" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    BEGIN
        RETURN QUERY
        SELECT 
            cv.id AS voucher_id,
            cv.code,
            p.name AS promo_name,
            p.discount_type,
            p.discount_value,
            p.max_discount_value AS max_discount, -- Giả định bảng promotions có cột này
            COALESCE(p.min_order_value, 0) AS min_order_value,
            
            -- Logic kiểm tra điều kiện (Eligible)
            CASE 
                -- Nếu tổng đơn nhỏ hơn mức tối thiểu -> False
                WHEN COALESCE(p.min_order_value, 0) > p_cart_total THEN FALSE
                ELSE TRUE
            END AS is_eligible,
            
            -- Tạo câu thông báo lý do (Human readable)
            CASE 
                WHEN COALESCE(p.min_order_value, 0) > p_cart_total THEN 
                    format('Đơn hàng cần tối thiểu %s đ', to_char(p.min_order_value, 'FM999,999,999'))
                ELSE NULL
            END AS ineligibility_reason

        FROM public.customer_vouchers cv
        JOIN public.promotions p ON cv.promotion_id = p.id
        WHERE 
            cv.customer_id = p_customer_id
            AND cv.status = 'active'
            AND (cv.usage_remaining IS NULL OR cv.usage_remaining > 0) -- Còn lượt dùng
            AND p.status = 'active' -- Chương trình còn chạy
            AND (p.valid_to IS NULL OR p.valid_to >= NOW()) -- Chưa hết hạn
            AND (p.valid_from <= NOW()); -- Đã bắt đầu
    END;
    $$;


ALTER FUNCTION "public"."get_valid_vouchers_for_checkout"("p_customer_id" bigint, "p_cart_total" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_valid_vouchers_for_checkout"("p_customer_id" bigint, "p_cart_total" numeric) IS 'API POS: Lấy danh sách Voucher trong ví khách và kiểm tra điều kiện Cart Total';



CREATE OR REPLACE FUNCTION "public"."get_warehouse_cabinets"("p_warehouse_id" bigint) RETURNS TABLE("cabinet_name" "text")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
        SELECT DISTINCT location_cabinet 
        FROM public.product_inventory 
        WHERE warehouse_id = p_warehouse_id 
          AND location_cabinet IS NOT NULL 
          AND location_cabinet <> ''
        ORDER BY location_cabinet;
    $$;


ALTER FUNCTION "public"."get_warehouse_cabinets"("p_warehouse_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_warehouse_inbound_tasks"("p_warehouse_id" bigint, "p_page" integer DEFAULT 1, "p_page_size" integer DEFAULT 10, "p_search" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT NULL::"text", "p_date_from" "date" DEFAULT NULL::"date", "p_date_to" "date" DEFAULT NULL::"date") RETURNS TABLE("task_id" bigint, "code" "text", "supplier_name" "text", "created_at" timestamp with time zone, "expected_delivery_date" timestamp with time zone, "expected_delivery_time" timestamp with time zone, "item_count" bigint, "progress_percent" numeric, "status" "text", "total_packages" integer, "carrier_name" "text", "carrier_contact" "text", "carrier_phone" "text", "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_offset INTEGER;
    BEGIN
        v_offset := (p_page - 1) * p_page_size;

        RETURN QUERY
        WITH po_metrics AS (
            SELECT 
                poi.po_id,
                COUNT(*) AS _item_count,
                SUM(poi.quantity_ordered) AS _total_ordered,
                SUM(poi.quantity_received) AS _total_received
            FROM public.purchase_order_items poi
            GROUP BY poi.po_id
        ),
        base_query AS (
            SELECT 
                po.id AS _id,
                po.code AS _code,
                s.name AS _supplier_name,
                po.created_at AS _created_at,
                po.expected_delivery_date AS _expected_date,
                po.expected_delivery_time AS _expected_time, -- Real Data
                COALESCE(pm._item_count, 0) AS _item_count,
                
                CASE 
                    WHEN COALESCE(pm._total_ordered, 0) = 0 THEN 0
                    ELSE ROUND((COALESCE(pm._total_received, 0)::NUMERIC / pm._total_ordered) * 100, 1)
                END AS _progress,

                po.delivery_status AS _status,

                -- Logistics Real Data
                COALESCE(po.total_packages, 1) AS _total_packages,
                COALESCE(po.carrier_name, 'Tự vận chuyển') AS _carrier_name,
                COALESCE(po.carrier_contact, '') AS _carrier_contact,
                COALESCE(po.carrier_phone, '') AS _carrier_phone

            FROM public.purchase_orders po
            LEFT JOIN public.suppliers s ON po.supplier_id = s.id
            LEFT JOIN po_metrics pm ON po.id = pm.po_id
            WHERE 
                po.status IN ('PENDING', 'APPROVED', 'COMPLETED', 'PARTIAL') 
                AND (p_status IS NULL OR po.delivery_status = p_status)
                AND (p_date_from IS NULL OR date(po.created_at) >= p_date_from)
                AND (p_date_to IS NULL OR date(po.created_at) <= p_date_to)
                AND (
                    p_search IS NULL OR p_search = '' 
                    OR po.code ILIKE ('%' || p_search || '%')
                    OR s.name ILIKE ('%' || p_search || '%')
                )
        )
        SELECT 
            _id, _code, _supplier_name, _created_at, _expected_date, _expected_time,
            _item_count, _progress, _status,
            _total_packages, _carrier_name, _carrier_contact, _carrier_phone,
            COUNT(*) OVER() AS total_count
        FROM base_query
        ORDER BY 
            (CASE WHEN _status = 'completed' THEN 1 ELSE 0 END) ASC,
            _created_at DESC
        LIMIT p_page_size OFFSET v_offset;
    END;
    $$;


ALTER FUNCTION "public"."get_warehouse_inbound_tasks"("p_warehouse_id" bigint, "p_page" integer, "p_page_size" integer, "p_search" "text", "p_status" "text", "p_date_from" "date", "p_date_to" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_warehouse_inbound_tasks"("p_warehouse_id" bigint, "p_page" integer, "p_page_size" integer, "p_search" "text", "p_status" "text", "p_date_from" "date", "p_date_to" "date") IS 'V1.1: Danh sách nhập kho kèm thông tin Logistics thực tế';



CREATE OR REPLACE FUNCTION "public"."get_warehouse_outbound_tasks"("p_warehouse_id" bigint, "p_page" integer DEFAULT 1, "p_page_size" integer DEFAULT 10, "p_search" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT NULL::"text", "p_shipping_partner_id" bigint DEFAULT NULL::bigint, "p_date_from" "date" DEFAULT NULL::"date", "p_date_to" "date" DEFAULT NULL::"date", "p_type" "text" DEFAULT NULL::"text") RETURNS TABLE("task_id" "uuid", "code" "text", "task_type" "text", "customer_name" "text", "created_at" timestamp with time zone, "delivery_deadline" timestamp with time zone, "priority" "text", "status" "text", "shipping_partner_name" "text", "shipping_contact_name" "text", "shipping_contact_phone" "text", "package_count" integer, "progress_picked" bigint, "progress_total" bigint, "status_label" "text", "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_offset INTEGER;
    BEGIN
        v_offset := (p_page - 1) * p_page_size;

        RETURN QUERY
        WITH task_metrics AS (
            SELECT 
                oi.order_id,
                COALESCE(SUM(oi.quantity), 0) AS _total_qty,
                COALESCE(SUM(oi.quantity_picked), 0) AS _picked_qty
            FROM public.order_items oi
            GROUP BY oi.order_id
        ),
        raw_data AS (
            SELECT 
                o.id AS _internal_id,
                o.code AS _internal_code,
                o.status AS _internal_status,
                o.created_at AS _internal_created_at,
                o.package_count AS _internal_package_count,
                
                -- [FIX LOGIC V4] Ưu tiên check Customer trước
                CASE 
                    WHEN o.customer_id IS NOT NULL THEN 'Bán hàng'
                    WHEN o.delivery_method = 'internal' THEN 'Chuyển kho'
                    ELSE 'Khác' 
                END::TEXT AS _internal_type,

                COALESCE(c.name, 'Khách lẻ') AS _internal_cust_name,
                (o.created_at + interval '24 hours')::TIMESTAMPTZ AS _internal_deadline,

                CASE 
                    WHEN o.status IN ('DELIVERED', 'CANCELLED') THEN 'Normal'
                    WHEN NOW() > (o.created_at + interval '24 hours') THEN 'High'
                    ELSE 'Normal'
                END AS _internal_priority,

                COALESCE(sp.name, 'Tự vận chuyển') AS _internal_ship_partner,
                COALESCE(sp.contact_person, 'N/A') AS _internal_ship_contact,
                COALESCE(sp.phone, 'N/A') AS _internal_ship_phone,

                COALESCE(tm._picked_qty, 0) AS _internal_picked,
                COALESCE(tm._total_qty, 0) AS _internal_total

            FROM public.orders o
            LEFT JOIN public.customers_b2b c ON o.customer_id = c.id
            LEFT JOIN public.shipping_partners sp ON o.shipping_partner_id = sp.id
            LEFT JOIN task_metrics tm ON o.id = tm.order_id
            WHERE 
                o.status NOT IN ('DRAFT', 'QUOTE')
                AND (p_status IS NULL OR o.status = p_status)
                AND (p_shipping_partner_id IS NULL OR o.shipping_partner_id = p_shipping_partner_id)
                AND (p_date_from IS NULL OR date(o.created_at) >= p_date_from)
                AND (p_date_to IS NULL OR date(o.created_at) <= p_date_to)
                -- Deep Search Logic giữ nguyên
                AND (
                    p_search IS NULL OR p_search = '' 
                    OR o.code ILIKE ('%' || p_search || '%')       
                    OR c.name ILIKE ('%' || p_search || '%')       
                    OR EXISTS (
                        SELECT 1 FROM public.order_items sub_oi 
                        JOIN public.products sub_p ON sub_oi.product_id = sub_p.id 
                        WHERE sub_oi.order_id = o.id AND sub_p.name ILIKE ('%' || p_search || '%')
                    )
                )
        )
        SELECT 
            rd._internal_id, rd._internal_code, rd._internal_type, rd._internal_cust_name,
            rd._internal_created_at, rd._internal_deadline, rd._internal_priority, rd._internal_status,
            rd._internal_ship_partner, rd._internal_ship_contact, rd._internal_ship_phone,
            COALESCE(rd._internal_package_count, 1),
            rd._internal_picked, rd._internal_total,
            CASE 
                WHEN rd._internal_status = 'CANCELLED' THEN 'Đã hủy'
                WHEN rd._internal_status = 'DELIVERED' THEN 'Hoàn tất'
                WHEN rd._internal_status = 'SHIPPING' THEN 'Đang giao'
                WHEN rd._internal_picked = 0 THEN 'Chờ xử lý'
                WHEN rd._internal_picked < rd._internal_total THEN 'Đang nhặt'
                WHEN rd._internal_picked >= rd._internal_total THEN 'Chờ giao'
                ELSE 'Chờ xử lý'
            END,
            COUNT(*) OVER()
        FROM raw_data rd
        WHERE (p_type IS NULL OR p_type = '' OR rd._internal_type = p_type) -- Filter Type sau khi tính toán
        ORDER BY 
            (CASE WHEN rd._internal_status IN ('DELIVERED', 'SHIPPING', 'CANCELLED') THEN 1 ELSE 0 END) ASC,
            (CASE WHEN rd._internal_priority = 'High' THEN 0 ELSE 1 END) ASC,
            rd._internal_created_at ASC
        LIMIT p_page_size OFFSET v_offset;
    END;
    $$;


ALTER FUNCTION "public"."get_warehouse_outbound_tasks"("p_warehouse_id" bigint, "p_page" integer, "p_page_size" integer, "p_search" "text", "p_status" "text", "p_shipping_partner_id" bigint, "p_date_from" "date", "p_date_to" "date", "p_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_fund_balance_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- TRƯỜNG HỢP 1: HOÀN TẤT PHIẾU (Tiền thực sự di chuyển)
    -- Xảy ra khi chuyển từ bất kỳ trạng thái nào (pending/approved) sang 'completed'
    IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') 
       OR (TG_OP = 'INSERT' AND NEW.status = 'completed') THEN
       
        IF NEW.flow = 'in' THEN
            UPDATE public.fund_accounts 
            SET balance = balance + NEW.amount, updated_at = now() 
            WHERE id = NEW.fund_account_id;
        ELSIF NEW.flow = 'out' THEN
            UPDATE public.fund_accounts 
            SET balance = balance - NEW.amount, updated_at = now() 
            WHERE id = NEW.fund_account_id;
        END IF;

    -- TRƯỜNG HỢP 2: HỦY PHIẾU ĐÃ HOÀN TẤT (Rollback tiền)
    -- Chỉ khi phiếu cũ là 'completed' thì mới cần hoàn tiền lại quỹ
    ELSIF (TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status = 'completed') THEN
        IF OLD.flow = 'in' THEN
            UPDATE public.fund_accounts SET balance = balance - OLD.amount WHERE id = OLD.fund_account_id;
        ELSIF OLD.flow = 'out' THEN
            UPDATE public.fund_accounts SET balance = balance + OLD.amount WHERE id = OLD.fund_account_id;
        END IF;

    -- TRƯỜNG HỢP 3: XÓA PHIẾU ĐÃ HOÀN TẤT
    ELSIF (TG_OP = 'DELETE' AND OLD.status = 'completed') THEN
        IF OLD.flow = 'in' THEN
            UPDATE public.fund_accounts SET balance = balance - OLD.amount WHERE id = OLD.fund_account_id;
        ELSIF OLD.flow = 'out' THEN
            UPDATE public.fund_accounts SET balance = balance + OLD.amount WHERE id = OLD.fund_account_id;
        END IF;
    END IF;

    -- LƯU Ý: Các trạng thái 'pending' hay 'approved' KHÔNG làm thay đổi số dư.
    
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."handle_fund_balance_update"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."handle_order_cancellation"("p_order_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
        v_trans RECORD;
    BEGIN
        -- 1. Tìm tất cả các giao dịch xuất kho của đơn hàng này
        FOR v_trans IN 
            SELECT * FROM public.inventory_transactions 
            WHERE ref_id = (SELECT code FROM public.orders WHERE id = p_order_id)
              AND type = 'sale_order'
        LOOP
            -- 2. Cộng ngược lại vào kho (Inventory Batches)
            -- Lưu ý: v_trans.quantity là số âm (xuất kho), nên trừ đi số âm là cộng (-(-5) = +5)
            -- Hoặc đơn giản là lấy ABS()
            UPDATE public.inventory_batches
            SET quantity = quantity + ABS(v_trans.quantity), updated_at = NOW()
            WHERE warehouse_id = v_trans.warehouse_id
              AND product_id = v_trans.product_id
              AND batch_id = v_trans.batch_id;

            -- 3. Tạo Transaction bù trừ (Reversal Entry)
            INSERT INTO public.inventory_transactions (
                warehouse_id, product_id, batch_id, 
                type, action_group, quantity, unit_price, 
                ref_id, description, partner_id, created_by
            ) VALUES (
                v_trans.warehouse_id, v_trans.product_id, v_trans.batch_id,
                'import', 'RETURN', -- Type là Import để thể hiện hàng vào
                ABS(v_trans.quantity), v_trans.unit_price,
                v_trans.ref_id, 'Hoàn kho do hủy đơn ' || v_trans.ref_id, 
                v_trans.partner_id, auth.uid()
            );
        END LOOP;
    END;
    $$;


ALTER FUNCTION "public"."handle_order_cancellation"("p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_order_inventory_deduction"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
        v_item RECORD;
        v_warehouse_id BIGINT;
        v_deduct_qty NUMERIC;
        v_batch_record RECORD;
        v_remaining_qty_needed NUMERIC;
        v_unit_cost NUMERIC; -- Giá vốn đơn vị
        v_partner_id BIGINT; -- ID Khách hàng
    BEGIN
        -- Chỉ chạy khi đơn hàng được CHỐT
        IF NEW.status IN ('CONFIRMED', 'DELIVERED', 'POS_COMPLETED', 'PACKED', 'SHIPPING') 
           AND (OLD.status IS NULL OR OLD.status NOT IN ('CONFIRMED', 'DELIVERED', 'POS_COMPLETED', 'PACKED', 'SHIPPING')) THEN

            v_warehouse_id := NEW.warehouse_id;
            
            -- Lấy Partner ID (Khách hàng) để báo cáo biết bán cho ai
            -- (Giả sử customer_id trong bảng orders là BIGINT hoặc UUID, cần ép kiểu nếu cần)
            v_partner_id := NEW.customer_id; 

            -- Duyệt từng sản phẩm trong đơn
            FOR v_item IN SELECT * FROM public.order_items WHERE order_id = NEW.id
            LOOP
                -- 1. Tính tổng lượng cần trừ (Base Unit)
                v_deduct_qty := v_item.quantity * COALESCE(v_item.conversion_factor, 1);

                -- 2. LẤY GIÁ VỐN (COGS)
                -- Ưu tiên 1: Lấy từ bảng products (actual_cost)
                SELECT COALESCE(actual_cost, 0) INTO v_unit_cost
                FROM public.products
                WHERE id = v_item.product_id;

                -- 3. GHI NHẬT KÝ GIAO DỊCH (INVENTORY LOGGING) - SENKO REQUESTED ⭐️
                INSERT INTO public.inventory_transactions (
                    warehouse_id,
                    product_id,
                    quantity,       -- Số âm để thể hiện xuất kho
                    type,           -- 'sale_order'
                    ref_id,         -- Mã đơn hàng (VD: SO-1234)
                    description,    -- 'Xuất bán đơn hàng ...'
                    created_at,
                    action_group,   -- 'SALE' (Để lọc báo cáo P&L)
                    unit_price,     -- Giá vốn (COGS)
                    partner_id      -- Khách hàng mua
                    -- Cột total_value sẽ tự động tính = quantity * unit_price (Do Generated Column)
                ) VALUES (
                    v_warehouse_id,
                    v_item.product_id,
                    -v_deduct_qty,  -- Quan trọng: Dấu âm
                    'sale_order',
                    NEW.code,       -- Mã đơn hàng làm Ref ID
                    'Xuất bán đơn hàng ' || NEW.code,
                    NOW(),
                    'SALE',         -- Group Action
                    v_unit_cost,    -- Giá vốn
                    v_partner_id
                );

                -- 4. TRỪ TỒN KHO TỔNG (product_inventory)
                UPDATE public.product_inventory
                SET stock_quantity = stock_quantity - v_deduct_qty,
                    updated_at = NOW()
                WHERE warehouse_id = v_warehouse_id 
                  AND product_id = v_item.product_id;

                -- 5. TRỪ TỒN KHO LÔ (inventory_batches) - FEFO
                v_remaining_qty_needed := v_deduct_qty;

                FOR v_batch_record IN 
                    SELECT b.id, b.quantity 
                    FROM public.inventory_batches b
                    JOIN public.batches batch_info ON b.batch_id = batch_info.id
                    WHERE b.warehouse_id = v_warehouse_id
                      AND b.product_id = v_item.product_id
                      AND b.quantity > 0
                    ORDER BY batch_info.expiry_date ASC NULLS LAST, batch_info.created_at ASC
                LOOP
                    IF v_remaining_qty_needed <= 0 THEN EXIT; END IF;

                    IF v_batch_record.quantity >= v_remaining_qty_needed THEN
                        -- Lô này đủ hàng -> Trừ phần cần thiết
                        UPDATE public.inventory_batches
                        SET quantity = quantity - v_remaining_qty_needed, updated_at = NOW()
                        WHERE id = v_batch_record.id;
                        
                        v_remaining_qty_needed := 0;
                    ELSE
                        -- Lô này không đủ -> Trừ sạch lô này
                        UPDATE public.inventory_batches
                        SET quantity = 0, updated_at = NOW()
                        WHERE id = v_batch_record.id;
                        
                        v_remaining_qty_needed := v_remaining_qty_needed - v_batch_record.quantity;
                    END IF;
                END LOOP;

            END LOOP;
        END IF;

        RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."handle_order_inventory_deduction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_sales_inventory_deduction"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    BEGIN
        -- [CORE FIX]: Đã vô hiệu hóa logic trừ kho tại đây.
        -- Việc trừ kho và ghi nhận giá vốn sẽ được thực hiện tại hàm confirm_outbound_packing (lúc đóng gói).
        -- Trigger này hiện tại chỉ đóng vai trò placeholder để không gây lỗi hệ thống.
        RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."handle_sales_inventory_deduction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handover_to_shipping"("p_order_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_current_status TEXT;
    BEGIN
        -- 1. Kiểm tra trạng thái
        SELECT status INTO v_current_status FROM public.orders WHERE id = p_order_id;

        IF v_current_status != 'PACKED' THEN
            RAISE EXCEPTION 'Đơn hàng chưa đóng gói xong (Phải là PACKED). Trạng thái hiện tại: %', v_current_status;
        END IF;

        -- 2. Update sang SHIPPING
        UPDATE public.orders
        SET status = 'SHIPPING',
            updated_at = NOW()
            -- Có thể thêm cột shipped_at vào bảng orders nếu cần thiết sau này
        WHERE id = p_order_id;

        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Đã bàn giao cho đơn vị vận chuyển.'
        );
    END;
    $$;


ALTER FUNCTION "public"."handover_to_shipping"("p_order_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handover_to_shipping"("p_order_id" "uuid") IS 'V5: Chuyển trạng thái từ PACKED -> SHIPPING (Đã đi)';



CREATE OR REPLACE FUNCTION "public"."import_customers_b2b"("p_customers_array" "jsonb"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        customer_data JSONB;
        v_customer_code_from_excel TEXT;
        v_final_customer_code TEXT;
        v_customer_b2b_id BIGINT;
        v_sales_staff_id UUID;
        v_initial_debt NUMERIC;
        v_success_count INT := 0;
    BEGIN
        FOREACH customer_data IN ARRAY p_customers_array
        LOOP
            -- A. TÌM NHÂN VIÊN SALE (Qua Email)
            v_sales_staff_id := NULL;
            IF customer_data->>'sales_staff_email' IS NOT NULL AND customer_data->>'sales_staff_email' <> '' THEN
                SELECT id INTO v_sales_staff_id 
                FROM public.users 
                WHERE email = TRIM(customer_data->>'sales_staff_email')
                LIMIT 1;
            END IF;

            -- B. XỬ LÝ MÃ KHÁCH HÀNG
            v_customer_code_from_excel := customer_data->>'customer_code';
            
            -- Nếu Excel rỗng mã -> Tự sinh B2B-XXXXX
            SELECT COALESCE(
                NULLIF(TRIM(v_customer_code_from_excel), ''), 
                'B2B-' || (nextval(pg_get_serial_sequence('public.customers_b2b', 'id')) + 10000)
            ) INTO v_final_customer_code;

            -- C. UPSERT KHÁCH HÀNG (Bảng customers_b2b)
            INSERT INTO public.customers_b2b (
                customer_code, name, tax_code, debt_limit, payment_term, 
                sales_staff_id, status, phone, email, vat_address, shipping_address,
                bank_name, bank_account_name, bank_account_number,
                loyalty_points
            ) VALUES (
                v_final_customer_code,
                customer_data->>'name',
                customer_data->>'tax_code',
                COALESCE((customer_data->>'debt_limit')::NUMERIC, 0),
                COALESCE((customer_data->>'payment_term')::INT, 0),
                v_sales_staff_id,
                'active',
                customer_data->>'phone',
                customer_data->>'email',
                customer_data->>'address', 
                customer_data->>'address',
                customer_data->>'bank_name',
                customer_data->>'bank_account_name',
                customer_data->>'bank_account_number',
                0 
            )
            ON CONFLICT (customer_code) 
            DO UPDATE SET
                name = EXCLUDED.name,
                phone = EXCLUDED.phone,
                email = EXCLUDED.email,
                updated_at = now()
            RETURNING id INTO v_customer_b2b_id;

            -- D. XỬ LÝ LIÊN HỆ
            IF customer_data->>'contact_person_name' IS NOT NULL THEN
                INSERT INTO public.customer_b2b_contacts (
                    customer_b2b_id, name, phone, position, is_primary
                ) VALUES (
                    v_customer_b2b_id,
                    customer_data->>'contact_person_name',
                    COALESCE(customer_data->>'contact_person_phone', customer_data->>'phone'),
                    'Liên hệ chính',
                    true
                )
                ON CONFLICT DO NOTHING; 
            END IF;

            -- E. XỬ LÝ NỢ CŨ (MIGRATION ORDER) 
            -- Logic: Tạo đơn hàng đã giao nhưng chưa trả tiền (Unpaid)
            v_initial_debt := COALESCE((customer_data->>'initial_debt')::NUMERIC, 0);
            
            IF v_initial_debt > 0 THEN
                INSERT INTO public.orders (
                    code,
                    customer_id,        -- Link vào khách B2B
                    customer_b2c_id,    -- NULL (Vì đây là B2B)
                    
                    -- [CÁC CỘT QUAN TRỌNG SẾP ĐÃ CONFIRM]
                    order_type,         -- 'B2B'
                    status,             -- 'DELIVERED' (Đã giao hàng)
                    payment_status,     -- 'unpaid' (Chưa trả -> Nợ)
                    
                    total_amount,
                    final_amount,
                    paid_amount,        -- = 0
                    discount_amount,
                    shipping_fee,
                    
                    payment_method,     -- 'debt' (Ghi nợ)
                    
                    -- [QUAN TRỌNG]: Set deposited để KHÔNG hiện ở màn hình "Nộp tiền" của nhân viên
                    remittance_status,  
                    
                    created_at,
                    updated_at,
                    note
                ) VALUES (
                    'MIGRATE-' || v_final_customer_code,
                    v_customer_b2b_id,
                    NULL,
                    'B2B',              -- order_type
                    'DELIVERED',        -- status
                    'unpaid',           -- payment_status
                    v_initial_debt,
                    v_initial_debt,
                    0,                  -- paid_amount
                    0, 0,
                    'debt',             -- payment_method
                    'deposited',        -- remittance_status (Đã xử lý xong tiền nong)
                    NOW(),
                    NOW(),
                    'Dư nợ đầu kỳ chuyển đổi hệ thống (Sapo Migration)'
                )
                ON CONFLICT (code) DO NOTHING;
            END IF;

            v_success_count := v_success_count + 1;
        END LOOP;

        RETURN jsonb_build_object('success', true, 'count', v_success_count);
    END;
    $$;


ALTER FUNCTION "public"."import_customers_b2b"("p_customers_array" "jsonb"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."import_customers_b2b"("p_customers_array" "jsonb"[]) IS 'Core V4: Import B2B chuẩn Schema (Có order_type, payment_status)';



CREATE OR REPLACE FUNCTION "public"."import_opening_stock_v3_by_id"("p_warehouse_id" bigint, "p_user_id" "uuid", "p_stock_array" "jsonb"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_item JSONB;
        v_product_id BIGINT;
        v_qty_input NUMERIC;
        v_qty_final NUMERIC;
        v_unit_price_input NUMERIC;
        v_unit_price_base NUMERIC;
        v_lot_code TEXT;
        v_exp_date DATE;
        v_batch_id BIGINT;
        v_conversion_rate INTEGER;
        v_total_items INTEGER := 0;
        v_receipt_code TEXT;
        v_receipt_id BIGINT;
    BEGIN
        -- 1. Validate
        IF p_warehouse_id IS NULL THEN
            RAISE EXCEPTION 'Chưa chọn kho nhập liệu.';
        END IF;

        -- 2. Tạo Header (Phiếu Nhập Tồn)
        v_receipt_code := 'OPENING-' || TO_CHAR(NOW(), 'YYMMDD-HH24MI') || '-' || FLOOR(RANDOM() * 1000)::TEXT;
        
        -- Lưu ý: Trigger calculate_receipt_totals sẽ tự động tính final_amount sau khi insert items
        INSERT INTO public.inventory_receipts (
            code, warehouse_id, receipt_date, status, creator_id, created_at, note
        ) VALUES (
            v_receipt_code, p_warehouse_id, NOW(), 'completed', p_user_id, NOW(), 'Nhập tồn đầu kỳ'
        ) RETURNING id INTO v_receipt_id;

        -- 3. Loop Items
        FOREACH v_item IN ARRAY p_stock_array
        LOOP
            v_product_id := (v_item->>'product_id')::BIGINT;
            v_qty_input  := COALESCE((v_item->>'quantity')::NUMERIC, 0);
            v_unit_price_input := COALESCE((v_item->>'cost_price')::NUMERIC, 0); -- Giá vốn đầu vào
            v_lot_code   := NULLIF(TRIM(v_item->>'batch_name'), '');
            
            -- A. Quy đổi đơn vị (Số lượng & Giá)
            IF (v_item->>'is_large_unit')::BOOLEAN = true THEN
                SELECT conversion_rate INTO v_conversion_rate
                FROM public.product_units
                WHERE product_id = v_product_id AND conversion_rate > 1
                ORDER BY conversion_rate DESC LIMIT 1;
                v_conversion_rate := COALESCE(v_conversion_rate, 1);
            ELSE
                v_conversion_rate := 1;
            END IF;

            v_qty_final := v_qty_input * v_conversion_rate;
            
            -- Tính giá vốn cơ sở (Base Cost) = Giá nhập / Hệ số
            IF v_conversion_rate > 0 THEN
                v_unit_price_base := v_unit_price_input / v_conversion_rate;
            ELSE
                v_unit_price_base := v_unit_price_input;
            END IF;

            -- B. Xử lý Date
            BEGIN
                IF (v_item->>'expiry_date') IS NOT NULL AND (v_item->>'expiry_date') <> '' THEN
                     v_exp_date := (v_item->>'expiry_date')::DATE;
                ELSE
                     v_exp_date := NULL;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_exp_date := NULL;
            END;

            IF v_qty_final > 0 THEN
                
                -- C. Xử lý Batch (Tìm hoặc Tạo & Cập nhật giá vốn lô)
                IF v_lot_code IS NULL THEN v_lot_code := 'DEFAULT-OPENING'; END IF;

                SELECT id INTO v_batch_id 
                FROM public.batches 
                WHERE product_id = v_product_id AND batch_code = v_lot_code;

                IF v_batch_id IS NULL THEN
                    INSERT INTO public.batches (product_id, batch_code, expiry_date, inbound_price, created_at) 
                    VALUES (v_product_id, v_lot_code, COALESCE(v_exp_date, '2099-12-31'::DATE), v_unit_price_base, NOW()) 
                    RETURNING id INTO v_batch_id;
                ELSE
                    -- Nếu lô đã có, cập nhật lại giá vốn
                    UPDATE public.batches SET inbound_price = v_unit_price_base WHERE id = v_batch_id;
                END IF;

                -- D. Cập nhật Tồn kho chi tiết (Inventory Batches)
                INSERT INTO public.inventory_batches (
                    warehouse_id, product_id, batch_id, quantity, updated_at
                ) VALUES (
                    p_warehouse_id, v_product_id, v_batch_id, v_qty_final, NOW()
                )
                ON CONFLICT (warehouse_id, product_id, batch_id) 
                DO UPDATE SET 
                    quantity = public.inventory_batches.quantity + EXCLUDED.quantity,
                    updated_at = NOW();

                -- E. Ghi Sổ Cái (Inventory Transactions - Tài chính kho)
                INSERT INTO public.inventory_transactions (
                    warehouse_id, product_id, batch_id, type, action_group, quantity, unit_price, ref_id, description, created_at, created_by
                ) VALUES (
                    p_warehouse_id, v_product_id, v_batch_id, 'opening_stock', 'IMPORT', v_qty_final, v_unit_price_base, v_receipt_code, 'Nhập tồn đầu kỳ', NOW(), p_user_id
                );

                -- F. [QUAN TRỌNG NHẤT] Ghi chi tiết phiếu nhập kèm GIÁ (Phục vụ đối chiếu công nợ/tồn kho)
                INSERT INTO public.inventory_receipt_items (
                    receipt_id, product_id, quantity, lot_number, expiry_date, 
                    unit_price, discount_amount
                ) VALUES (
                    v_receipt_id, v_product_id, v_qty_final, v_lot_code, v_exp_date,
                    v_unit_price_base, 0 
                );
                
                -- G. Cập nhật giá vốn tham khảo cho sản phẩm (Nếu chưa có)
                IF v_unit_price_base > 0 THEN
                    UPDATE public.products SET actual_cost = v_unit_price_base, updated_at = NOW()
                    WHERE id = v_product_id AND (actual_cost IS NULL OR actual_cost = 0);
                END IF;

                v_total_items := v_total_items + 1;
            END IF;
        END LOOP;

        RETURN jsonb_build_object('success', true, 'imported_count', v_total_items, 'receipt_code', v_receipt_code);
    END;
    $$;


ALTER FUNCTION "public"."import_opening_stock_v3_by_id"("p_warehouse_id" bigint, "p_user_id" "uuid", "p_stock_array" "jsonb"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_product_from_ai"("p_data" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_product_id BIGINT;
        v_unit JSONB;
        v_marketing JSONB;
        v_items_per_carton INTEGER := 1; -- Mặc định là 1 nếu không tìm thấy thùng
    BEGIN
        -- 1. TÍNH TOÁN ITEMS_PER_CARTON
        -- Logic: Tìm trong mảng units, nếu có type 'wholesale' (thùng/hộp to) thì lấy rate làm quy cách thùng
        FOR v_unit IN SELECT * FROM jsonb_array_elements(COALESCE(p_data->'units', '[]'::jsonb))
        LOOP
            IF (v_unit->>'unit_type') = 'wholesale' THEN
                v_items_per_carton := COALESCE((v_unit->>'conversion_rate')::INTEGER, 1);
            END IF;
        END LOOP;

        -- 2. INSERT VÀO BẢNG PRODUCTS
        -- Chỉ insert các trường cơ bản và packing_spec, items_per_carton theo yêu cầu
        INSERT INTO public.products (
            name,
            manufacturer_name,
            registration_number,
            barcode,
            active_ingredient,
            usage_instructions,
            packing_spec,       -- [REQ 1] Lấy từ JSON
            items_per_carton,   -- [REQ 2] Đã tính toán ở trên
            
            -- Không có Auto SKU (để NULL hoặc theo JSON nếu có)
            -- Không có Hybrid Sync (retail_unit/wholesale_unit giữ mặc định DB)
            
            status,
            created_at
        )
        VALUES (
            p_data->>'product_name',
            p_data->>'manufacturer_name',
            p_data->>'registration_number',
            p_data->>'barcode',
            (p_data->'active_ingredients'->0->>'name'), 
            COALESCE(p_data->'usage_instructions', '{}'::jsonb),
            p_data->>'packing_spec', 
            v_items_per_carton,
            
            'active',
            NOW()
        )
        RETURNING id INTO v_product_id;

        -- 3. INSERT VÀO BẢNG ĐƠN VỊ (PRODUCT_UNITS)
        FOR v_unit IN SELECT * FROM jsonb_array_elements(COALESCE(p_data->'units', '[]'::jsonb))
        LOOP
            INSERT INTO public.product_units (
                product_id,
                unit_name,
                unit_type,
                conversion_rate,
                is_base_unit,
                price,
                barcode
            )
            VALUES (
                v_product_id,
                v_unit->>'unit_name',
                v_unit->>'unit_type',
                COALESCE((v_unit->>'conversion_rate')::NUMERIC, 1),
                COALESCE((v_unit->>'is_base')::BOOLEAN, false),
                COALESCE((v_unit->>'price')::NUMERIC, 0),
                v_unit->>'barcode'
            );
        END LOOP;

        -- 4. INSERT VÀO BẢNG CONTENT (CÓ KIỂM TRA ĐIỀU KIỆN)
        v_marketing := p_data->'marketing_content';

        -- [REQ 3] Explicitly check if marketing_content exists
        IF v_marketing IS NOT NULL AND v_marketing != 'null'::jsonb THEN
            INSERT INTO public.product_contents (
                product_id,
                channel,
                short_description,
                description_html, 
                seo_title,
                seo_description,
                seo_keywords,
                is_ai_generated,
                is_published
            )
            VALUES (
                v_product_id,
                'website',
                v_marketing->>'short_description',
                v_marketing->>'full_description_html',
                v_marketing->>'seo_title',
                v_marketing->>'seo_description',
                (SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(v_marketing->'seo_keywords', '[]'::jsonb)) t(x)),
                TRUE,
                TRUE
            )
            ON CONFLICT (product_id, channel) 
            DO UPDATE SET
                short_description = EXCLUDED.short_description,
                description_html = EXCLUDED.description_html,
                updated_at = NOW();
        END IF;

        RETURN v_product_id;
    END;
    $$;


ALTER FUNCTION "public"."import_product_from_ai"("p_data" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."import_product_from_ai"("p_data" "jsonb") IS 'Import AI Senko Version: Packing Spec + Items Per Carton + Safe Content Check';



CREATE OR REPLACE FUNCTION "public"."import_suppliers_bulk"("p_suppliers" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_item JSONB;
    v_supplier_id BIGINT;
    v_count INT := 0;
    v_debt NUMERIC;
    v_trans_code TEXT;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_suppliers)
    LOOP
        -- 1. Insert Supplier (Bỏ cột 'code')
        INSERT INTO public.suppliers (
            name, 
            tax_code, 
            address,
            contact_person, 
            phone, 
            email, 
            
            -- Thông tin Ngân hàng
            bank_name,
            bank_account,
            bank_holder,
            
            -- Thông tin Vận hành
            payment_term,
            delivery_method,
            
            status, 
            notes, 
            created_at
        ) VALUES (
            v_item->>'name',
            v_item->>'tax_code',
            v_item->>'address',
            v_item->>'contact_person',
            v_item->>'phone',
            v_item->>'email',
            
            v_item->>'bank_name',
            v_item->>'bank_account',
            v_item->>'bank_holder',
            
            v_item->>'payment_term', -- Lưu chuỗi text (VD: "30 ngày", "Gối đầu")
            v_item->>'delivery_method',
            
            'active', 
            v_item->>'notes',
            NOW()
        )
        RETURNING id INTO v_supplier_id;

        -- 2. Xử lý Công nợ đầu kỳ (Nếu có)
        BEGIN
            v_debt := COALESCE((v_item->>'current_debt')::NUMERIC, 0);
        EXCEPTION WHEN OTHERS THEN
            v_debt := 0; -- Nếu parse lỗi thì coi như 0
        END;

        IF v_debt > 0 THEN
            -- Sinh mã giao dịch tự động
            v_trans_code := 'CN-NCC-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || floor(random() * 1000)::text;

            INSERT INTO public.finance_transactions (
                code,
                partner_type, 
                partner_id, 
                partner_name_cache, -- Cache tên để hiển thị nhanh
                amount, 
                flow, 
                business_type, 
                status, 
                description, 
                created_by,
                created_at,
                fund_account_id -- Bắt buộc (Lấy quỹ mặc định ID=1 hoặc NULL tùy logic)
            ) VALUES (
                v_trans_code,
                'supplier', 
                v_supplier_id::TEXT, 
                v_item->>'name', -- Cache tên NCC
                v_debt, 
                'out', -- Flow OUT (Nợ phải trả)
                'opening_balance', -- Loại: Dư nợ đầu kỳ
                'completed', -- Đã ghi nhận
                'Dư nợ đầu kỳ (Import Excel)',
                auth.uid(),
                NOW(),
                1 -- [HARDCODE TEMPORARY]: Gán tạm vào Quỹ Tiền Mặt (hoặc Sếp cần tạo 1 Quỹ ảo "Công nợ"?) -> Tạm để 1 để ko lỗi constraint
            );
        END IF;

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$$;


ALTER FUNCTION "public"."import_suppliers_bulk"("p_suppliers" "jsonb") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."mark_notification_read"("p_noti_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
        UPDATE public.notifications
        SET is_read = true
        WHERE id = p_noti_id AND user_id = auth.uid();
    $$;


ALTER FUNCTION "public"."mark_notification_read"("p_noti_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_products_from_excel"("p_data" "jsonb") RETURNS TABLE("excel_name" "text", "excel_sku" "text", "product_id" bigint, "product_name" "text", "product_sku" "text", "similarity_score" real, "match_type" "text", "base_unit" "text", "retail_unit" "text", "wholesale_unit" "text", "retail_conversion_rate" integer, "wholesale_conversion_rate" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- 1. Cấu hình môi trường (Giữ nguyên)
    SET LOCAL statement_timeout = '300s';
    PERFORM set_limit(0.4); 

    RETURN QUERY
    WITH input_rows AS (
        SELECT 
            TRIM(BOTH FROM (elem->>'name')::text) AS raw_name,
            NULLIF(TRIM(BOTH FROM (elem->>'sku')::text), '') AS raw_sku
        FROM jsonb_array_elements(p_data) AS elem
    ),
    
    -- === GIỮ NGUYÊN 100% THUẬT TOÁN TÌM KIẾM CŨ ===
    matches AS (
        -- Tầng 1: SKU (Chỉ active)
        SELECT 
            i.raw_name, i.raw_sku, 
            p.id, p.name, p.sku, 
            1.0::real as score, 'sku_exact'::text as type
        FROM input_rows i
        JOIN public.products p ON LOWER(p.sku) = LOWER(i.raw_sku)
        WHERE i.raw_sku IS NOT NULL AND p.status = 'active'
        
        UNION ALL
        
        -- Tầng 2: Tên chính xác (Chưa khớp SKU)
        SELECT 
            i.raw_name, i.raw_sku, 
            p.id, p.name, p.sku, 
            0.95::real as score, 'name_exact'::text as type
        FROM input_rows i
        JOIN public.products p ON LOWER(p.name) = LOWER(i.raw_name)
        WHERE p.status = 'active'
          AND NOT EXISTS (SELECT 1 FROM public.products p2 WHERE LOWER(p2.sku) = LOWER(i.raw_sku))
        
        UNION ALL
        
        -- Tầng 3: Fuzzy (Chưa khớp SKU và Tên)
        SELECT 
            i.raw_name, i.raw_sku, 
            p.id, p.name, p.sku, 
            similarity(p.name, i.raw_name)::real as score, 
            'name_fuzzy'::text as type
        FROM input_rows i
        JOIN LATERAL (
            SELECT p_sub.id, p_sub.name, p_sub.sku
            FROM public.products p_sub
            WHERE p_sub.status = 'active' AND p_sub.name % i.raw_name
            ORDER BY similarity(p_sub.name, i.raw_name) DESC LIMIT 1
        ) p ON true
        WHERE NOT EXISTS (SELECT 1 FROM public.products p2 WHERE LOWER(p2.sku) = LOWER(i.raw_sku))
          AND NOT EXISTS (SELECT 1 FROM public.products p3 WHERE LOWER(p3.name) = LOWER(i.raw_name))
    )

    -- === KẾT HỢP DỮ LIỆU ĐƠN VỊ CHI TIẾT (ENRICH DATA) ===
    SELECT 
        m.raw_name,
        m.raw_sku,
        m.id,
        m.name,
        m.sku,
        m.score,
        m.type,
        
        -- 1. Base Unit
        COALESCE(p.retail_unit, 'Đơn vị') as base_unit, 
                
        -- 2. Retail Unit (Đơn vị Lẻ)
        p.retail_unit, 
        
        -- 3. Wholesale Unit (Đơn vị Buôn)
        p.wholesale_unit, 
        
        -- 4. Rate Retail (Tìm trong bảng product_units)
        COALESCE((
            SELECT conversion_rate 
            FROM public.product_units u 
            WHERE u.product_id = p.id AND u.unit_name = p.retail_unit 
            LIMIT 1
        ), 1) as retail_rate,

        -- 5. Rate Wholesale (Tìm trong bảng product_units)
        COALESCE((
            SELECT conversion_rate 
            FROM public.product_units u 
            WHERE u.product_id = p.id AND u.unit_name = p.wholesale_unit 
            LIMIT 1
        ), 1) as wholesale_rate

    FROM matches m
    JOIN public.products p ON m.id = p.id;

END;
$$;


ALTER FUNCTION "public"."match_products_from_excel"("p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_group"("p_permission_key" "text", "p_title" "text", "p_message" "text", "p_type" "text" DEFAULT 'info'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_user_id UUID;
    BEGIN
        -- Loop qua danh sách user có quyền này
        FOR v_user_id IN 
            SELECT DISTINCT ur.user_id
            FROM public.user_roles ur
            JOIN public.role_permissions rp ON ur.role_id = rp.role_id
            WHERE rp.permission_key = p_permission_key
        LOOP
            -- Gọi lại hàm cơ sở
            PERFORM public.send_notification(v_user_id, p_title, p_message, p_type);
        END LOOP;
    END;
    $$;


ALTER FUNCTION "public"."notify_group"("p_permission_key" "text", "p_title" "text", "p_message" "text", "p_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_group"("p_permission_key" "text", "p_title" "text", "p_message" "text", "p_type" "text") IS 'Gửi thông báo cho tất cả user nắm giữ quyền (permission_key) cụ thể';



CREATE OR REPLACE FUNCTION "public"."notify_sales_on_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_sales_staff_id UUID;
    v_partner_name TEXT;
BEGIN
    -- Khi phiếu thu hoàn tất
    IF NEW.flow = 'in' 
       AND NEW.status = 'completed' 
       AND (OLD.status IS NULL OR OLD.status != 'completed') 
    THEN
        
        -- Tìm Sales phụ trách khách hàng này (Chỉ áp dụng B2B)
        IF NEW.partner_type = 'customer_b2b' THEN
            -- Lấy Sales ID và Tên khách
            SELECT sales_staff_id, name INTO v_sales_staff_id, v_partner_name
            FROM public.customers_b2b 
            WHERE id = NEW.partner_id::BIGINT;

            -- Gửi thông báo nếu có Sales phụ trách
            IF v_sales_staff_id IS NOT NULL THEN
                INSERT INTO public.notifications (user_id, title, message, type, is_read, created_at)
                VALUES (
                    v_sales_staff_id,
                    'Tiền về! 💰',
                    'Khách hàng ' || COALESCE(v_partner_name, 'B2B') || ' vừa thanh toán ' || to_char(NEW.amount, 'FM999,999,999') || 'đ.',
                    'success',
                    false,
                    NOW()
                );
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_sales_on_payment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_users_by_permission"("p_permission_key" "text", "p_title" "text", "p_message" "text", "p_type" "text" DEFAULT 'info'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    BEGIN
        -- Tìm tất cả user có quyền tương ứng và insert thông báo
        INSERT INTO public.notifications (user_id, title, message, type, created_at, is_read)
        SELECT DISTINCT ur.user_id, p_title, p_message, p_type, NOW(), false
        FROM public.role_permissions rp
        JOIN public.user_roles ur ON rp.role_id = ur.role_id
        WHERE rp.permission_key = p_permission_key;
    END;
    $$;


ALTER FUNCTION "public"."notify_users_by_permission"("p_permission_key" "text", "p_title" "text", "p_message" "text", "p_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pay_purchase_order_via_wallet"("p_po_id" bigint, "p_amount" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_po_record RECORD;
    v_wallet_balance NUMERIC;
    v_new_paid NUMERIC;
    v_remaining_po_debt NUMERIC;
    v_supplier_id BIGINT;
    v_supplier_name TEXT;
    v_clearing_fund_id BIGINT;
    v_po_code TEXT;
BEGIN
    -- A. Lấy ID Quỹ Cấn Trừ
    SELECT id INTO v_clearing_fund_id FROM public.fund_accounts WHERE name = 'Cấn trừ công nợ' LIMIT 1;
    -- Fallback nếu không có (hiếm) thì lấy quỹ đầu tiên
    IF v_clearing_fund_id IS NULL THEN SELECT id INTO v_clearing_fund_id FROM public.fund_accounts LIMIT 1; END IF;

    -- B. Validate & Lock PO
    SELECT po.*, s.name as supplier_name 
    INTO v_po_record 
    FROM public.purchase_orders po
    JOIN public.suppliers s ON po.supplier_id = s.id
    WHERE po.id = p_po_id 
    FOR UPDATE;

    IF v_po_record IS NULL THEN 
        RAISE EXCEPTION 'Không tìm thấy đơn mua hàng ID %', p_po_id; 
    END IF;

    v_supplier_id := v_po_record.supplier_id;
    v_supplier_name := v_po_record.supplier_name;
    v_po_code := v_po_record.code;

    -- C. Validate & Lock Wallet
    SELECT balance INTO v_wallet_balance 
    FROM public.supplier_wallets 
    WHERE supplier_id = v_supplier_id 
    FOR UPDATE;

    IF v_wallet_balance IS NULL OR v_wallet_balance < p_amount THEN
        RAISE EXCEPTION 'Số dư Ví NCC không đủ để cấn trừ (Hiện có: %, Cần chi: %)', 
            TO_CHAR(COALESCE(v_wallet_balance, 0), 'FM999,999,999'), 
            TO_CHAR(p_amount, 'FM999,999,999');
    END IF;

    -- D. Validate Amount
    v_remaining_po_debt := v_po_record.final_amount - COALESCE(v_po_record.total_paid, 0);
    
    IF p_amount > (v_remaining_po_debt + 1000) THEN -- Cho phép sai số 1000đ
        RAISE EXCEPTION 'Số tiền cấn trừ (%) lớn hơn số tiền còn nợ của đơn hàng (%)', 
            TO_CHAR(p_amount, 'FM999,999,999'), 
            TO_CHAR(v_remaining_po_debt, 'FM999,999,999');
    END IF;

    -- E. THỰC THI 1: Trừ tiền trong Ví NCC
    UPDATE public.supplier_wallets
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE supplier_id = v_supplier_id;

    -- F. THỰC THI 2: Update PO
    v_new_paid := COALESCE(v_po_record.total_paid, 0) + p_amount;
    
    UPDATE public.purchase_orders
    SET total_paid = v_new_paid,
        payment_status = CASE 
            WHEN v_new_paid >= (final_amount - 500) THEN 'paid' 
            ELSE 'partial' 
        END,
        note = COALESCE(note, '') || E'\n[HỆ THỐNG]: Đã cấn trừ Ví NCC: ' || TO_CHAR(p_amount, 'FM999,999,999') || ' đ vào lúc ' || TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI'),
        updated_at = NOW()
    WHERE id = p_po_id;

    -- G. THỰC THI 3: [CORE ADDED] Tạo giao dịch tài chính để Cân Bằng Báo Cáo
    -- Giao dịch này sẽ ghi nhận là "Đã trả cho NCC", làm giảm công nợ trong báo cáo V33.6
    INSERT INTO public.finance_transactions (
        code,
        partner_type, partner_id, partner_name_cache,
        amount, flow, business_type, status,
        fund_account_id, -- Gắn vào quỹ ảo
        ref_type, ref_id,
        description, created_by, created_at
    ) VALUES (
        'OFFSET-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || floor(random() * 1000)::text,
        'supplier', v_supplier_id::TEXT, v_supplier_name,
        p_amount, 
        'out', -- Chi tiền (giảm nợ)
        'other', -- Hoặc tạo type 'offset' nếu muốn kỹ hơn
        'completed',
        v_clearing_fund_id, -- Quỹ ảo
        'purchase_order', v_po_id::TEXT,
        'Cấn trừ công nợ từ Ví NCC cho đơn ' || v_po_code,
        auth.uid(),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Đã cấn trừ thành công.',
        'new_wallet_balance', (v_wallet_balance - p_amount),
        'new_po_paid', v_new_paid
    );
END;
$$;


ALTER FUNCTION "public"."pay_purchase_order_via_wallet"("p_po_id" bigint, "p_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_inbound_receipt"("p_po_id" bigint, "p_warehouse_id" bigint, "p_items" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
        v_receipt_id BIGINT;
        v_item JSONB;
        v_product_id BIGINT;
        v_qty_input NUMERIC;
        v_qty_base INTEGER;
        v_conversion_rate INTEGER;
        v_unit_name TEXT;
        v_unit_price NUMERIC;
        
        v_lot_no TEXT;
        v_exp_date DATE;
        v_batch_id BIGINT;
        v_po_code TEXT;
        v_po_supplier_id BIGINT;
        
        v_total_ordered NUMERIC;
        v_total_received NUMERIC;
        v_new_status TEXT;
    BEGIN
        -- A. Lấy thông tin PO
        SELECT code, supplier_id INTO v_po_code, v_po_supplier_id FROM public.purchase_orders WHERE id = p_po_id;

        -- B. Tạo Phiếu Nhập
        INSERT INTO public.inventory_receipts (
            code, po_id, warehouse_id, receipt_date, status, creator_id, created_at
        ) VALUES (
            'PNK-' || to_char(now(), 'YYMMDD') || '-' || floor(random() * 10000)::text,
            p_po_id, p_warehouse_id, now(), 'completed', auth.uid(), now()
        ) RETURNING id INTO v_receipt_id;

        -- C. Loop Items
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_product_id := (v_item->>'product_id')::BIGINT;
            v_qty_input  := COALESCE((v_item->>'quantity')::NUMERIC, 0);
            v_unit_name  := v_item->>'unit';
            v_lot_no     := NULLIF(trim(v_item->>'lot_number'), '');
            v_exp_date   := (v_item->>'expiry_date')::DATE;
            v_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, 0); -- Giá nhập

            IF v_qty_input <= 0 THEN CONTINUE; END IF;

            -- 1. TÌM TỶ LỆ QUY ĐỔI (QUAN TRỌNG)
            -- Tìm trong bảng product_units xem đơn vị nhập vào (Thùng) đổi ra bao nhiêu Base (Viên)
            SELECT conversion_rate INTO v_conversion_rate
            FROM public.product_units
            WHERE product_id = v_product_id AND unit_name = v_unit_name
            LIMIT 1;

            -- Fallback: Nếu không tìm thấy hoặc là Base Unit, rate = 1
            IF v_conversion_rate IS NULL THEN v_conversion_rate := 1; END IF;

            -- Tính số lượng Base để lưu kho
            v_qty_base := (v_qty_input * v_conversion_rate)::INTEGER;

            -- 2. Xử lý Lô (Batch) & Giá vốn
            -- Giá vốn lưu vào lô phải là Giá Base (Giá 1 viên)
            IF v_lot_no IS NULL THEN v_lot_no := 'DEFAULT-' || to_char(now(), 'YYYYMMDD'); END IF;

            SELECT id INTO v_batch_id FROM public.batches 
            WHERE product_id = v_product_id AND batch_code = v_lot_no;

            IF v_batch_id IS NULL THEN
                INSERT INTO public.batches (product_id, batch_code, expiry_date, inbound_price, created_at)
                VALUES (v_product_id, v_lot_no, COALESCE(v_exp_date, '2099-12-31'::DATE), (v_unit_price / v_conversion_rate), NOW())
                RETURNING id INTO v_batch_id;
            ELSE
                -- Update giá vốn mới nhất
                UPDATE public.batches SET inbound_price = (v_unit_price / v_conversion_rate) WHERE id = v_batch_id;
            END IF;

            -- 3. Cộng Tồn kho (Inventory Batches) - Luôn cộng số Base
            INSERT INTO public.inventory_batches (warehouse_id, product_id, batch_id, quantity)
            VALUES (p_warehouse_id, v_product_id, v_batch_id, v_qty_base)
            ON CONFLICT (warehouse_id, product_id, batch_id)
            DO UPDATE SET quantity = inventory_batches.quantity + EXCLUDED.quantity, updated_at = now();

            -- 4. Ghi Sổ Kho (Transactions)
            INSERT INTO public.inventory_transactions (
                warehouse_id, product_id, batch_id, type, action_group, quantity, unit_price, ref_id, description, partner_id, created_by
            ) VALUES (
                p_warehouse_id, v_product_id, v_batch_id, 'purchase_order', 'IMPORT', 
                v_qty_base, (v_unit_price / v_conversion_rate), 
                v_po_code, 'Nhập kho PO', v_po_supplier_id, auth.uid()
            );

            -- 5. Lưu chi tiết phiếu nhập (Receipt Items) - Lưu cả SL nhập và SL quy đổi
            -- Schema inventory_receipt_items cần có cột quantity (base). Ta tạm lưu quantity base.
            -- (Tốt nhất nên mở rộng bảng này sau, nhưng hiện tại lưu Base là chuẩn nhất để tính toán)
            INSERT INTO public.inventory_receipt_items (
                receipt_id, product_id, quantity, lot_number, expiry_date, unit_price
            ) VALUES (
                v_receipt_id, v_product_id, v_qty_base, v_lot_no, v_exp_date, (v_unit_price / v_conversion_rate)
            );

            -- 6. Update PO Items (Số lượng đã nhận) - Lưu ý PO Items thường lưu Base Quantity nếu thiết kế chuẩn
            UPDATE public.purchase_order_items
            SET quantity_received = COALESCE(quantity_received, 0) + v_qty_input -- Cộng theo đơn vị đặt hàng (nếu PO items lưu theo đơn vị đặt)
            WHERE po_id = p_po_id AND product_id = v_product_id;
            
        END LOOP;

        -- D. Cập nhật trạng thái PO
        SELECT SUM(quantity_ordered), SUM(COALESCE(quantity_received, 0))
        INTO v_total_ordered, v_total_received
        FROM public.purchase_order_items WHERE po_id = p_po_id;

        IF v_total_received >= v_total_ordered THEN v_new_status := 'delivered';
        ELSIF v_total_received > 0 THEN v_new_status := 'partial';
        ELSE v_new_status := 'pending'; END IF;

        UPDATE public.purchase_orders SET delivery_status = v_new_status, updated_at = now() WHERE id = p_po_id;

        RETURN jsonb_build_object('success', true, 'receipt_id', v_receipt_id);
    END;
    $$;


ALTER FUNCTION "public"."process_inbound_receipt"("p_po_id" bigint, "p_warehouse_id" bigint, "p_items" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_inbound_receipt"("p_po_id" bigint, "p_warehouse_id" bigint, "p_items" "jsonb") IS 'Xử lý nhập kho 3-trong-1: Tạo phiếu, Update Batch/Kho, Update PO Status';



CREATE OR REPLACE FUNCTION "public"."process_sales_invoice_deduction"("p_invoice_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_invoice_record RECORD;
    v_item JSONB;
    v_product_id BIGINT;
    v_unit_name TEXT;
    v_qty_input NUMERIC;
    v_vat_rate NUMERIC;
    
    v_conversion_rate INTEGER;
    v_base_unit_name TEXT;
    v_qty_deduct NUMERIC;
    v_current_balance NUMERIC;
BEGIN
    -- A. Lấy thông tin hóa đơn bán ra
    SELECT * INTO v_invoice_record FROM public.sales_invoices WHERE id = p_invoice_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Hóa đơn bán ra ID % không tồn tại', p_invoice_id; END IF;

    -- B. Duyệt từng dòng sản phẩm trên hóa đơn
    -- Giả sử cấu trúc JSON items: [{ "product_id": 1, "unit": "Hộp", "quantity": 5, "vat_rate": 8 }]
    -- (Sếp cần bảo Dev gửi đúng key 'unit' và 'vat_rate' trong json)
    
    -- Lưu ý: Cần xử lý linh động tên cột trong JSON (unit hoặc uom)
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_invoice_record.items_json, '[]'::jsonb))
    LOOP
        v_product_id := (v_item->>'product_id')::BIGINT;
        v_unit_name  := COALESCE(v_item->>'unit', v_item->>'uom'); -- Đơn vị bán (Vỉ/Hộp)
        v_qty_input  := COALESCE((v_item->>'quantity')::NUMERIC, 0);
        v_vat_rate   := COALESCE((v_item->>'vat_rate')::NUMERIC, 0); -- Thuế suất muốn xuất

        IF v_product_id IS NOT NULL AND v_qty_input > 0 THEN
            
            -- 1. TÌM TỶ LỆ QUY ĐỔI (QUAN TRỌNG: HỘP -> VIÊN)
            v_conversion_rate := 1; -- Mặc định

            -- Tìm trong bảng đơn vị
            SELECT conversion_rate INTO v_conversion_rate 
            FROM public.product_units 
            WHERE product_id = v_product_id AND LOWER(unit_name) = LOWER(v_unit_name)
            LIMIT 1;

            -- Nếu không thấy (hoặc là base), thử check lại xem có phải base unit không
            IF v_conversion_rate IS NULL THEN
                 SELECT conversion_rate INTO v_conversion_rate
                 FROM public.product_units
                 WHERE product_id = v_product_id AND is_base = true
                 LIMIT 1;
            END IF;
            
            v_conversion_rate := COALESCE(v_conversion_rate, 1);

            -- 2. TÍNH SỐ LƯỢNG BASE CẦN TRỪ
            v_qty_deduct := v_qty_input * v_conversion_rate;

            -- 3. KIỂM TRA TỒN KHO VAT (Theo đúng thuế suất)
            SELECT quantity_balance INTO v_current_balance
            FROM public.vat_inventory_ledger
            WHERE product_id = v_product_id AND vat_rate = v_vat_rate
            FOR UPDATE; -- Khóa dòng để tránh tranh chấp

            IF v_current_balance IS NULL OR v_current_balance < v_qty_deduct THEN
                RAISE EXCEPTION 'Kho VAT không đủ hàng để xuất! Sản phẩm ID: %, Thuế: % %%. Cần: % (base), Tồn: % (base).', 
                                v_product_id, v_vat_rate, v_qty_deduct, COALESCE(v_current_balance, 0);
            END IF;

            -- 4. THỰC HIỆN TRỪ KHO
            UPDATE public.vat_inventory_ledger
            SET quantity_balance = quantity_balance - v_qty_deduct,
                updated_at = NOW()
            WHERE product_id = v_product_id AND vat_rate = v_vat_rate;
            
            -- (Lưu ý: Ta chưa trừ total_value_balance ở đây vì xuất hóa đơn bán ra thường theo giá bán, 
            -- còn ledger lưu giá vốn. Việc tính giá vốn xuất kho VAT phức tạp hơn (FIFO/Bình quân).
            -- Ở V1, ta chấp nhận chỉ quản lý chặt SỐ LƯỢNG để không bị xuất khống).
            
        END IF;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."process_sales_invoice_deduction"("p_invoice_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_vat_invoice_entry"("p_invoice_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_invoice_record RECORD;
        v_item JSONB;
        v_product_id BIGINT;
        v_unit_name TEXT;
        v_qty_input NUMERIC;
        v_vat_rate NUMERIC;
        v_unit_price NUMERIC; -- [NEW]
        
        v_conversion_rate NUMERIC;
        v_qty_base NUMERIC;
        v_total_value NUMERIC; -- [NEW]
        v_base_unit_name TEXT;
    BEGIN
        SELECT * INTO v_invoice_record FROM public.finance_invoices WHERE id = p_invoice_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Hóa đơn ID % không tồn tại', p_invoice_id; END IF;

        -- Chỉ nhập kho nếu status hợp lệ (Logic tùy frontend, ở đây ta cứ xử lý nếu được gọi)
        
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_invoice_record.items_json)
        LOOP
            v_product_id := (v_item->>'product_id')::BIGINT;
            v_unit_name := v_item->>'internal_unit';
            v_qty_input := COALESCE((v_item->>'quantity')::NUMERIC, 0);
            v_vat_rate := COALESCE((v_item->>'vat_rate')::NUMERIC, 0);
            v_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, 0); -- Lấy đơn giá

            IF v_product_id IS NOT NULL AND v_qty_input > 0 THEN
                
                -- [LOGIC QUY ĐỔI]
                v_conversion_rate := NULL; -- Reset

                SELECT conversion_rate INTO v_conversion_rate 
                FROM public.product_units
                WHERE product_id = v_product_id AND LOWER(unit_name) = LOWER(v_unit_name) 
                LIMIT 1;

                IF v_conversion_rate IS NULL THEN
                     SELECT unit_name INTO v_base_unit_name 
                     FROM public.product_units 
                     WHERE product_id = v_product_id AND unit_type = 'base' 
                     LIMIT 1;
                     
                     IF LOWER(v_base_unit_name) = LOWER(v_unit_name) THEN 
                        v_conversion_rate := 1; 
                     END IF;
                END IF;

                -- Tính toán
                v_qty_base := v_qty_input * COALESCE(v_conversion_rate, 1);
                v_total_value := v_qty_input * v_unit_price; -- Tổng giá trị = Số lượng nhập * Đơn giá nhập

                -- [UPSERT CỘNG KHO]
                INSERT INTO public.vat_inventory_ledger (
                    product_id, vat_rate, quantity_balance, total_value_balance, updated_at
                )
                VALUES (
                    v_product_id, v_vat_rate, v_qty_base, v_total_value, NOW()
                )
                ON CONFLICT (product_id, vat_rate) 
                DO UPDATE SET 
                    quantity_balance = vat_inventory_ledger.quantity_balance + EXCLUDED.quantity_balance,
                    total_value_balance = vat_inventory_ledger.total_value_balance + EXCLUDED.total_value_balance, -- Cộng dồn giá trị
                    updated_at = NOW();
            END IF;
        END LOOP;
    END;
    $$;


ALTER FUNCTION "public"."process_vat_invoice_entry"("p_invoice_id" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_vat_invoice_entry"("p_invoice_id" bigint) IS 'Nhập kho VAT: Cộng số lượng Base và Tổng giá trị tiền';



CREATE OR REPLACE FUNCTION "public"."quick_assign_barcode"("p_product_id" bigint, "p_unit_id" bigint, "p_barcode" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_clean_barcode TEXT;
    v_exists BOOLEAN;
    
    -- Biến để hứng dữ liệu sau update
    v_unit_name TEXT;
    v_is_base BOOLEAN;
    v_price NUMERIC;
    
    -- Biến để check logic đồng bộ bảng cha
    v_product_retail_unit TEXT;
BEGIN
    v_clean_barcode := TRIM(p_barcode);
    
    IF v_clean_barcode IS NULL OR v_clean_barcode = '' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mã vạch không được để trống!');
    END IF;

    -- A. CHECK TRÙNG LẶP (An toàn tuyệt đối)
    -- Check 1: Trùng với Unit khác (không tính chính nó)
    SELECT EXISTS(SELECT 1 FROM product_units WHERE barcode = v_clean_barcode AND id <> p_unit_id)
    INTO v_exists;
    
    IF v_exists THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mã vạch này đang thuộc về một đơn vị khác!');
    END IF;

    -- Check 2: Trùng với Product khác
    SELECT EXISTS(SELECT 1 FROM products WHERE barcode = v_clean_barcode AND id <> p_product_id)
    INTO v_exists;

    IF v_exists THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mã vạch này đang là mã chính của sản phẩm khác!');
    END IF;

    -- B. LẤY THÔNG TIN SẢN PHẨM (Để phục vụ logic đồng bộ)
    SELECT retail_unit INTO v_product_retail_unit
    FROM products WHERE id = p_product_id;

    -- C. CẬP NHẬT BẢNG CON (Product Units) - Dùng ID
    UPDATE public.product_units
    SET barcode = v_clean_barcode, 
        updated_at = NOW()
    WHERE id = p_unit_id
    RETURNING unit_name, is_base, price_sell INTO v_unit_name, v_is_base, v_price;

    IF v_unit_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy ID đơn vị này! Có thể đã bị xóa.');
    END IF;

    -- D. ĐỒNG BỘ BẢNG CHA (Products) - Logic thông minh
    -- Cập nhật bảng cha nếu:
    -- 1. Unit vừa gán là Base (Viên)
    -- 2. HOẶC Unit vừa gán trùng tên với Retail Unit (Vỉ)
    IF v_is_base = true OR v_unit_name = v_product_retail_unit THEN
        UPDATE public.products 
        SET barcode = v_clean_barcode, updated_at = NOW() 
        WHERE id = p_product_id;
    END IF;

    -- E. TRẢ VỀ DỮ LIỆU (Để FE auto-add vào giỏ hàng)
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
$$;


ALTER FUNCTION "public"."quick_assign_barcode"("p_product_id" bigint, "p_unit_id" bigint, "p_barcode" "text") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."recalculate_final_amount"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
    BEGIN
        NEW.final_amount := NEW.total_goods_amount - NEW.discount_order + NEW.shipping_fee + NEW.other_fee;
        RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."recalculate_final_amount"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_segment_members"("p_segment_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
        v_segment RECORD;
        v_criteria JSONB;
        v_sql TEXT;
    BEGIN
        -- A. Lấy thông tin phân khúc
        SELECT * INTO v_segment FROM public.customer_segments WHERE id = p_segment_id;
        
        -- Chỉ xử lý nếu tìm thấy và là nhóm 'dynamic'
        IF NOT FOUND OR v_segment.type = 'static' THEN 
            RETURN; 
        END IF;

        v_criteria := v_segment.criteria;

        -- B. Xây dựng câu Query động
        -- Khởi tạo câu Select cơ bản
        v_sql := format('SELECT %L::BIGINT, id FROM public.customers WHERE status = ''active'' ', p_segment_id);

        -- =================================================================
        -- C. CÁC TIÊU CHÍ LỌC (LOGIC CŨ & MỚI)
        -- =================================================================

        -- 1. Giới tính (Gender)
        IF v_criteria ? 'gender' THEN
            v_sql := v_sql || format(' AND gender = %L', v_criteria->>'gender');
        END IF;

        -- 2. Điểm tích lũy (Loyalty Points)
        IF v_criteria ? 'min_loyalty' THEN
            v_sql := v_sql || format(' AND loyalty_points >= %s', (v_criteria->>'min_loyalty')::int);
        END IF;

        -- 3. Tháng sinh nhật (Birthday)
        IF v_criteria ? 'birthday_month' THEN
            IF (v_criteria->>'birthday_month') = 'current' THEN
                v_sql := v_sql || ' AND EXTRACT(MONTH FROM dob::date) = EXTRACT(MONTH FROM CURRENT_DATE)';
            ELSE
                v_sql := v_sql || format(' AND EXTRACT(MONTH FROM dob::date) = %s', (v_criteria->>'birthday_month')::int);
            END IF;
        END IF;

        -- 4. Độ tuổi (Age)
        IF v_criteria ? 'min_age' THEN
            v_sql := v_sql || format(' AND EXTRACT(YEAR FROM age(dob::date)) >= %s', (v_criteria->>'min_age')::int);
        END IF;
        IF v_criteria ? 'max_age' THEN
            v_sql := v_sql || format(' AND EXTRACT(YEAR FROM age(dob::date)) <= %s', (v_criteria->>'max_age')::int);
        END IF;

        -- 5. [NEW] THỜI GIAN MUA HÀNG (RECENCY) - Mệnh Lệnh 43
        -- Ý nghĩa: Tìm khách hàng ĐÃ LÂU KHÔNG MUA (để chăm sóc lại)
        -- Logic: (Chưa từng mua) HOẶC (Lần mua cuối < Hiện tại - X tháng)
        IF v_criteria ? 'last_purchase_months' THEN
            v_sql := v_sql || format(
                ' AND (last_purchase_at IS NULL OR last_purchase_at < (NOW() - INTERVAL ''%s months''))', 
                (v_criteria->>'last_purchase_months')::int
            );
        END IF;

        -- =================================================================
        -- D. THỰC THI (EXECUTE)
        -- =================================================================
        
        -- Bước 1: Xóa thành viên cũ để làm mới
        DELETE FROM public.customer_segment_members WHERE segment_id = p_segment_id;

        -- Bước 2: Insert danh sách mới
        EXECUTE format('INSERT INTO public.customer_segment_members (segment_id, customer_id) %s', v_sql);

        -- Bước 3: Cập nhật thời gian chạy
        UPDATE public.customer_segments SET updated_at = NOW() WHERE id = p_segment_id;
    END;
    $$;


ALTER FUNCTION "public"."refresh_segment_members"("p_segment_id" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_segment_members"("p_segment_id" bigint) IS 'Engine phân khúc khách hàng (Updated: Recency Logic)';



CREATE OR REPLACE FUNCTION "public"."reverse_vat_invoice_entry"("p_invoice_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_invoice_record RECORD;
        v_item JSONB;
        v_product_id BIGINT;
        v_unit_name TEXT;
        v_qty_input NUMERIC;
        v_vat_rate NUMERIC;
        v_unit_price NUMERIC;
        
        -- Biến tính toán
        v_conversion_rate NUMERIC;
        v_qty_base NUMERIC;
        v_total_value NUMERIC;
        v_base_unit_name TEXT;
    BEGIN
        -- A. Lấy thông tin hóa đơn
        SELECT * INTO v_invoice_record FROM public.finance_invoices WHERE id = p_invoice_id;
        
        -- Nếu không tìm thấy hóa đơn, dừng luôn (không lỗi)
        IF NOT FOUND THEN RETURN; END IF;

        -- B. Chỉ thực hiện Trừ kho nếu hóa đơn đang ở trạng thái đã ghi sổ (ví dụ: 'verified' hoặc 'approved')
        -- Nếu hóa đơn đang 'pending' (chưa nhập kho) mà bị xóa thì không cần trừ.
        IF v_invoice_record.status <> 'verified' AND v_invoice_record.status <> 'approved' THEN 
            RETURN; 
        END IF;

        -- C. Duyệt từng dòng hàng để trừ ngược lại
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_invoice_record.items_json)
        LOOP
            v_product_id := (v_item->>'product_id')::BIGINT;
            v_unit_name := v_item->>'internal_unit';
            v_qty_input := COALESCE((v_item->>'quantity')::NUMERIC, 0);
            v_vat_rate := COALESCE((v_item->>'vat_rate')::NUMERIC, 0);
            v_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, 0);

            IF v_product_id IS NOT NULL AND v_qty_input > 0 THEN
                
                -- [LOGIC TÌM TỶ LỆ QUY ĐỔI - CONSISTENT WITH PROCESS FUNCTION]
                v_conversion_rate := NULL; -- Reset về NULL quan trọng

                -- C1. Tìm trong product_units
                SELECT conversion_rate INTO v_conversion_rate 
                FROM public.product_units
                WHERE product_id = v_product_id AND LOWER(unit_name) = LOWER(v_unit_name) 
                LIMIT 1;

                -- C2. Fallback Base Unit
                IF v_conversion_rate IS NULL THEN
                     SELECT unit_name INTO v_base_unit_name 
                     FROM public.product_units 
                     WHERE product_id = v_product_id AND unit_type = 'base' 
                     LIMIT 1;
                     
                     IF LOWER(v_base_unit_name) = LOWER(v_unit_name) THEN 
                        v_conversion_rate := 1; 
                     END IF;
                END IF;

                -- Tính toán lượng cần trừ
                v_qty_base := v_qty_input * COALESCE(v_conversion_rate, 1);
                v_total_value := v_qty_input * v_unit_price;

                -- D. UPDATE TRỪ KHO (Giảm số lượng và giá trị)
                UPDATE public.vat_inventory_ledger
                SET 
                    quantity_balance = quantity_balance - v_qty_base,
                    total_value_balance = total_value_balance - v_total_value,
                    updated_at = NOW()
                WHERE product_id = v_product_id AND vat_rate = v_vat_rate;
                
                -- Lưu ý: Nếu phép trừ này làm quantity_balance < 0, 
                -- DB sẽ throw lỗi vi phạm CHECK Constraint (quantity_balance >= 0).
                -- Điều này là ĐÚNG để bảo vệ dữ liệu (Không thể xóa hóa đơn nhập nếu hàng đã bị xuất bán).
            END IF;
        END LOOP;
    END;
    $$;


ALTER FUNCTION "public"."reverse_vat_invoice_entry"("p_invoice_id" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reverse_vat_invoice_entry"("p_invoice_id" bigint) IS 'Hoàn tác nhập kho VAT (Trừ kho) khi xóa/hủy hóa đơn';



CREATE OR REPLACE FUNCTION "public"."save_outbound_progress"("p_order_id" "uuid", "p_items" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_item JSONB;
        v_prod_id BIGINT;
        v_qty_picked INT;
    BEGIN
        -- Loop update từng dòng
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_prod_id := (v_item->>'product_id')::BIGINT;
            v_qty_picked := (v_item->>'quantity_picked')::INTEGER;

            UPDATE public.order_items
            SET quantity_picked = v_qty_picked
            WHERE order_id = p_order_id AND product_id = v_prod_id;
        END LOOP;

        -- Update timestamp đơn hàng
        UPDATE public.orders SET updated_at = NOW() WHERE id = p_order_id;

        RETURN jsonb_build_object('success', true, 'message', 'Đã lưu tiến độ nhặt hàng.');
    END;
    $$;


ALTER FUNCTION "public"."save_outbound_progress"("p_order_id" "uuid", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_customers_b2b_v2"("p_keyword" "text") RETURNS TABLE("id" bigint, "name" "text", "tax_code" "text", "vat_address" "text", "shipping_address" "text", "phone" "text", "debt_limit" numeric, "current_debt" numeric, "loyalty_points" integer, "contacts" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.tax_code,
        c.vat_address,
        c.shipping_address,
        c.phone,
        COALESCE(c.debt_limit, 0),
        
        -- Logic tính Nợ: Bây giờ cột final_amount và paid_amount đã chắc chắn tồn tại
        COALESCE((
            SELECT SUM(o.final_amount - o.paid_amount)
            FROM public.orders o
            WHERE o.customer_id = c.id 
              AND o.status NOT IN ('DRAFT', 'CANCELLED')
        ), 0) as current_debt,
        
        COALESCE(c.loyalty_points, 0),
        
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'name', cc.name,
                'phone', cc.phone,
                'position', cc.position,
                'is_primary', cc.is_primary
            ))
            FROM public.customer_b2b_contacts cc
            WHERE cc.customer_b2b_id = c.id
        ), '[]'::jsonb) as contacts
    FROM public.customers_b2b c
    WHERE 
        c.status = 'active'
        AND (
            p_keyword IS NULL OR p_keyword = '' OR
            c.name ILIKE '%' || p_keyword || '%' OR
            c.phone ILIKE '%' || p_keyword || '%' OR
            c.tax_code ILIKE '%' || p_keyword || '%' OR
            c.customer_code ILIKE '%' || p_keyword || '%'
        )
    ORDER BY c.name ASC
    LIMIT 20;
END;
$$;


ALTER FUNCTION "public"."search_customers_b2b_v2"("p_keyword" "text") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."search_customers_pos"("p_keyword" "text") RETURNS TABLE("id" bigint, "code" "text", "name" "text", "phone" "text", "type" "text", "debt_amount" numeric, "loyalty_points" integer, "sub_label" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_text_part TEXT;
        v_phone_part TEXT;
    BEGIN
        -- Parse Input
        v_phone_part := regexp_replace(p_keyword, '[^0-9]', '', 'g');
        v_text_part := trim(regexp_replace(p_keyword, '[0-9]', '', 'g'));
        
        IF v_phone_part = '' THEN v_phone_part := NULL; END IF;
        IF v_text_part = '' THEN v_text_part := NULL; END IF;

        IF v_phone_part IS NULL AND v_text_part IS NULL THEN RETURN; END IF;

        RETURN QUERY
        WITH matched_customers AS (
            -- 1. Cá nhân
            SELECT c.id, c.customer_code as code, c.name, c.phone, c.type::TEXT, c.loyalty_points,
                   NULL::TEXT as relation_info, 1 as priority
            FROM public.customers c
            WHERE c.status = 'active' AND c.type = 'CaNhan'
              AND (v_text_part IS NULL OR c.name ILIKE '%' || v_text_part || '%')
              AND (v_phone_part IS NULL OR c.phone ILIKE '%' || v_phone_part || '%')

            UNION ALL

            -- 2. Tổ chức (Qua người liên hệ)
            SELECT c.id, c.customer_code as code, c.name, c.phone, c.type::TEXT, c.loyalty_points,
                   'LH: ' || COALESCE(c.contact_person_name, 'N/A') as relation_info, 2 as priority
            FROM public.customers c
            WHERE c.status = 'active' AND c.type = 'ToChuc'
              AND (
                  (v_text_part IS NULL OR c.name ILIKE '%' || v_text_part || '%') AND (v_phone_part IS NULL OR c.phone ILIKE '%' || v_phone_part || '%')
                  OR
                  (v_text_part IS NULL OR c.contact_person_name ILIKE '%' || v_text_part || '%') AND (v_phone_part IS NULL OR c.contact_person_phone ILIKE '%' || v_phone_part || '%')
              )

            UNION ALL

            -- 3. Phụ huynh
            SELECT child.id, child.customer_code as code, child.name, child.phone, child.type::TEXT, child.loyalty_points,
                   'PH: ' || guardian.name || ' (' || guardian.phone || ')' as relation_info, 3 as priority
            FROM public.customers child
            JOIN public.customer_guardians cg ON child.id = cg.customer_id
            JOIN public.customers guardian ON cg.guardian_id = guardian.id
            WHERE child.status = 'active'
              AND (v_text_part IS NULL OR guardian.name ILIKE '%' || v_text_part || '%')
              AND (v_phone_part IS NULL OR guardian.phone ILIKE '%' || v_phone_part || '%')
        )
        SELECT 
            mc.id, mc.code, mc.name, mc.phone, mc.type,
            
            -- [FIXED] Tính nợ dựa trên customer_b2c_id và payment_status
            COALESCE((
                SELECT SUM(o.final_amount - o.paid_amount) 
                FROM public.orders o 
                WHERE o.customer_b2c_id = mc.id 
                AND o.status NOT IN ('DRAFT', 'CANCELLED', 'QUOTE')
                AND o.payment_status != 'paid' -- Cột mới đã có
            ), 0) AS debt_amount,
            
            mc.loyalty_points,
            CASE WHEN mc.relation_info IS NOT NULL THEN mc.relation_info WHEN mc.type = 'ToChuc' THEN 'Khách Doanh Nghiệp' ELSE 'Khách Lẻ' END AS sub_label
        FROM matched_customers mc
        GROUP BY mc.id, mc.code, mc.name, mc.phone, mc.type, mc.loyalty_points, mc.relation_info, mc.priority
        ORDER BY mc.priority ASC, mc.name ASC
        LIMIT 20;
    END;
    $$;


ALTER FUNCTION "public"."search_customers_pos"("p_keyword" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_customers_pos"("p_keyword" "text") IS 'Tìm kiếm POS thông minh: Cá nhân, Tổ chức (qua người LH), Phụ huynh (customer_guardians)';



CREATE OR REPLACE FUNCTION "public"."search_items_for_sales"("p_keyword" "text", "p_warehouse_id" bigint DEFAULT 1, "p_limit" integer DEFAULT 20) RETURNS TABLE("id" bigint, "type" "text", "sku" "text", "name" "text", "image_url" "text", "uom" "text", "uom_wholesale" "text", "stock_quantity" integer, "price_retail" numeric, "price_wholesale" numeric, "items_per_carton" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    -- 1. TÌM SẢN PHẨM (Sử dụng GIN Index 'fts' cực nhanh)
    SELECT 
        p.id,
        'product'::text as type,
        p.sku,
        p.name,
        p.image_url,
        p.retail_unit as uom,
        p.wholesale_unit as uom_wholesale,
        
        -- Lấy tồn kho tại kho chỉ định
        COALESCE((
            SELECT pi.stock_quantity 
            FROM public.product_inventory pi 
            WHERE pi.product_id = p.id AND pi.warehouse_id = p_warehouse_id
        ), 0) as stock_quantity,
        
        -- Tính giá lẻ (Giá vốn + Lãi lẻ)
        -- Logic: Nếu type = %, giá = vốn * (1 + lãi/100). Nếu type = tiền, giá = vốn + lãi
        CASE 
            WHEN p.retail_margin_type = '%' THEN p.actual_cost * (1 + p.retail_margin_value / 100)
            ELSE p.actual_cost + p.retail_margin_value
        END as price_retail,
        
        -- Tính giá buôn (Giá vốn + Lãi buôn) * Hệ số quy đổi (nếu bán thùng)
        -- Lưu ý: Đây là giá cho 1 đơn vị LẺ nhưng áp dụng mức lãi BUÔN. 
        -- Nếu bán Thùng, Frontend sẽ nhân tiếp với items_per_carton.
        CASE 
            WHEN p.wholesale_margin_type = '%' THEN p.actual_cost * (1 + p.wholesale_margin_value / 100)
            ELSE p.actual_cost + p.wholesale_margin_value
        END as price_wholesale,
        
        p.items_per_carton
    FROM public.products p
    WHERE 
        p.status = 'active'
        AND (
            -- Tìm chính xác SKU hoặc Barcode trước (Ưu tiên cao nhất)
            p.sku ILIKE p_keyword
            OR p.barcode = p_keyword
            -- Sau đó tìm mờ theo tên/hoạt chất dùng Full Text Search
            OR p.fts @@ to_tsquery('simple', p_keyword || ':*')
            -- Fallback cho tiếng Việt không dấu nếu FTS trượt (chậm hơn xíu nhưng an toàn)
            OR p.name ILIKE '%' || p_keyword || '%'
        )
    
    UNION ALL
    
    -- 2. TÌM DỊCH VỤ (Service/Bundle) - Nếu cần bán gói
    SELECT
        s.id,
        'service'::text as type,
        s.sku,
        s.name,
        NULL as image_url, -- Dịch vụ thường không có ảnh hoặc lấy ảnh mặc định
        s.unit as uom,
        NULL as uom_wholesale,
        9999 as stock_quantity, -- Dịch vụ luôn có hàng
        s.price as price_retail,
        s.price as price_wholesale, -- Dịch vụ thường chỉ có 1 giá
        1 as items_per_carton
    FROM public.service_packages s
    WHERE 
        s.status = 'active'
        AND (
            s.sku ILIKE p_keyword
            OR s.name ILIKE '%' || p_keyword || '%'
        )
        
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."search_items_for_sales"("p_keyword" "text", "p_warehouse_id" bigint, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_product_batches"("p_product_id" bigint, "p_warehouse_id" bigint) RETURNS TABLE("id" bigint, "lot_number" "text", "expiry_date" "date", "quantity" integer, "days_remaining" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ib.id, 
        b.batch_code as lot_number, 
        b.expiry_date,
        ib.quantity,
        (b.expiry_date - CURRENT_DATE)::int as days_remaining
    FROM public.inventory_batches ib
    JOIN public.batches b ON ib.batch_id = b.id
    WHERE 
        ib.product_id = p_product_id
        AND ib.warehouse_id = p_warehouse_id
        AND ib.quantity > 0          
        AND b.expiry_date >= CURRENT_DATE 
    ORDER BY b.expiry_date ASC;     
END;
$$;


ALTER FUNCTION "public"."search_product_batches"("p_product_id" bigint, "p_warehouse_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_products_for_b2b_order"("p_keyword" "text", "p_warehouse_id" bigint DEFAULT 1) RETURNS TABLE("id" bigint, "sku" "text", "name" "text", "image_url" "text", "stock_quantity" integer, "shelf_location" "text", "lot_number" "text", "expiry_date" "date", "wholesale_unit" "text", "price_wholesale" numeric, "items_per_carton" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_search_query tsquery;
    v_clean_keyword text;
BEGIN
    -- 1. Chuẩn hóa từ khóa
    v_clean_keyword := trim(regexp_replace(p_keyword, '\s+', ' ', 'g'));
    IF v_clean_keyword = '' THEN RETURN; END IF;

    BEGIN
        v_search_query := to_tsquery('simple', replace(v_clean_keyword, ' ', ':* & ') || ':*');
    EXCEPTION WHEN OTHERS THEN
        v_search_query := plainto_tsquery('simple', v_clean_keyword);
    END;

    RETURN QUERY
    SELECT 
        p.id,
        p.sku,
        p.name,
        p.image_url,
        COALESCE(inv.stock_quantity, 0) as stock_quantity,
        COALESCE(inv.shelf_location, 'Chưa xếp') as shelf_location,
        
        -- Logic FIFO gợi ý lô (Giữ nguyên)
        (
            SELECT iri.lot_number 
            FROM public.inventory_receipt_items iri
            JOIN public.inventory_receipts ir ON iri.receipt_id = ir.id
            WHERE iri.product_id = p.id AND ir.warehouse_id = p_warehouse_id AND iri.expiry_date > CURRENT_DATE
            ORDER BY iri.expiry_date ASC LIMIT 1
        ) as lot_number,
        
        (
            SELECT iri.expiry_date 
            FROM public.inventory_receipt_items iri
            JOIN public.inventory_receipts ir ON iri.receipt_id = ir.id
            WHERE iri.product_id = p.id AND ir.warehouse_id = p_warehouse_id AND iri.expiry_date > CURRENT_DATE
            ORDER BY iri.expiry_date ASC LIMIT 1
        ) as expiry_date,
        
        -- [LOGIC MỚI BẮT ĐẦU TỪ ĐÂY]
        -- Lấy thông tin từ bảng con u_b2b (được join ở dưới)
        
        -- 1. Đơn vị bán buôn
        COALESCE(u_b2b.unit_name, p.wholesale_unit, p.retail_unit) as wholesale_unit,
        
        -- 2. Giá bán buôn (Lấy trực tiếp từ price_sell trong bảng units)
        -- Nếu không cấu hình giá trong units, fallback về công thức cũ
        COALESCE(
            u_b2b.price_sell, 
            (
                CASE 
                    WHEN p.wholesale_margin_type = '%' THEN p.actual_cost * (1 + p.wholesale_margin_value / 100)
                    ELSE p.actual_cost + p.wholesale_margin_value
                END
            ) * COALESCE(u_b2b.conversion_rate, p.items_per_carton, 1)
        ) as price_wholesale,
        
        -- 3. Quy cách đóng gói
        COALESCE(u_b2b.conversion_rate, p.items_per_carton, 1) as items_per_carton
        
    FROM public.products p
    LEFT JOIN public.product_inventory inv ON p.id = inv.product_id AND inv.warehouse_id = p_warehouse_id
    
    -- [LATERAL JOIN] Tìm đơn vị B2B tốt nhất cho từng sản phẩm
    LEFT JOIN LATERAL (
        SELECT unit_name, price_sell, conversion_rate
        FROM public.product_units pu
        WHERE pu.product_id = p.id
        -- Ưu tiên 1: Là đơn vị bán buôn (type='wholesale')
        -- Ưu tiên 2: Hệ số quy đổi lớn nhất (Thùng to nhất)
        ORDER BY 
            (CASE WHEN pu.unit_type = 'wholesale' THEN 1 ELSE 2 END) ASC,
            pu.conversion_rate DESC
        LIMIT 1
    ) u_b2b ON TRUE
    
    WHERE 
        p.status = 'active'
        AND (
            p.barcode = v_clean_keyword
            OR p.sku ILIKE v_clean_keyword
            OR p.fts @@ v_search_query
            OR p.name ILIKE '%' || v_clean_keyword || '%'
        )
    ORDER BY 
        (p.barcode = v_clean_keyword OR p.sku ILIKE v_clean_keyword) DESC,
        ts_rank(p.fts, v_search_query) DESC,
        length(p.name) ASC
    LIMIT 20;
END;
$$;


ALTER FUNCTION "public"."search_products_for_b2b_order"("p_keyword" "text", "p_warehouse_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_products_for_purchase"("p_keyword" "text") RETURNS TABLE("id" bigint, "name" "text", "sku" "text", "barcode" "text", "image_url" "text", "wholesale_unit" "text", "retail_unit" "text", "items_per_carton" integer, "actual_cost" numeric, "latest_purchase_price" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.sku,
        p.barcode,
        p.image_url,
        COALESCE(p.wholesale_unit, 'Hộp') AS wholesale_unit,
        COALESCE(p.retail_unit, 'Vỉ') AS retail_unit,
        COALESCE(p.items_per_carton, 1) AS items_per_carton,
        COALESCE(p.actual_cost, 0) AS actual_cost,
        
        -- LOGIC LẤY GIÁ NHẬP GẦN NHẤT (Subquery tối ưu)
        COALESCE(
            (
                SELECT poi.unit_price
                FROM public.purchase_order_items poi
                JOIN public.purchase_orders po ON poi.po_id = po.id
                WHERE poi.product_id = p.id
                -- Chỉ tính các đơn chưa bị hủy
                AND po.status <> 'CANCELLED'
                ORDER BY po.created_at DESC
                LIMIT 1
            ),
            0 
        ) AS latest_purchase_price

    FROM
        public.products p
    WHERE
        p.status = 'active' -- Chỉ lấy hàng đang kinh doanh
        AND (
            p_keyword IS NULL 
            OR p_keyword = '' 
            OR p.name ILIKE '%' || p_keyword || '%' 
            OR p.sku ILIKE '%' || p_keyword || '%'
            OR p.barcode ILIKE '%' || p_keyword || '%' -- Tìm theo Barcode
        )
    ORDER BY
        p.created_at DESC
    LIMIT 20; 
END;
$$;


ALTER FUNCTION "public"."search_products_for_purchase"("p_keyword" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_products_for_transfer"("p_warehouse_id" bigint, "p_keyword" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 20) RETURNS TABLE("id" bigint, "sku" "text", "name" "text", "image_url" "text", "current_stock" integer, "shelf_location" "text", "lot_number" "text", "expiry_date" "date", "unit" "text", "conversion_factor" integer, "items_per_carton" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_clean_keyword text;
    v_search_query tsquery;
BEGIN
    -- 1. Chuẩn hóa từ khóa
    v_clean_keyword := trim(regexp_replace(p_keyword, '\s+', ' ', 'g'));
    
    IF v_clean_keyword IS NOT NULL AND v_clean_keyword <> '' THEN
        BEGIN
            v_search_query := to_tsquery('simple', replace(v_clean_keyword, ' ', ':* & ') || ':*');
        EXCEPTION WHEN OTHERS THEN
            v_search_query := plainto_tsquery('simple', v_clean_keyword);
        END;
    END IF;

    RETURN QUERY
    SELECT 
        p.id,
        p.sku,
        p.name,
        p.image_url,
        
        -- Lấy tồn kho chính xác tại kho nguồn
        COALESCE(inv.stock_quantity, 0)::INTEGER as current_stock,
        COALESCE(inv.shelf_location, '') as shelf_location,
        
        -- [CORE FIX]: Join đúng bảng batches để lấy batch_code và expiry_date
        (
            SELECT b.batch_code 
            FROM public.inventory_batches ib
            JOIN public.batches b ON ib.batch_id = b.id -- FIX QUAN TRỌNG
            WHERE ib.product_id = p.id 
              AND ib.warehouse_id = p_warehouse_id 
              AND ib.quantity > 0 
              AND b.expiry_date >= CURRENT_DATE
            ORDER BY b.expiry_date ASC 
            LIMIT 1
        ) as lot_number,
        
        (
            SELECT b.expiry_date 
            FROM public.inventory_batches ib
            JOIN public.batches b ON ib.batch_id = b.id -- FIX QUAN TRỌNG
            WHERE ib.product_id = p.id 
              AND ib.warehouse_id = p_warehouse_id 
              AND ib.quantity > 0 
              AND b.expiry_date >= CURRENT_DATE
            ORDER BY b.expiry_date ASC 
            LIMIT 1
        ) as expiry_date,
        
        -- [LOGIC SENKO]: Tìm đơn vị Wholesale tốt nhất
        COALESCE(u_b2b.unit_name, p.wholesale_unit, p.retail_unit, 'Hộp') as unit,
        COALESCE(u_b2b.conversion_rate, p.items_per_carton, 1) as conversion_factor,
        COALESCE(p.items_per_carton, 1) as items_per_carton

    FROM public.products p
    LEFT JOIN public.product_inventory inv 
        ON p.id = inv.product_id AND inv.warehouse_id = p_warehouse_id
    
    -- Lateral Join để tìm unit "ngon" nhất (Logic của Senko)
    LEFT JOIN LATERAL (
        SELECT unit_name, conversion_rate
        FROM public.product_units pu
        WHERE pu.product_id = p.id
        ORDER BY (pu.unit_type = 'wholesale') DESC, pu.conversion_rate DESC
        LIMIT 1
    ) u_b2b ON TRUE
    
    WHERE 
        p.status = 'active'
        AND (
            v_clean_keyword IS NULL 
            OR v_clean_keyword = ''
            OR p.sku ILIKE v_clean_keyword || '%'
            OR p.barcode = v_clean_keyword
            OR p.fts @@ v_search_query
            OR p.name ILIKE '%' || v_clean_keyword || '%'
        )
    ORDER BY 
        -- Ưu tiên tìm thấy trong kho có hàng trước
        (COALESCE(inv.stock_quantity, 0) > 0) DESC,
        p.created_at DESC
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."search_products_for_transfer"("p_warehouse_id" bigint, "p_keyword" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_products_pos"("p_keyword" "text", "p_warehouse_id" bigint, "p_limit" integer DEFAULT 20) RETURNS TABLE("id" bigint, "name" "text", "sku" "text", "barcode" "text", "retail_price" numeric, "image_url" "text", "unit" "text", "stock_quantity" integer, "location_cabinet" "text", "location_row" "text", "location_slot" "text", "usage_instructions" "jsonb", "status" "text", "similarity_score" real)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_clean_keyword text;
    v_search_pattern text;
    v_warehouse_type text;
BEGIN
    SELECT w.type INTO v_warehouse_type FROM public.warehouses w WHERE w.id = p_warehouse_id;
    IF v_warehouse_type = 'wholesale' THEN RETURN; END IF;

    v_clean_keyword := TRIM(p_keyword);
    IF v_clean_keyword IS NULL OR v_clean_keyword = '' THEN RETURN; END IF;
    v_search_pattern := '%' || REPLACE(v_clean_keyword, ' ', '%') || '%';

    RETURN QUERY
    SELECT 
        p.id, p.name, p.sku, p.barcode,
        COALESCE(u_retail.price_sell, 0), 
        p.image_url,
        COALESCE(u_retail.unit_name, u_base.unit_name, 'N/A'),
        
        -- [CORE FIX]: Chia tồn kho Base cho tỷ lệ quy đổi để ra số lượng hiển thị (VD: 180 viên / 12 = 15 vỉ)
        FLOOR(COALESCE(inv.stock_quantity, 0)::NUMERIC / GREATEST(COALESCE(u_retail.conversion_rate, 1), 1))::INTEGER,
        
        inv.location_cabinet, inv.location_row, inv.location_slot, p.usage_instructions, p.status,
        CASE 
            WHEN p.barcode = v_clean_keyword THEN 1.0::REAL
            ELSE GREATEST(similarity(p.name, v_clean_keyword), 0.5)::REAL
        END AS score
    FROM public.products p
    LEFT JOIN public.product_units u_retail ON p.id = u_retail.product_id AND u_retail.unit_type = 'retail'
    LEFT JOIN public.product_units u_base ON p.id = u_base.product_id AND u_base.is_base = true
    LEFT JOIN public.product_inventory inv ON p.id = inv.product_id AND inv.warehouse_id = p_warehouse_id
    WHERE p.status = 'active' 
      AND (p.barcode = v_clean_keyword OR p.sku ILIKE v_clean_keyword || '%' OR p.name ILIKE v_search_pattern)
    ORDER BY score DESC, inv.stock_quantity DESC NULLS LAST
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."search_products_pos"("p_keyword" "text", "p_warehouse_id" bigint, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_products_v2"("p_keyword" "text" DEFAULT NULL::"text", "p_category" "text" DEFAULT NULL::"text", "p_manufacturer" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
    DECLARE
        v_sql TEXT;
        v_term TEXT;
        v_search_arr TEXT[];
        v_result JSONB;
        v_where_clauses TEXT[] := ARRAY['1=1']; -- Mặc định luôn đúng
    BEGIN
        -- 1. XÂY DỰNG MỆNH ĐỀ WHERE ĐỘNG
        
        -- Filter: Status
        IF p_status IS NOT NULL THEN
            v_where_clauses := array_append(v_where_clauses, format('p.status = %L', p_status));
        ELSE
            v_where_clauses := array_append(v_where_clauses, 'p.status != ''deleted''');
        END IF;

        -- Filter: Manufacturer (FIXED COLUMN NAME) 🔧
        IF p_manufacturer IS NOT NULL AND p_manufacturer != '' THEN
            -- Sửa p.manufacturer -> p.manufacturer_name
            v_where_clauses := array_append(v_where_clauses, format('p.manufacturer_name = %L', p_manufacturer));
        END IF;

        -- Filter: KEYWORD (SMART SPLIT LOGIC)
        IF p_keyword IS NOT NULL AND TRIM(p_keyword) != '' THEN
            v_search_arr := string_to_array(TRIM(p_keyword), ' ');
            
            FOREACH v_term IN ARRAY v_search_arr
            LOOP
                IF TRIM(v_term) != '' THEN
                    v_where_clauses := array_append(v_where_clauses, format(
                        '(p.name ILIKE %1$L OR p.sku ILIKE %1$L OR COALESCE(p.barcode, '''') ILIKE %1$L OR COALESCE(p.active_ingredient, '''') ILIKE %1$L)', 
                        '%' || TRIM(v_term) || '%'
                    ));
                END IF;
            END LOOP;
        END IF;

        -- 2. TỔNG HỢP SQL (FIXED SELECT LIST) 🔧
        v_sql := format(
            'SELECT jsonb_build_object(
                ''data'', COALESCE(jsonb_agg(t.*), ''[]''),
                ''total_count'', COALESCE(MAX(t.full_count), 0)
            )
            FROM (
                SELECT 
                    p.id, 
                    p.name, 
                    p.sku, 
                    p.image_url, 
                    p.status, 
                    
                    -- [FIXED] Sửa p.manufacturer -> p.manufacturer_name
                    -- Alias về "manufacturer" để Frontend không bị đổi key (nếu đang dùng key cũ)
                    p.manufacturer_name AS manufacturer, 
                    
                    p.active_ingredient,
                    
                    -- Subquery: Base Unit
                    COALESCE((
                        SELECT unit_name 
                        FROM public.product_units 
                        WHERE product_id = p.id AND unit_type = ''base'' 
                        LIMIT 1
                    ), ''N/A'') as base_unit,
                    
                    -- Subquery: Retail Price
                    COALESCE((
                        SELECT price 
                        FROM public.product_units 
                        WHERE product_id = p.id AND unit_type = ''retail'' 
                        LIMIT 1
                    ), 0) as retail_price,

                    -- Subquery: Total Stock
                    COALESCE((
                        SELECT SUM(stock_quantity) 
                        FROM public.product_inventory 
                        WHERE product_id = p.id
                    ), 0)::INT as total_stock,

                    COUNT(*) OVER() as full_count

                FROM public.products p
                WHERE %s
                ORDER BY p.created_at DESC
                LIMIT %s OFFSET %s
            ) t',
            array_to_string(v_where_clauses, ' AND '),
            p_limit,
            p_offset
        );

        -- 3. THỰC THI
        EXECUTE v_sql INTO v_result;

        RETURN v_result;
    END;
    $_$;


ALTER FUNCTION "public"."search_products_v2"("p_keyword" "text", "p_category" "text", "p_manufacturer" "text", "p_status" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_products_v2"("p_keyword" "text", "p_category" "text", "p_manufacturer" "text", "p_status" "text", "p_limit" integer, "p_offset" integer) IS 'Tìm kiếm SP V2 (Fixed: manufacturer_name column)';



CREATE OR REPLACE FUNCTION "public"."send_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text" DEFAULT 'info'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    BEGIN
        INSERT INTO public.notifications (user_id, title, message, type, is_read, created_at)
        VALUES (p_user_id, p_title, p_message, p_type, false, now());
    END;
    $$;


ALTER FUNCTION "public"."send_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."send_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text") IS 'Gửi thông báo cho 1 user cụ thể';



CREATE OR REPLACE FUNCTION "public"."submit_cash_remittance"("p_order_ids" "uuid"[], "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_total_amount NUMERIC;
        v_updated_count INT;
        v_transaction_id BIGINT;
        v_trans_code TEXT;
        v_user_name TEXT;
    BEGIN
        -- 1. Tính tổng tiền hợp lệ (Chỉ lấy đơn tiền mặt & chưa nộp)
        SELECT COALESCE(SUM(final_amount), 0)
        INTO v_total_amount
        FROM public.orders
        WHERE id = ANY(p_order_ids)
          AND remittance_status = 'pending' -- Đang giữ tiền
          AND payment_method = 'cash';      -- Chỉ nộp tiền mặt

        -- Nếu không có tiền để nộp (do chọn sai hoặc đã nộp rồi)
        IF v_total_amount <= 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'message', 'Không có đơn hàng tiền mặt hợp lệ để nộp.'
            );
        END IF;

        -- 2. Lấy tên người nộp để ghi chú
        SELECT COALESCE(full_name, email) INTO v_user_name 
        FROM public.users WHERE id = p_user_id;

        -- 3. TẠO PHIẾU THU (Trạng thái PENDING - Chờ thủ quỹ duyệt)
        -- Sinh mã phiếu thu
        v_trans_code := 'PT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

        INSERT INTO public.finance_transactions (
            code,
            flow,           -- 'in' (Thu tiền)
            business_type,  -- 'trade' (Bán hàng)
            amount,
            fund_account_id, -- Tạm thời để 1 (Tiền mặt), Thủ quỹ có thể sửa khi duyệt
            status,         -- 'pending' (Chờ duyệt)
            description,
            created_by,
            created_at,
            partner_type,   -- 'employee' (Nộp nội bộ)
            partner_id,
            partner_name_cache
        )
        VALUES (
            v_trans_code,
            'in',
            'trade',
            v_total_amount,
            1,              -- Hardcode ID quỹ mặc định (hoặc lấy từ config)
            'pending',
            'Nộp tiền doanh thu POS - ' || COALESCE(v_user_name, 'Sales'),
            p_user_id,
            NOW(),
            'employee',
            p_user_id::TEXT,
            v_user_name
        )
        RETURNING id INTO v_transaction_id;

        -- 4. CẬP NHẬT ĐƠN HÀNG (Gán ID phiếu thu vào đơn)
        UPDATE public.orders
        SET 
            remittance_status = 'confirming', -- Chuyển sang chờ duyệt
            remittance_transaction_id = v_transaction_id, -- Liên kết với phiếu thu vừa tạo
            updated_at = NOW()
        WHERE id = ANY(p_order_ids)
          AND remittance_status = 'pending'
          AND payment_method = 'cash';

        GET DIAGNOSTICS v_updated_count = ROW_COUNT;

        -- 5. Trả về kết quả
        RETURN jsonb_build_object(
            'success', true,
            'updated_count', v_updated_count,
            'total_amount', v_total_amount,
            'transaction_code', v_trans_code
        );
    END;
    $$;


ALTER FUNCTION "public"."submit_cash_remittance"("p_order_ids" "uuid"[], "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."submit_cash_remittance"("p_order_ids" "uuid"[], "p_user_id" "uuid") IS 'Nộp tiền POS: Tạo Finance Transaction và Update Order Link';



CREATE OR REPLACE FUNCTION "public"."submit_transfer_shipping"("p_transfer_id" bigint, "p_batch_items" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_transfer_record RECORD;
        v_item JSONB;
        v_item_record RECORD;
        
        v_qty_wholesale NUMERIC;
        v_qty_base INTEGER;
        
        v_batch_id BIGINT;
        v_transfer_item_id BIGINT;
        v_source_warehouse_id BIGINT;
        v_current_stock INTEGER;
    BEGIN
        -- 1. Validate Header & Lock Row
        SELECT * INTO v_transfer_record 
        FROM public.inventory_transfers 
        WHERE id = p_transfer_id 
        FOR UPDATE; -- Khóa dòng phiếu chuyển

        IF v_transfer_record IS NULL THEN
            RAISE EXCEPTION 'Không tìm thấy phiếu chuyển kho ID %', p_transfer_id;
        END IF;

        IF v_transfer_record.status NOT IN ('pending', 'approved') THEN
            RAISE EXCEPTION 'Phiếu chuyển kho không ở trạng thái chờ xuất (Status hiện tại: %)', v_transfer_record.status;
        END IF;

        v_source_warehouse_id := v_transfer_record.source_warehouse_id;

        -- 2. Loop xử lý từng dòng Batch
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_batch_items)
        LOOP
            v_transfer_item_id := (v_item->>'transfer_item_id')::BIGINT;
            v_batch_id := (v_item->>'batch_id')::BIGINT;
            v_qty_wholesale := (v_item->>'quantity')::NUMERIC; -- Số lượng Sỉ (VD: 5 Thùng)

            IF v_qty_wholesale <= 0 THEN
                CONTINUE; -- Bỏ qua nếu số lượng = 0
            END IF;

            -- Lấy thông tin Item để biết hệ số quy đổi
            SELECT * INTO v_item_record
            FROM public.inventory_transfer_items
            WHERE id = v_transfer_item_id;

            IF v_item_record IS NULL THEN
                RAISE EXCEPTION 'Không tìm thấy dòng chi tiết ID %', v_transfer_item_id;
            END IF;

            -- A. Tính toán quy đổi ra Base Unit
            v_qty_base := (v_qty_wholesale * v_item_record.conversion_factor)::INTEGER;

            -- B. Trừ kho (Inventory Batches) tại Kho Nguồn
            UPDATE public.inventory_batches
            SET quantity = quantity - v_qty_base,
                updated_at = NOW()
            WHERE warehouse_id = v_source_warehouse_id
              AND batch_id = v_batch_id
              AND product_id = v_item_record.product_id
            RETURNING quantity INTO v_current_stock;

            -- Kiểm tra nếu không tìm thấy lô hoặc âm kho
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Lô hàng ID % không tồn tại trong kho nguồn (Product ID %)', v_batch_id, v_item_record.product_id;
            END IF;

            IF v_current_stock < 0 THEN
                RAISE EXCEPTION 'Kho không đủ hàng để xuất. Sản phẩm ID %, Lô ID % bị âm.', v_item_record.product_id, v_batch_id;
            END IF;

            -- C. Ghi nhận Batch vào bảng Tracking (inventory_transfer_batch_items)
            -- Bảng này lưu số lượng thực tế (Base Unit) đã lấy từ lô nào
            INSERT INTO public.inventory_transfer_batch_items (
                transfer_item_id, batch_id, quantity
            ) VALUES (
                v_transfer_item_id, v_batch_id, v_qty_base
            );

            -- D. Cập nhật tiến độ vào bảng Item (Số lượng Sỉ)
            UPDATE public.inventory_transfer_items
            SET qty_shipped = COALESCE(qty_shipped, 0) + v_qty_wholesale
            WHERE id = v_transfer_item_id;

        END LOOP;

        -- 3. Cập nhật trạng thái Header -> SHIPPING
        UPDATE public.inventory_transfers
        SET status = 'shipping',
            updated_at = NOW()
        WHERE id = p_transfer_id;

        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Đã xác nhận xuất kho. Phiếu chuyển sang trạng thái Đang vận chuyển.'
        );
    END;
    $$;


ALTER FUNCTION "public"."submit_transfer_shipping"("p_transfer_id" bigint, "p_batch_items" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."submit_transfer_shipping"("p_transfer_id" bigint, "p_batch_items" "jsonb") IS 'Xử lý xuất kho chuyển hàng: Trừ tồn kho (Base Unit) và cập nhật trạng thái Shipping';



CREATE OR REPLACE FUNCTION "public"."sync_inventory_batch_to_total"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_product_id BIGINT;
        v_warehouse_id BIGINT;
        v_total_qty INTEGER;
    BEGIN
        v_product_id := COALESCE(NEW.product_id, OLD.product_id);
        v_warehouse_id := COALESCE(NEW.warehouse_id, OLD.warehouse_id);

        -- Tính tổng
        SELECT COALESCE(SUM(quantity), 0)
        INTO v_total_qty
        FROM public.inventory_batches
        WHERE product_id = v_product_id AND warehouse_id = v_warehouse_id;

        -- Update ngược bảng cũ
        INSERT INTO public.product_inventory (product_id, warehouse_id, stock_quantity)
        VALUES (v_product_id, v_warehouse_id, v_total_qty)
        ON CONFLICT (product_id, warehouse_id) 
        DO UPDATE SET stock_quantity = EXCLUDED.stock_quantity;

        RETURN NULL;
    END;
    $$;


ALTER FUNCTION "public"."sync_inventory_batch_to_total"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_order_remittance_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    BEGIN
        -- TRƯỜNG HỢP 1: THỦ QUỸ DUYỆT (Pending -> Completed)
        -- Tiền chính thức vào sổ quỹ -> Đơn hàng đổi thành 'deposited'
        IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
            
            UPDATE public.orders
            SET 
                remittance_status = 'deposited', -- Đã nộp xong
                updated_at = NOW()
            WHERE remittance_transaction_id = NEW.id;
            
        -- TRƯỜNG HỢP 2: THỦ QUỸ TỪ CHỐI (Pending -> Cancelled)
        -- Trả đơn hàng về trạng thái 'pending' để nhân viên nộp lại
        ELSIF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
            
            UPDATE public.orders
            SET 
                remittance_status = 'pending',       -- Quay lại chờ nộp
                remittance_transaction_id = NULL,    -- Gỡ liên kết phiếu thu bị hủy
                updated_at = NOW()
            WHERE remittance_transaction_id = NEW.id;
            
        END IF;

        RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."sync_order_remittance_status"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_order_remittance_status"() IS 'Trigger Strict: Đồng bộ trạng thái đơn hàng khi Thủ quỹ duyệt/hủy phiếu thu';



CREATE OR REPLACE FUNCTION "public"."sync_po_payment_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_po_id BIGINT;
    v_total_paid NUMERIC;
    v_final_amount NUMERIC;
    v_new_status TEXT;
BEGIN
    -- 1. Xác định ID Đơn Mua Hàng bị ảnh hưởng
    -- Nếu là DELETE, lấy ID từ bản ghi cũ (OLD). Nếu INSERT/UPDATE, lấy từ bản ghi mới (NEW).
    IF (TG_OP = 'DELETE') THEN
        IF OLD.ref_type = 'purchase_order' AND OLD.ref_id IS NOT NULL THEN
            v_po_id := OLD.ref_id::BIGINT;
        ELSE
            RETURN NULL; -- Không liên quan đến PO
        END IF;
    ELSE
        IF NEW.ref_type = 'purchase_order' AND NEW.ref_id IS NOT NULL THEN
            v_po_id := NEW.ref_id::BIGINT;
        ELSE
            RETURN NULL; -- Không liên quan đến PO
        END IF;
    END IF;

    -- 2. Tính tổng tiền thực tế ĐÃ ĐƯỢC CHẤP NHẬN CHI cho đơn này
    -- Chỉ cộng các phiếu có status là 'completed' hoặc 'confirmed'
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid
    FROM public.finance_transactions
    WHERE ref_type = 'purchase_order' 
      AND ref_id = v_po_id::TEXT
      AND flow = 'out' -- Chỉ tính dòng tiền ra (Chi)
      AND status IN ('confirmed', 'completed', 'approved'); -- Chỉ tính phiếu đã duyệt

    -- 3. Lấy tổng tiền phải trả của đơn hàng
    SELECT final_amount INTO v_final_amount 
    FROM public.purchase_orders 
    WHERE id = v_po_id;

    -- Nếu không tìm thấy đơn (trường hợp hiếm), thoát luôn
    IF v_final_amount IS NULL THEN RETURN NULL; END IF;

    -- 4. Xác định trạng thái mới dựa trên số liệu thực tế
    IF v_total_paid >= (v_final_amount - 500) THEN -- Cho phép sai số 500đ
        v_new_status := 'paid';
    ELSIF v_total_paid > 0 THEN
        v_new_status := 'partial';
    ELSE
        v_new_status := 'unpaid';
    END IF;

    -- 5. Cập nhật ngược lại bảng PO
    UPDATE public.purchase_orders
    SET total_paid = v_total_paid,
        payment_status = v_new_status,
        updated_at = NOW()
    WHERE id = v_po_id;

    RETURN NULL; -- Trigger AFTER không cần trả về giá trị
END;
$$;


ALTER FUNCTION "public"."sync_po_payment_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_status_to_auth"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    BEGIN
        -- Trường hợp 1: User được set là 'active' -> Gỡ Ban (Cho phép đăng nhập)
        IF NEW.status = 'active' THEN
            UPDATE auth.users
            SET banned_until = NULL
            WHERE id = NEW.id;
        
        -- Trường hợp 2: User không phải 'active' (inactive, pending...) -> Ban (Chặn đăng nhập)
        ELSE
            UPDATE auth.users
            SET banned_until = (now() + interval '100 years') -- Ban 100 năm
            WHERE id = NEW.id;
        END IF;

        RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."sync_user_status_to_auth"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_user_status_to_auth"() IS 'Trigger function: Đồng bộ trạng thái từ public.users sang auth.users (Ban/Unban)';



CREATE OR REPLACE FUNCTION "public"."track_inventory_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    BEGIN
        IF NEW.updated_by IS NOT NULL THEN
            -- Case 5: Cập nhật Vị trí kệ
            IF (OLD.shelf_location IS DISTINCT FROM NEW.shelf_location) THEN
                INSERT INTO public.product_activity_logs (user_id, product_id, action_type, old_value, new_value)
                VALUES (NEW.updated_by, NEW.product_id, 'update_location', OLD.shelf_location, NEW.shelf_location);
            END IF;
        END IF;
        RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."track_inventory_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_product_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    BEGIN
        -- Chỉ ghi log nếu có người thực hiện (updated_by không null)
        IF NEW.updated_by IS NOT NULL THEN
            
            -- Case 1: Cập nhật Barcode
            IF (OLD.barcode IS DISTINCT FROM NEW.barcode) THEN
                INSERT INTO public.product_activity_logs (user_id, product_id, action_type, old_value, new_value)
                VALUES (NEW.updated_by, NEW.id, 'update_barcode', OLD.barcode, NEW.barcode);
            END IF;

            -- Case 2: Cập nhật Đơn vị (Wholesale Unit)
            IF (OLD.wholesale_unit IS DISTINCT FROM NEW.wholesale_unit) THEN
                INSERT INTO public.product_activity_logs (user_id, product_id, action_type, old_value, new_value)
                VALUES (NEW.updated_by, NEW.id, 'update_unit', OLD.wholesale_unit, NEW.wholesale_unit);
            END IF;

             -- Case 3: Cập nhật Nội dung/Tên (Content)
            IF (OLD.description IS DISTINCT FROM NEW.description) OR (OLD.name IS DISTINCT FROM NEW.name) THEN
                INSERT INTO public.product_activity_logs (user_id, product_id, action_type, old_value, new_value)
                VALUES (NEW.updated_by, NEW.id, 'update_content', 'old_content', 'new_content');
            END IF;

            -- Case 4: Cập nhật Giá bán (Invoice Price) - Thêm cái này để quản lý chặt hơn
            IF (OLD.invoice_price IS DISTINCT FROM NEW.invoice_price) THEN
                 INSERT INTO public.product_activity_logs (user_id, product_id, action_type, old_value, new_value)
                VALUES (NEW.updated_by, NEW.id, 'update_price', OLD.invoice_price::text, NEW.invoice_price::text);
            END IF;

        END IF;
        RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."track_product_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_deduct_vat_inventory"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    BEGIN
        -- Logic: Chỉ trừ kho khi trạng thái chuyển sang 'issued' hoặc 'verified'
        -- Và trạng thái cũ KHÔNG PHẢI là 'issued'/'verified' (để tránh trừ 2 lần)
        IF NEW.status IN ('issued', 'verified') 
           AND (OLD.status IS NULL OR OLD.status NOT IN ('issued', 'verified')) THEN
            
            PERFORM public.process_sales_invoice_deduction(NEW.id);
            
        END IF;
        RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."trigger_deduct_vat_inventory"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_notify_finance_approval"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    BEGIN
        -- Chỉ báo khi tạo mới và trạng thái là pending
        IF NEW.status = 'pending' THEN
            PERFORM notify_users_by_permission(
                'fin-approve-cash', -- Key quyền: Duyệt thu chi
                'Yêu cầu duyệt ' || CASE WHEN NEW.flow = 'in' THEN 'Thu' ELSE 'Chi' END,
                'Mã phiếu: ' || NEW.code || ' - Số tiền: ' || to_char(NEW.amount, 'FM999,999,999') || ' đ',
                'warning'
            );
        END IF;
        RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."trigger_notify_finance_approval"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_notify_warehouse_po"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    BEGIN
        -- Nếu đơn hàng chuyển sang 'pending' (Đã gửi NCC, chờ nhập)
        -- Hoặc tạo mới ở trạng thái pending
        IF NEW.delivery_status = 'pending' AND (OLD.delivery_status IS NULL OR OLD.delivery_status != 'pending') THEN
            PERFORM notify_users_by_permission(
                'inv-stock-view', -- Key quyền: Xem/Quản lý kho
                'Đơn mua hàng mới',
                'Đơn PO ' || NEW.code || ' đang chờ nhập kho. Vui lòng kiểm tra.',
                'info'
            );
        END IF;
        RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."trigger_notify_warehouse_po"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_order_cancel_restore_stock"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
    BEGIN
        -- Khi đơn chuyển sang CANCELLED và trước đó đã PACKED/SHIPPING/DELIVERED (đã trừ kho)
        IF NEW.status = 'CANCELLED' AND OLD.status IN ('PACKED', 'SHIPPING', 'DELIVERED', 'COMPLETED') THEN
            PERFORM public.handle_order_cancellation(NEW.id);
        END IF;
        RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."trigger_order_cancel_restore_stock"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_refresh_on_criteria_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    BEGIN
        -- Chỉ chạy logic nếu loại là 'dynamic'
        IF NEW.type = 'dynamic' THEN
            -- Kiểm tra: Nếu cột criteria thay đổi HOẶC cột type thay đổi (từ static -> dynamic)
            IF (OLD.criteria IS DISTINCT FROM NEW.criteria) OR (OLD.type IS DISTINCT FROM NEW.type) THEN
                -- Gọi hàm Refresh mà chúng ta đã viết ở lệnh trước
                PERFORM public.refresh_segment_members(NEW.id);
            END IF;
        END IF;
        
        RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."trigger_refresh_on_criteria_change"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."update_full_supplier_program"("p_program_id" bigint, "p_program_data" "jsonb", "p_groups_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_group JSONB;
    v_group_id BIGINT;
    v_exists BOOLEAN;
BEGIN
    -- 1. Validation: Kiểm tra ID tồn tại
    SELECT EXISTS(SELECT 1 FROM public.supplier_programs WHERE id = p_program_id) INTO v_exists;
    IF NOT v_exists THEN
        RAISE EXCEPTION 'Chương trình/Hợp đồng ID % không tồn tại.', p_program_id;
    END IF;

    -- 2. Update Header (Thông tin chung)
    UPDATE public.supplier_programs
    SET 
        supplier_id = COALESCE((p_program_data->>'supplier_id')::BIGINT, supplier_id),
        code = p_program_data->>'code',
        name = p_program_data->>'name',
        type = (p_program_data->>'type')::public.supplier_program_type,
        valid_from = (p_program_data->>'valid_from')::DATE,
        valid_to = (p_program_data->>'valid_to')::DATE,
        document_code = p_program_data->>'document_code',
        attachment_url = p_program_data->>'attachment_url',
        description = p_program_data->>'description',
        updated_at = NOW()
    WHERE id = p_program_id;

    -- 3. Xử lý Groups & Products (Chiến lược: Replace All)
    -- Xóa các nhóm cũ thuộc chương trình này. 
    -- (Các sản phẩm thuộc nhóm sẽ tự động bị xóa theo nhờ ON DELETE CASCADE tại bảng supplier_program_products)
    DELETE FROM public.supplier_program_groups WHERE program_id = p_program_id;

    -- 4. Insert lại Groups mới (Vòng lặp)
    FOR v_group IN SELECT * FROM jsonb_array_elements(p_groups_data)
    LOOP
        INSERT INTO public.supplier_program_groups (
            program_id, name, rule_type, rules, price_basis
        ) VALUES (
            p_program_id,
            v_group->>'name',
            v_group->>'rule_type',
            v_group->'rules',
            COALESCE(v_group->>'price_basis', 'pre_vat')
        ) RETURNING id INTO v_group_id;

        -- Insert Products cho Group này
        -- Sử dụng INSERT SELECT UNNEST để tối ưu hiệu năng
        IF (v_group->'product_ids') IS NOT NULL THEN
            INSERT INTO public.supplier_program_products (group_id, product_id)
            SELECT v_group_id, (value::BIGINT)
            FROM jsonb_array_elements_text(v_group->'product_ids');
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'message', 'Cập nhật chính sách thành công');
END;
$$;


ALTER FUNCTION "public"."update_full_supplier_program"("p_program_id" bigint, "p_program_data" "jsonb", "p_groups_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_inventory_check_info"("p_check_id" bigint, "p_note" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    BEGIN
        UPDATE public.inventory_checks
        SET 
            note = p_note,
            total_actual_value = (
                SELECT COALESCE(SUM(actual_quantity * cost_price), 0)
                FROM public.inventory_check_items WHERE check_id = p_check_id
            ),
            updated_at = NOW()
        WHERE id = p_check_id 
          AND status = 'DRAFT';
    END;
    $$;


ALTER FUNCTION "public"."update_inventory_check_info"("p_check_id" bigint, "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_outbound_package_count"("p_order_id" "uuid", "p_count" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    BEGIN
        IF p_count < 1 THEN
            RAISE EXCEPTION 'Số kiện hàng phải lớn hơn hoặc bằng 1.';
        END IF;

        UPDATE public.orders
        SET package_count = p_count,
            updated_at = NOW()
        WHERE id = p_order_id;

        RETURN jsonb_build_object('success', true, 'message', 'Đã cập nhật số kiện hàng.');
    END;
    $$;


ALTER FUNCTION "public"."update_outbound_package_count"("p_order_id" "uuid", "p_count" integer) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."update_prescription_template"("p_id" bigint, "p_data" "jsonb", "p_items" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_item JSONB;
BEGIN
    -- Update Header
    UPDATE public.prescription_templates
    SET 
        name = COALESCE(p_data->>'name', name),
        diagnosis = COALESCE(p_data->>'diagnosis', diagnosis),
        note = COALESCE(p_data->>'note', note),
        status = COALESCE(p_data->>'status', status),
        updated_at = NOW()
    WHERE id = p_id;

    -- Replace Items
    DELETE FROM public.prescription_template_items WHERE template_id = p_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.prescription_template_items (template_id, product_id, quantity, usage_instruction)
        VALUES (
            p_id,
            (v_item->>'product_id')::BIGINT, -- <-- QUAN TRỌNG: Ép kiểu sang BIGINT
            (v_item->>'quantity')::INTEGER,
            v_item->>'usage_instruction'
        );
    END LOOP;

    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."update_prescription_template"("p_id" bigint, "p_data" "jsonb", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_product"("p_id" bigint, "p_name" "text" DEFAULT NULL::"text", "p_sku" "text" DEFAULT NULL::"text", "p_barcode" "text" DEFAULT NULL::"text", "p_active_ingredient" "text" DEFAULT NULL::"text", "p_image_url" "text" DEFAULT NULL::"text", "p_category_name" "text" DEFAULT NULL::"text", "p_manufacturer_name" "text" DEFAULT NULL::"text", "p_distributor_id" bigint DEFAULT NULL::bigint, "p_status" "text" DEFAULT NULL::"text", "p_invoice_price" numeric DEFAULT NULL::numeric, "p_actual_cost" numeric DEFAULT NULL::numeric, "p_wholesale_unit" "text" DEFAULT NULL::"text", "p_retail_unit" "text" DEFAULT NULL::"text", "p_conversion_factor" integer DEFAULT NULL::integer, "p_wholesale_margin_value" numeric DEFAULT NULL::numeric, "p_wholesale_margin_type" "text" DEFAULT NULL::"text", "p_retail_margin_value" numeric DEFAULT NULL::numeric, "p_retail_margin_type" "text" DEFAULT NULL::"text", "p_items_per_carton" integer DEFAULT NULL::integer, "p_carton_weight" numeric DEFAULT NULL::numeric, "p_carton_dimensions" "text" DEFAULT NULL::"text", "p_purchasing_policy" "text" DEFAULT NULL::"text", "p_inventory_settings" "jsonb" DEFAULT '{}'::"jsonb", "p_description" "text" DEFAULT NULL::"text", "p_registration_number" "text" DEFAULT NULL::"text", "p_packing_spec" "text" DEFAULT NULL::"text", "p_updated_by" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
        v_warehouse_key TEXT;
        v_warehouse_id BIGINT;
        v_min_stock INT;
        v_max_stock INT;
        v_user_id UUID;
    BEGIN
        -- 1. Xác định người thực hiện (Ưu tiên tham số truyền vào -> Fallback auth.uid())
        v_user_id := COALESCE(p_updated_by, auth.uid());

        -- 2. Update Bảng Products
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
            description = COALESCE(p_description, description),
            registration_number = COALESCE(p_registration_number, registration_number),
            packing_spec = COALESCE(p_packing_spec, packing_spec),
            
            updated_at = now(),
            updated_by = v_user_id -- [KEY] Ghi nhận người sửa để Trigger hoạt động
        WHERE id = p_id;

        -- 3. Update Tồn kho Min/Max (Giữ nguyên logic cũ)
        IF p_inventory_settings IS NOT NULL AND p_inventory_settings <> '{}'::jsonb THEN
            DELETE FROM public.product_inventory WHERE product_id = p_id;
            
            FOR v_warehouse_key IN SELECT * FROM jsonb_object_keys(p_inventory_settings)
            LOOP
                SELECT id INTO v_warehouse_id FROM public.warehouses WHERE key = v_warehouse_key;
                IF v_warehouse_id IS NOT NULL THEN
                    v_min_stock := (p_inventory_settings -> v_warehouse_key ->> 'min')::INT;
                    v_max_stock := (p_inventory_settings -> v_warehouse_key ->> 'max')::INT;
                    
                    INSERT INTO public.product_inventory (product_id, warehouse_id, stock_quantity, min_stock, max_stock, updated_by)
                    VALUES (p_id, v_warehouse_id, 0, COALESCE(v_min_stock,0), COALESCE(v_max_stock,0), v_user_id)
                    ON CONFLICT (product_id, warehouse_id) 
                    DO UPDATE SET min_stock = EXCLUDED.min_stock, max_stock = EXCLUDED.max_stock, updated_by = v_user_id;
                END IF;
            END LOOP;
        END IF;
    END;
    $$;


ALTER FUNCTION "public"."update_product"("p_id" bigint, "p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_items_per_carton" integer, "p_carton_weight" numeric, "p_carton_dimensions" "text", "p_purchasing_policy" "text", "p_inventory_settings" "jsonb", "p_description" "text", "p_registration_number" "text", "p_packing_spec" "text", "p_updated_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_product_location"("p_warehouse_id" bigint, "p_product_id" bigint, "p_cabinet" "text", "p_row" "text", "p_slot" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_full_location TEXT;
    BEGIN
        -- 1. Tạo chuỗi hiển thị (Legacy support)
        -- Dùng NULLIF để biến chuỗi rỗng '' thành NULL, tránh lỗi format '--'
        v_full_location := CONCAT_WS('-', NULLIF(p_cabinet, ''), NULLIF(p_row, ''), NULLIF(p_slot, ''));
        
        IF v_full_location = '' THEN v_full_location := NULL; END IF;

        -- 2. UPSERT (Quan trọng)
        -- Logic: Thử Insert với tồn kho = 0. Nếu đã có thì chỉ Update vị trí.
        INSERT INTO public.product_inventory (
            warehouse_id, 
            product_id, 
            stock_quantity, -- Mặc định 0 nếu là record mới
            location_cabinet, 
            location_row, 
            location_slot, 
            shelf_location,
            updated_at,
            min_stock,
            max_stock
        )
        VALUES (
            p_warehouse_id,
            p_product_id,
            0, -- Stock quantity default
            p_cabinet,
            p_row,
            p_slot,
            v_full_location,
            NOW(),
            0, -- Default min
            0  -- Default max
        )
        ON CONFLICT (product_id, warehouse_id) 
        DO UPDATE SET 
            location_cabinet = EXCLUDED.location_cabinet,
            location_row = EXCLUDED.location_row,
            location_slot = EXCLUDED.location_slot,
            shelf_location = EXCLUDED.shelf_location,
            updated_at = NOW();
    END;
    $$;


ALTER FUNCTION "public"."update_product_location"("p_warehouse_id" bigint, "p_product_id" bigint, "p_cabinet" "text", "p_row" "text", "p_slot" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_product_location"("p_warehouse_id" bigint, "p_product_id" bigint, "p_cabinet" "text", "p_row" "text", "p_slot" "text") IS 'Cập nhật vị trí kho (Hỗ trợ UPSERT cho sản phẩm chưa nhập hàng)';



CREATE OR REPLACE FUNCTION "public"."update_product_status"("p_ids" bigint[], "p_status" "text") RETURNS "void"
    LANGUAGE "sql"
    AS $$
    UPDATE public.products
    SET status = p_status, updated_at = now()
    WHERE id = ANY(p_ids);
$$;


ALTER FUNCTION "public"."update_product_status"("p_ids" bigint[], "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_purchase_order"("p_po_id" bigint, "p_supplier_id" bigint, "p_expected_date" timestamp with time zone, "p_note" "text", "p_items" "jsonb", "p_delivery_method" "text" DEFAULT 'internal'::"text", "p_shipping_partner_id" bigint DEFAULT NULL::bigint, "p_shipping_fee" numeric DEFAULT 0, "p_status" "text" DEFAULT 'DRAFT'::"text", "p_total_packages" integer DEFAULT 1, "p_carrier_name" "text" DEFAULT NULL::"text", "p_carrier_contact" "text" DEFAULT NULL::"text", "p_carrier_phone" "text" DEFAULT NULL::"text", "p_expected_time" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
    DECLARE
        v_item JSONB;
        v_product_record RECORD;
        v_conversion_factor INTEGER;
        v_base_quantity INTEGER;
        v_total_amount NUMERIC := 0;
        v_qty_ordered INTEGER;
        v_current_status TEXT;
    BEGIN
        -- Check trạng thái
        SELECT status INTO v_current_status FROM public.purchase_orders WHERE id = p_po_id;
        IF v_current_status NOT IN ('DRAFT', 'PENDING', 'REJECTED') THEN
            RAISE EXCEPTION 'Không thể sửa đơn hàng đã được Duyệt hoặc Đang nhập kho.';
        END IF;

        -- Update Header (Bao gồm cả thông tin vận chuyển)
        UPDATE public.purchase_orders
        SET 
            supplier_id = p_supplier_id, 
            expected_delivery_date = p_expected_date,
            note = p_note, 
            delivery_method = p_delivery_method,
            shipping_partner_id = p_shipping_partner_id, 
            shipping_fee = COALESCE(p_shipping_fee, 0),
            status = p_status, 
            
            -- [LOGISTICS INFO UPDATE]
            total_packages = COALESCE(p_total_packages, 1),
            carrier_name = p_carrier_name,
            carrier_contact = p_carrier_contact,
            carrier_phone = p_carrier_phone,
            expected_delivery_time = p_expected_time,
            
            updated_at = NOW()
        WHERE id = p_po_id;

        -- Reset Items cũ
        DELETE FROM public.purchase_order_items WHERE po_id = p_po_id;

        -- Insert Items mới
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_qty_ordered := COALESCE((v_item->>'quantity_ordered')::INTEGER, (v_item->>'quantity')::INTEGER, 1);

            SELECT items_per_carton, wholesale_unit INTO v_product_record
            FROM public.products WHERE id = (v_item->>'product_id')::BIGINT;

            -- Logic quy đổi đơn vị
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
                v_qty_ordered,
                COALESCE(v_item->>'uom_ordered', v_item->>'uom'),
                COALESCE(v_item->>'uom_ordered', v_item->>'uom'),
                (v_item->>'unit_price')::NUMERIC,
                v_conversion_factor,
                v_base_quantity
            );

            v_total_amount := v_total_amount + (v_qty_ordered * (v_item->>'unit_price')::NUMERIC);
        END LOOP;

        -- Update Tổng tiền cuối cùng
        UPDATE public.purchase_orders
        SET total_amount = v_total_amount,
            final_amount = v_total_amount + COALESCE(p_shipping_fee, 0)
        WHERE id = p_po_id;

        RETURN TRUE;
    END;
    $$;


ALTER FUNCTION "public"."update_purchase_order"("p_po_id" bigint, "p_supplier_id" bigint, "p_expected_date" timestamp with time zone, "p_note" "text", "p_items" "jsonb", "p_delivery_method" "text", "p_shipping_partner_id" bigint, "p_shipping_fee" numeric, "p_status" "text", "p_total_packages" integer, "p_carrier_name" "text", "p_carrier_contact" "text", "p_carrier_phone" "text", "p_expected_time" timestamp with time zone) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."update_service_package"("p_id" bigint, "p_data" "jsonb", "p_items" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_calculated_cost NUMERIC;
  v_item JSONB;
BEGIN
  -- 1. Tính lại giá vốn mới
  v_calculated_cost := public.calculate_package_cost(p_items);

  -- 2. Cập nhật bảng chính
  UPDATE public.service_packages
  SET
    name = p_data->>'name',
    sku = p_data->>'sku',
    unit = p_data->>'unit',
    type = (p_data->>'type')::public.service_package_type,
    price = (p_data->>'price')::NUMERIC,
    total_cost_price = v_calculated_cost, -- Cập nhật giá vốn mới
    revenue_account_id = p_data->>'revenueAccountId',
    valid_from = (p_data->>'validFrom')::DATE,
    valid_to = (p_data->>'validTo')::DATE,
    status = (p_data->>'status')::public.account_status,
    validity_days = (p_data->>'validityDays')::INT,
    applicable_branches = (SELECT array_agg(value::BIGINT) FROM jsonb_array_elements_text(p_data->'applicableBranches') AS t(value)),
    applicable_channels = p_data->>'applicableChannels',
    updated_at = now()
  WHERE id = p_id;

  -- 3. Xóa sạch các items con cũ
  DELETE FROM public.service_package_items WHERE package_id = p_id;
  
  -- 4. Thêm lại các items con mới
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.service_package_items (
      package_id, item_id, quantity, item_type, schedule_days
    )
    VALUES (
      p_id,
      (v_item->>'item_id')::BIGINT,
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'item_type')::TEXT,
      (v_item->>'schedule_days')::INT
    );
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."update_service_package"("p_id" bigint, "p_data" "jsonb", "p_items" "jsonb") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."update_supplier"("p_id" bigint, "p_name" "text", "p_tax_code" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_address" "text", "p_payment_term" "text", "p_bank_account" "text", "p_bank_name" "text", "p_bank_holder" "text", "p_delivery_method" "text", "p_lead_time" integer, "p_status" "text", "p_notes" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_bank_bin TEXT;
BEGIN
    -- LOGIC TỰ ĐỘNG TÌM BIN (Giống hàm Create)
    IF p_bank_name IS NOT NULL AND p_bank_name <> '' THEN
        SELECT bin INTO v_bank_bin 
        FROM public.banks 
        WHERE name ILIKE p_bank_name 
           OR short_name ILIKE p_bank_name 
           OR code ILIKE p_bank_name
        LIMIT 1;
    END IF;

    UPDATE public.suppliers
    SET
        name = p_name,
        tax_code = p_tax_code,
        contact_person = p_contact_person,
        phone = p_phone,
        email = p_email,
        address = p_address,
        payment_term = p_payment_term,
        bank_account = p_bank_account,
        bank_name = p_bank_name,
        bank_holder = p_bank_holder,
        delivery_method = p_delivery_method,
        lead_time = p_lead_time,
        status = p_status,
        notes = p_notes,
        bank_bin = v_bank_bin -- Cập nhật tự động
    WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."update_supplier"("p_id" bigint, "p_name" "text", "p_tax_code" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_address" "text", "p_payment_term" "text", "p_bank_account" "text", "p_bank_name" "text", "p_bank_holder" "text", "p_delivery_method" "text", "p_lead_time" integer, "p_status" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_assignments"("p_user_id" "uuid", "p_assignments" "jsonb"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    assignment JSONB;
BEGIN
    -- A. Xóa tất cả phân quyền cũ của user này
    DELETE FROM public.user_roles WHERE user_id = p_user_id;

    -- B. Loop qua mảng và insert lại
    IF p_assignments IS NOT NULL THEN
        FOREACH assignment IN ARRAY p_assignments
        LOOP
            INSERT INTO public.user_roles (user_id, role_id, branch_id)
            VALUES (
                p_user_id,
                (assignment->>'roleId')::UUID,   -- Chú ý: Key là roleId (CamelCase) khớp với Frontend
                (assignment->>'branchId')::BIGINT -- Chú ý: Key là branchId
            );
        END LOOP;
    END IF;
END;
$$;


ALTER FUNCTION "public"."update_user_assignments"("p_user_id" "uuid", "p_assignments" "jsonb"[]) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."update_vaccination_template"("p_id" bigint, "p_data" "jsonb", "p_items" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_item JSONB;
BEGIN
    UPDATE public.vaccination_templates
    SET 
        name = COALESCE(p_data->>'name', name),
        description = COALESCE(p_data->>'description', description),
        min_age_months = (p_data->>'min_age_months')::INTEGER,
        max_age_months = (p_data->>'max_age_months')::INTEGER,
        status = COALESCE(p_data->>'status', status),
        updated_at = NOW()
    WHERE id = p_id;

    DELETE FROM public.vaccination_template_items WHERE template_id = p_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.vaccination_template_items (template_id, product_id, shot_name, days_after_start, note)
        VALUES (
            p_id,
            (v_item->>'product_id')::BIGINT,
            v_item->>'shot_name',
            COALESCE((v_item->>'days_after_start')::INTEGER, 0),
            v_item->>'note'
        );
    END LOOP;

    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."update_vaccination_template"("p_id" bigint, "p_data" "jsonb", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_product_with_units"("p_product_json" "jsonb", "p_units_json" "jsonb" DEFAULT NULL::"jsonb", "p_contents_json" "jsonb" DEFAULT NULL::"jsonb", "p_inventory_json" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_product_id BIGINT;
    
    -- Biến cho xử lý Unit
    v_unit_data JSONB;
    v_kept_unit_ids BIGINT[];
    v_base_cost NUMERIC;      
    v_unit_cost NUMERIC;      
    v_unit_price NUMERIC;     
    v_conversion_rate INT;
    
    -- Biến lưu cấu hình Margin
    v_retail_margin_val NUMERIC;
    v_retail_margin_type TEXT;
    v_wholesale_margin_val NUMERIC;
    v_wholesale_margin_type TEXT;
    
    -- Biến tạm tính giá
    v_selected_margin_val NUMERIC;
    v_selected_margin_type TEXT;
    
    -- Biến cho Inventory
    v_inv_data JSONB;
BEGIN
    -- [PHẦN 1: PRODUCT - GIỮ NGUYÊN]
    IF (p_product_json->>'id') IS NOT NULL AND (p_product_json->>'id') <> '' AND (p_product_json->>'id') <> '0' THEN
        -- === UPDATE PRODUCT ===
        v_product_id := (p_product_json->>'id')::BIGINT;
        
        UPDATE public.products
        SET
            sku = p_product_json->>'sku',
            name = p_product_json->>'name',
            barcode = p_product_json->>'barcode',
            registration_number = p_product_json->>'registration_number',
            manufacturer_name = p_product_json->>'manufacturer_name',
            distributor_id = CASE WHEN (p_product_json->>'distributor_id') IS NOT NULL AND (p_product_json->>'distributor_id') <> '' THEN (p_product_json->>'distributor_id')::BIGINT ELSE NULL END,
            category_name = p_product_json->>'category_name',
            packing_spec = p_product_json->>'packing_spec',
            active_ingredient = p_product_json->>'active_ingredient',
            usage_instructions = COALESCE(p_product_json->'usage_instructions', '{}'::jsonb),
            image_url = p_product_json->>'image_url',
            
            actual_cost = COALESCE((p_product_json->>'actual_cost')::NUMERIC, 0),
            wholesale_margin_value = COALESCE((p_product_json->>'wholesale_margin_value')::NUMERIC, 0),
            wholesale_margin_type = COALESCE(p_product_json->>'wholesale_margin_type', 'amount'),
            retail_margin_value = COALESCE((p_product_json->>'retail_margin_value')::NUMERIC, 0),
            retail_margin_type = COALESCE(p_product_json->>'retail_margin_type', 'amount'),
            
            items_per_carton = COALESCE((p_product_json->>'items_per_carton')::INTEGER, 1),
            carton_weight = COALESCE((p_product_json->>'carton_weight')::NUMERIC, 0),
            carton_dimensions = p_product_json->>'carton_dimensions',
            purchasing_policy = COALESCE(p_product_json->>'purchasing_policy', 'ALLOW_LOOSE'),
            
            updated_at = NOW()
        WHERE id = v_product_id
        RETURNING actual_cost, retail_margin_value, retail_margin_type, wholesale_margin_value, wholesale_margin_type
        INTO v_base_cost, v_retail_margin_val, v_retail_margin_type, v_wholesale_margin_val, v_wholesale_margin_type;
    ELSE
        -- === INSERT PRODUCT ===
        INSERT INTO public.products (
            sku, name, barcode, registration_number, manufacturer_name, distributor_id,
            category_name, packing_spec, active_ingredient, usage_instructions, status,
            image_url, actual_cost, wholesale_margin_value, wholesale_margin_type,
            retail_margin_value, retail_margin_type, items_per_carton, carton_weight, carton_dimensions, purchasing_policy,
            created_at, updated_at
        ) VALUES (
            COALESCE(p_product_json->>'sku', 'SP-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0')),
            p_product_json->>'name', p_product_json->>'barcode', p_product_json->>'registration_number', p_product_json->>'manufacturer_name',
            CASE WHEN (p_product_json->>'distributor_id') IS NOT NULL AND (p_product_json->>'distributor_id') <> '' THEN (p_product_json->>'distributor_id')::BIGINT ELSE NULL END,
            p_product_json->>'category_name', p_product_json->>'packing_spec', p_product_json->>'active_ingredient',
            COALESCE(p_product_json->'usage_instructions', '{}'::jsonb), 'active',
            p_product_json->>'image_url',
            COALESCE((p_product_json->>'actual_cost')::NUMERIC, 0),
            COALESCE((p_product_json->>'wholesale_margin_value')::NUMERIC, 0),
            COALESCE(p_product_json->>'wholesale_margin_type', 'amount'),
            COALESCE((p_product_json->>'retail_margin_value')::NUMERIC, 0),
            COALESCE(p_product_json->>'retail_margin_type', 'amount'),
            COALESCE((p_product_json->>'items_per_carton')::INTEGER, 1),
            COALESCE((p_product_json->>'carton_weight')::NUMERIC, 0),
            p_product_json->>'carton_dimensions',
            COALESCE(p_product_json->>'purchasing_policy', 'ALLOW_LOOSE'),
            NOW(), NOW()
        ) 
        RETURNING id, actual_cost, retail_margin_value, retail_margin_type, wholesale_margin_value, wholesale_margin_type
        INTO v_product_id, v_base_cost, v_retail_margin_val, v_retail_margin_type, v_wholesale_margin_val, v_wholesale_margin_type;
    END IF;

    -- ==================================================================================
    -- [2. UNITS] XỬ LÝ ĐƠN VỊ (SYNC PRICE COLUMNS HERE)
    -- ==================================================================================
    
    -- Filter Unit IDs
    SELECT COALESCE(array_agg((x->>'id')::BIGINT), ARRAY[]::BIGINT[]) INTO v_kept_unit_ids
    FROM jsonb_array_elements(p_units_json) x
    WHERE (x->>'id') IS NOT NULL AND (x->>'id') <> '' AND (x->>'id') <> '0';

    DELETE FROM public.product_units WHERE product_id = v_product_id AND id <> ALL(v_kept_unit_ids);

    IF p_units_json IS NOT NULL THEN
        FOR v_unit_data IN SELECT * FROM jsonb_array_elements(p_units_json)
        LOOP
            v_conversion_rate := COALESCE((v_unit_data->>'conversion_rate')::INTEGER, 1);
            v_unit_cost := v_base_cost * v_conversion_rate;

            -- Logic Tính Giá Bán (Percent / Amount)
            IF (v_unit_data->>'price') IS NOT NULL AND (v_unit_data->>'price')::NUMERIC > 0 THEN
                v_unit_price := (v_unit_data->>'price')::NUMERIC;
            ELSE
                IF (v_unit_data->>'unit_type') = 'wholesale' OR (v_unit_data->>'unit_type') = 'logistics' THEN
                    v_selected_margin_val := v_wholesale_margin_val;
                    v_selected_margin_type := v_wholesale_margin_type;
                ELSE
                    v_selected_margin_val := v_retail_margin_val;
                    v_selected_margin_type := v_retail_margin_type;
                END IF;

                IF v_selected_margin_type = 'percent' THEN
                    v_unit_price := v_unit_cost * (1 + v_selected_margin_val / 100);
                ELSE
                    -- Logic Amount: Giá bán = Giá vốn + (Lãi * Rate)
                    v_unit_price := v_unit_cost + (v_selected_margin_val * v_conversion_rate);
                END IF;
                
                v_unit_price := CEIL(v_unit_price / 100.0) * 100;
            END IF;

            -- [CORE FIX]: Update CẢ 2 CỘT 'price' và 'price_sell'
            IF (v_unit_data->>'id') IS NOT NULL AND (v_unit_data->>'id') <> '' AND (v_unit_data->>'id') <> '0' THEN
                UPDATE public.product_units
                SET 
                    unit_name = v_unit_data->>'unit_name',
                    unit_type = COALESCE(v_unit_data->>'unit_type', 'retail'),
                    conversion_rate = v_conversion_rate,
                    price_cost = v_unit_cost,
                    
                    price_sell = v_unit_price, -- Cột chuẩn
                    price = v_unit_price,      -- Cột legacy (Để list hiển thị đúng)
                    
                    barcode = v_unit_data->>'barcode',
                    is_base = COALESCE((v_unit_data->>'is_base')::BOOLEAN, false),
                    is_direct_sale = COALESCE((v_unit_data->>'is_direct_sale')::BOOLEAN, true),
                    updated_at = NOW()
                WHERE id = (v_unit_data->>'id')::BIGINT;
            ELSE
                INSERT INTO public.product_units (
                    product_id, unit_name, unit_type, conversion_rate, 
                    price_cost, price_sell, price, -- Thêm cột price
                    barcode, is_base, is_direct_sale, created_at, updated_at
                ) VALUES (
                    v_product_id,
                    v_unit_data->>'unit_name',
                    COALESCE(v_unit_data->>'unit_type', 'retail'),
                    v_conversion_rate,
                    v_unit_cost,
                    v_unit_price, -- Cột chuẩn
                    v_unit_price, -- Cột legacy
                    v_unit_data->>'barcode',
                    COALESCE((v_unit_data->>'is_base')::BOOLEAN, false),
                    COALESCE((v_unit_data->>'is_direct_sale')::BOOLEAN, true),
                    NOW(), NOW()
                );
            END IF;
        END LOOP;
    END IF;

    -- [3. CONTENT & 4. INVENTORY - GIỮ NGUYÊN]
    IF p_contents_json IS NOT NULL THEN
        INSERT INTO public.product_contents (
            product_id, channel, language_code,
            description_html, short_description,
            seo_title, seo_description, seo_keywords,
            is_published, updated_at
        ) VALUES (
            v_product_id, 'website', 'vi',
            p_contents_json->>'description_html',
            p_contents_json->>'short_description',
            p_contents_json->>'seo_title',
            p_contents_json->>'seo_description',
            (SELECT ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_contents_json->'seo_keywords', '[]'::jsonb)))),
            COALESCE((p_contents_json->>'is_published')::BOOLEAN, true),
            NOW()
        )
        ON CONFLICT (product_id, channel) DO UPDATE SET
            description_html = EXCLUDED.description_html,
            short_description = EXCLUDED.short_description,
            seo_title = EXCLUDED.seo_title,
            seo_description = EXCLUDED.seo_description,
            seo_keywords = EXCLUDED.seo_keywords,
            updated_at = NOW();
    END IF;

    IF p_inventory_json IS NOT NULL AND jsonb_typeof(p_inventory_json) = 'array' THEN
        FOR v_inv_data IN SELECT * FROM jsonb_array_elements(p_inventory_json)
        LOOP
            IF (v_inv_data->>'warehouse_id') IS NOT NULL THEN
                INSERT INTO public.product_inventory (
                    product_id, warehouse_id, min_stock, max_stock,
                    shelf_location, location_cabinet, location_row, location_slot,
                    stock_quantity, updated_at
                ) VALUES (
                    v_product_id, (v_inv_data->>'warehouse_id')::BIGINT,
                    (v_inv_data->>'min_stock')::NUMERIC, (v_inv_data->>'max_stock')::NUMERIC,
                    v_inv_data->>'shelf_location', v_inv_data->>'location_cabinet',
                    v_inv_data->>'location_row', v_inv_data->>'location_slot',
                    0, NOW()
                )
                ON CONFLICT (warehouse_id, product_id) DO UPDATE SET
                    min_stock = EXCLUDED.min_stock,
                    max_stock = EXCLUDED.max_stock,
                    shelf_location = EXCLUDED.shelf_location,
                    location_cabinet = EXCLUDED.location_cabinet,
                    location_row = EXCLUDED.location_row,
                    location_slot = EXCLUDED.location_slot,
                    updated_at = NOW();
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'product_id', v_product_id);
END;
$$;


ALTER FUNCTION "public"."upsert_product_with_units"("p_product_json" "jsonb", "p_units_json" "jsonb", "p_contents_json" "jsonb", "p_inventory_json" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."upsert_product_with_units"("p_product_json" "jsonb", "p_units_json" "jsonb", "p_contents_json" "jsonb", "p_inventory_json" "jsonb") IS 'V6 Final: Full Financials & Logistics Support';



CREATE OR REPLACE FUNCTION "public"."verify_promotion_code"("p_code" "text", "p_customer_id" bigint, "p_order_value" numeric) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_promo record;
    v_user_usage_count integer;
    v_discount_amount numeric := 0;
begin
    -- Lấy thông tin mã
    select * into v_promo from public.promotions where code = p_code;

    -- Các bước kiểm tra cơ bản
    if v_promo is null then return json_build_object('valid', false, 'message', 'Mã không tồn tại.'); end if;
    if v_promo.status <> 'active' then return json_build_object('valid', false, 'message', 'Mã ngưng hoạt động.'); end if;
    if now() < v_promo.valid_from or now() > v_promo.valid_to then return json_build_object('valid', false, 'message', 'Mã hết hạn.'); end if;
    if v_promo.total_usage_limit is not null and v_promo.usage_count >= v_promo.total_usage_limit then return json_build_object('valid', false, 'message', 'Mã đã hết lượt toàn sàn.'); end if;
    if p_order_value < v_promo.min_order_value then return json_build_object('valid', false, 'message', 'Chưa đạt giá trị đơn hàng tối thiểu.'); end if;

    -- Kiểm tra sở hữu (Nếu là mã riêng)
    if v_promo.type in ('personal', 'point_exchange') and v_promo.customer_id is not null and v_promo.customer_id <> p_customer_id then
        return json_build_object('valid', false, 'message', 'Mã này không áp dụng cho tài khoản của bạn.');
    end if;

    -- Kiểm tra giới hạn số lần dùng của người này
    select count(*) into v_user_usage_count
    from public.promotion_usages
    where promotion_id = v_promo.id and customer_id = p_customer_id;

    if v_promo.usage_limit_per_user is not null and v_user_usage_count >= v_promo.usage_limit_per_user then
        return json_build_object('valid', false, 'message', 'Bạn đã dùng hết số lần cho phép của mã này.');
    end if;

    -- Tính toán tiền giảm
    if v_promo.discount_type = 'fixed' then 
        v_discount_amount := v_promo.discount_value;
    else 
        v_discount_amount := (p_order_value * v_promo.discount_value) / 100;
        if v_promo.max_discount_value is not null and v_discount_amount > v_promo.max_discount_value then
            v_discount_amount := v_promo.max_discount_value;
        end if;
    end if;
    
    if v_discount_amount > p_order_value then v_discount_amount := p_order_value; end if;

    return json_build_object(
        'valid', true, 
        'message', 'Áp dụng thành công!',
        'discount_amount', v_discount_amount,
        'promotion', row_to_json(v_promo)
    );
end;
$$;


ALTER FUNCTION "public"."verify_promotion_code"("p_code" "text", "p_customer_id" bigint, "p_order_value" numeric) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" bigint NOT NULL,
    "doctor_id" "uuid",
    "service_type" "public"."appointment_service_type" DEFAULT 'examination'::"public"."appointment_service_type",
    "appointment_time" timestamp with time zone NOT NULL,
    "status" "public"."appointment_status" DEFAULT 'pending'::"public"."appointment_status",
    "symptoms" "jsonb" DEFAULT '[]'::"jsonb",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


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



CREATE TABLE IF NOT EXISTS "public"."batches" (
    "id" bigint NOT NULL,
    "product_id" bigint,
    "batch_code" "text" NOT NULL,
    "expiry_date" "date" NOT NULL,
    "manufacturing_date" "date",
    "inbound_price" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."batches" OWNER TO "postgres";


ALTER TABLE "public"."batches" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."batches_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



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


CREATE TABLE IF NOT EXISTS "public"."clinical_queues" (
    "id" bigint NOT NULL,
    "appointment_id" "uuid",
    "customer_id" bigint NOT NULL,
    "doctor_id" "uuid",
    "queue_number" integer NOT NULL,
    "status" "public"."queue_status" DEFAULT 'waiting'::"public"."queue_status",
    "priority_level" "public"."queue_priority" DEFAULT 'normal'::"public"."queue_priority",
    "checked_in_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."clinical_queues" OWNER TO "postgres";


ALTER TABLE "public"."clinical_queues" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."clinical_queues_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



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



CREATE TABLE IF NOT EXISTS "public"."customer_segment_members" (
    "id" bigint NOT NULL,
    "segment_id" bigint NOT NULL,
    "customer_id" bigint NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customer_segment_members" OWNER TO "postgres";


ALTER TABLE "public"."customer_segment_members" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."customer_segment_members_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."customer_segments" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "type" "text" NOT NULL,
    "criteria" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "customer_segments_type_check" CHECK (("type" = ANY (ARRAY['static'::"text", 'dynamic'::"text"])))
);


ALTER TABLE "public"."customer_segments" OWNER TO "postgres";


COMMENT ON TABLE "public"."customer_segments" IS 'Lưu trữ các nhóm khách hàng (Tĩnh và Động)';



ALTER TABLE "public"."customer_segments" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."customer_segments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."customer_vouchers" (
    "id" bigint NOT NULL,
    "customer_id" bigint NOT NULL,
    "promotion_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "usage_remaining" integer DEFAULT 1,
    CONSTRAINT "customer_vouchers_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'used'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."customer_vouchers" OWNER TO "postgres";


ALTER TABLE "public"."customer_vouchers" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."customer_vouchers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



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
    "contact_person_phone" "text",
    "last_purchase_at" timestamp with time zone
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."customers"."last_purchase_at" IS 'Thời điểm hoàn thành đơn hàng gần nhất (Dùng cho CRM Retention)';



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



CREATE TABLE IF NOT EXISTS "public"."finance_invoice_allocations" (
    "id" bigint NOT NULL,
    "invoice_id" bigint,
    "po_id" bigint,
    "allocated_amount" numeric DEFAULT 0,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "finance_invoice_allocations_allocated_amount_check" CHECK (("allocated_amount" >= (0)::numeric))
);


ALTER TABLE "public"."finance_invoice_allocations" OWNER TO "postgres";


ALTER TABLE "public"."finance_invoice_allocations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."finance_invoice_allocations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."finance_invoices" (
    "id" bigint NOT NULL,
    "invoice_number" "text",
    "invoice_symbol" "text",
    "invoice_date" "date",
    "supplier_name_raw" "text",
    "supplier_tax_code" "text",
    "supplier_id" bigint,
    "total_amount_pre_tax" numeric DEFAULT 0,
    "tax_amount" numeric DEFAULT 0,
    "total_amount_post_tax" numeric DEFAULT 0,
    "items_json" "jsonb" DEFAULT '[]'::"jsonb",
    "parsed_data" "jsonb",
    "file_url" "text" NOT NULL,
    "file_type" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "supplier_address_raw" "text",
    CONSTRAINT "finance_invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'verified'::"text", 'posted'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."finance_invoices" OWNER TO "postgres";


COMMENT ON COLUMN "public"."finance_invoices"."items_json" IS 'Chứa mảng items: [{name, unit, qty, price, total, vat_rate, lot, exp}]';



ALTER TABLE "public"."finance_invoices" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."finance_invoices_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."finance_transactions" (
    "id" bigint NOT NULL,
    "code" "text" NOT NULL,
    "transaction_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "flow" "public"."transaction_flow" NOT NULL,
    "business_type" "public"."business_type" DEFAULT 'other'::"public"."business_type" NOT NULL,
    "category_id" bigint,
    "amount" numeric NOT NULL,
    "fund_account_id" bigint NOT NULL,
    "partner_type" "text",
    "partner_id" "text",
    "partner_name_cache" "text",
    "ref_type" "text",
    "ref_id" "text",
    "description" "text",
    "evidence_url" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "public"."transaction_status" DEFAULT 'pending'::"public"."transaction_status" NOT NULL,
    "cash_tally" "jsonb",
    "ref_advance_id" bigint,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "target_bank_info" "jsonb",
    CONSTRAINT "finance_transactions_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."finance_transactions" OWNER TO "postgres";


ALTER TABLE "public"."finance_transactions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."finance_transactions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



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
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "currency" "text" DEFAULT 'VND'::"text",
    "balance" numeric DEFAULT 0 NOT NULL,
    "bank_info" "jsonb",
    "description" "text"
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



CREATE TABLE IF NOT EXISTS "public"."inventory_batches" (
    "id" bigint NOT NULL,
    "warehouse_id" bigint,
    "product_id" bigint,
    "batch_id" bigint,
    "quantity" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inventory_batches" OWNER TO "postgres";


ALTER TABLE "public"."inventory_batches" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."inventory_batches_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."inventory_check_items" (
    "id" bigint NOT NULL,
    "check_id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "batch_code" "text",
    "expiry_date" "date",
    "system_quantity" integer DEFAULT 0,
    "actual_quantity" integer DEFAULT 0,
    "diff_quantity" integer GENERATED ALWAYS AS (("actual_quantity" - "system_quantity")) STORED,
    "cost_price" numeric DEFAULT 0,
    "location_snapshot" "text",
    "difference_reason" "text"
);


ALTER TABLE "public"."inventory_check_items" OWNER TO "postgres";


ALTER TABLE "public"."inventory_check_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."inventory_check_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."inventory_checks" (
    "id" bigint NOT NULL,
    "code" "text" NOT NULL,
    "warehouse_id" bigint NOT NULL,
    "total_system_value" numeric DEFAULT 0,
    "total_actual_value" numeric DEFAULT 0,
    "total_diff_value" numeric GENERATED ALWAYS AS (("total_actual_value" - "total_system_value")) STORED,
    "status" "text" DEFAULT 'DRAFT'::"text",
    "note" "text",
    "created_by" "uuid",
    "verified_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "inventory_checks_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'COMPLETED'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."inventory_checks" OWNER TO "postgres";


ALTER TABLE "public"."inventory_checks" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."inventory_checks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."inventory_receipt_items" (
    "id" bigint NOT NULL,
    "receipt_id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "quantity" integer NOT NULL,
    "lot_number" "text",
    "expiry_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "serial_number" "text",
    "qc_status" "text" DEFAULT 'pass'::"text",
    "unit_price" numeric DEFAULT 0 NOT NULL,
    "discount_amount" numeric DEFAULT 0,
    "vat_rate" numeric DEFAULT 0,
    "sub_total" numeric GENERATED ALWAYS AS (((("quantity")::numeric * "unit_price") - "discount_amount")) STORED,
    "allocated_cost" numeric DEFAULT 0,
    "final_unit_cost" numeric DEFAULT 0,
    CONSTRAINT "inventory_receipt_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."inventory_receipt_items" OWNER TO "postgres";


ALTER TABLE "public"."inventory_receipt_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."inventory_receipt_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."inventory_receipts" (
    "id" bigint NOT NULL,
    "code" "text" NOT NULL,
    "po_id" bigint,
    "warehouse_id" bigint NOT NULL,
    "creator_id" "uuid" DEFAULT "auth"."uid"(),
    "receipt_date" timestamp with time zone DEFAULT "now"(),
    "note" "text",
    "status" "text" DEFAULT 'completed'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "total_goods_amount" numeric DEFAULT 0,
    "discount_order" numeric DEFAULT 0,
    "shipping_fee" numeric DEFAULT 0,
    "other_fee" numeric DEFAULT 0,
    "final_amount" numeric DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inventory_receipts" OWNER TO "postgres";


ALTER TABLE "public"."inventory_receipts" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."inventory_receipts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."inventory_transactions" (
    "id" bigint NOT NULL,
    "warehouse_id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "batch_id" bigint,
    "type" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "ref_id" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "description" "text",
    "action_group" "text",
    "unit_price" numeric DEFAULT 0,
    "partner_id" bigint,
    "total_value" numeric GENERATED ALWAYS AS ((("quantity")::numeric * "unit_price")) STORED
);


ALTER TABLE "public"."inventory_transactions" OWNER TO "postgres";


ALTER TABLE "public"."inventory_transactions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."inventory_transactions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."inventory_transfer_batch_items" (
    "id" bigint NOT NULL,
    "transfer_item_id" bigint NOT NULL,
    "batch_id" bigint NOT NULL,
    "quantity" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inventory_transfer_batch_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."inventory_transfer_batch_items" IS 'Chi tiết Lô hàng được chỉ định để xuất kho (FEFO)';



ALTER TABLE "public"."inventory_transfer_batch_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."inventory_transfer_batch_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."inventory_transfer_items" (
    "id" bigint NOT NULL,
    "transfer_id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "unit" "text",
    "conversion_factor" integer DEFAULT 1,
    "qty_requested" numeric DEFAULT 0,
    "qty_approved" numeric DEFAULT 0,
    "qty_shipped" numeric DEFAULT 0,
    "qty_received" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inventory_transfer_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."inventory_transfer_items" IS 'Chi tiết sản phẩm cần chuyển (Chưa định danh Lô)';



ALTER TABLE "public"."inventory_transfer_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."inventory_transfer_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."inventory_transfers" (
    "id" bigint NOT NULL,
    "code" "text" NOT NULL,
    "source_warehouse_id" bigint NOT NULL,
    "dest_warehouse_id" bigint NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_by" "uuid",
    "note" "text",
    "carrier_name" "text",
    "carrier_contact" "text",
    "carrier_phone" "text",
    "expected_arrival_at" timestamp with time zone,
    "is_urgent" boolean DEFAULT false,
    "urgency_approved" boolean DEFAULT false,
    "packages_sent" integer DEFAULT 0,
    "packages_received" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "received_by" "uuid",
    "received_at" timestamp with time zone,
    CONSTRAINT "inventory_transfers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'shipping'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."inventory_transfers" OWNER TO "postgres";


COMMENT ON TABLE "public"."inventory_transfers" IS 'Phiếu chuyển kho (Header)';



ALTER TABLE "public"."inventory_transfers" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."inventory_transfers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text",
    "type" "text" DEFAULT 'info'::"text",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" bigint NOT NULL,
    "quantity" integer NOT NULL,
    "uom" "text" NOT NULL,
    "conversion_factor" integer DEFAULT 1,
    "base_quantity" integer GENERATED ALWAYS AS (("quantity" * "conversion_factor")) STORED,
    "unit_price" numeric NOT NULL,
    "discount" numeric DEFAULT 0,
    "is_gift" boolean DEFAULT false,
    "note" "text",
    "batch_no" "text",
    "expiry_date" "date",
    "total_line" numeric GENERATED ALWAYS AS (((("quantity")::numeric * "unit_price") - "discount")) STORED,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "quantity_picked" integer DEFAULT 0,
    CONSTRAINT "order_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "order_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "customer_id" bigint,
    "creator_id" "uuid",
    "status" "text" DEFAULT 'PENDING'::"text",
    "total_amount" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "final_amount" numeric DEFAULT 0,
    "paid_amount" numeric DEFAULT 0,
    "shipping_fee" numeric DEFAULT 0,
    "discount_amount" numeric DEFAULT 0,
    "quote_expires_at" timestamp with time zone,
    "delivery_address" "text",
    "delivery_time" "text",
    "fee_payer" "text" DEFAULT 'receiver'::"text",
    "shipping_partner_id" bigint,
    "note" "text",
    "delivery_method" "text" DEFAULT 'internal'::"text",
    "package_count" integer DEFAULT 1,
    "order_type" "text" DEFAULT 'B2B'::"text",
    "customer_b2c_id" bigint,
    "payment_status" "text" DEFAULT 'unpaid'::"text",
    "remittance_status" "text" DEFAULT 'pending'::"text",
    "remittance_transaction_id" bigint,
    "payment_method" "text" DEFAULT 'cash'::"text",
    "warehouse_id" bigint,
    "invoice_status" "public"."invoice_request_status" DEFAULT 'none'::"public"."invoice_request_status",
    "invoice_request_data" "jsonb"
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "module" "text" NOT NULL
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prescription_template_items" (
    "id" bigint NOT NULL,
    "template_id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "quantity" integer NOT NULL,
    "usage_instruction" "text" NOT NULL,
    CONSTRAINT "prescription_template_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."prescription_template_items" OWNER TO "postgres";


ALTER TABLE "public"."prescription_template_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."prescription_template_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."prescription_templates" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."prescription_templates_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."product_activity_logs" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "product_id" bigint,
    "action_type" "text",
    "old_value" "text",
    "new_value" "text",
    "note" "text"
);


ALTER TABLE "public"."product_activity_logs" OWNER TO "postgres";


ALTER TABLE "public"."product_activity_logs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."product_activity_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."product_contents" (
    "id" bigint NOT NULL,
    "product_id" bigint,
    "channel" "text" NOT NULL,
    "description_html" "text",
    "short_description" "text",
    "images" "jsonb" DEFAULT '[]'::"jsonb",
    "is_published" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "seo_title" "text",
    "seo_description" "text",
    "seo_keywords" "text"[],
    "language_code" "text" DEFAULT 'vi'::"text",
    "updated_by" "uuid"
);


ALTER TABLE "public"."product_contents" OWNER TO "postgres";


COMMENT ON COLUMN "public"."product_contents"."channel" IS 'Kênh phân phối: default, website, shopee, pos...';



ALTER TABLE "public"."product_contents" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."product_contents_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."product_inventory" (
    "id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "warehouse_id" bigint NOT NULL,
    "stock_quantity" integer DEFAULT 0 NOT NULL,
    "min_stock" integer DEFAULT 0,
    "max_stock" integer DEFAULT 0,
    "shelf_location" "text" DEFAULT 'Chưa xếp'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "location_cabinet" "text",
    "location_row" "text",
    "location_slot" "text",
    "updated_by" "uuid"
);


ALTER TABLE "public"."product_inventory" OWNER TO "postgres";


COMMENT ON COLUMN "public"."product_inventory"."updated_at" IS 'Thời gian cập nhật tồn kho hoặc cấu hình Min/Max';



CREATE SEQUENCE IF NOT EXISTS "public"."product_inventory_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."product_inventory_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."product_inventory_id_seq" OWNED BY "public"."product_inventory"."id";



CREATE TABLE IF NOT EXISTS "public"."product_units" (
    "id" bigint NOT NULL,
    "product_id" bigint,
    "unit_name" "text" NOT NULL,
    "conversion_rate" integer DEFAULT 1,
    "barcode" "text",
    "is_base" boolean DEFAULT false,
    "is_direct_sale" boolean DEFAULT true,
    "price_cost" numeric DEFAULT 0,
    "price_sell" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "unit_type" "text" DEFAULT 'retail'::"text",
    "price" numeric DEFAULT 0,
    CONSTRAINT "chk_unit_type" CHECK (("unit_type" = ANY (ARRAY['base'::"text", 'retail'::"text", 'wholesale'::"text", 'logistics'::"text"])))
);


ALTER TABLE "public"."product_units" OWNER TO "postgres";


COMMENT ON COLUMN "public"."product_units"."price" IS 'Giá bán ra áp dụng cho đơn vị này';



ALTER TABLE "public"."product_units" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."product_units_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



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
    "retail_margin_type" "text" DEFAULT '%'::"text",
    "items_per_carton" integer DEFAULT 1,
    "carton_weight" numeric DEFAULT 0,
    "carton_dimensions" "text",
    "purchasing_policy" "text" DEFAULT 'ALLOW_LOOSE'::"text",
    "registration_number" "text",
    "packing_spec" "text",
    "stock_management_type" "public"."stock_management_type" DEFAULT 'lot_date'::"public"."stock_management_type",
    "wholesale_margin_rate" numeric DEFAULT 0,
    "retail_margin_rate" numeric DEFAULT 0,
    "usage_instructions" "jsonb" DEFAULT '{}'::"jsonb",
    "updated_by" "uuid",
    CONSTRAINT "products_items_per_carton_check" CHECK (("items_per_carton" > 0)),
    CONSTRAINT "products_purchasing_policy_check" CHECK (("purchasing_policy" = ANY (ARRAY['ALLOW_LOOSE'::"text", 'FULL_CARTON_ONLY'::"text"])))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."products"."usage_instructions" IS 'HDSD phân theo nhóm tuổi: 0_2, 2_6, 6_18, 18_plus';



CREATE SEQUENCE IF NOT EXISTS "public"."products_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."products_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."products_id_seq" OWNED BY "public"."products"."id";



CREATE TABLE IF NOT EXISTS "public"."promotion_gifts" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."gift_type" NOT NULL,
    "quantity" integer DEFAULT 0,
    "estimated_value" numeric DEFAULT 0,
    "received_from_po_id" bigint,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."promotion_gifts" OWNER TO "postgres";


ALTER TABLE "public"."promotion_gifts" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."promotion_gifts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."promotion_targets" (
    "id" bigint NOT NULL,
    "promotion_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "promotion_targets_target_type_check" CHECK (("target_type" = ANY (ARRAY['segment'::"text", 'branch'::"text", 'customer'::"text"])))
);


ALTER TABLE "public"."promotion_targets" OWNER TO "postgres";


ALTER TABLE "public"."promotion_targets" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."promotion_targets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."promotion_usages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promotion_id" "uuid" NOT NULL,
    "customer_id" bigint NOT NULL,
    "order_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."promotion_usages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promotions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "type" "text" NOT NULL,
    "discount_type" "text" NOT NULL,
    "discount_value" numeric DEFAULT 0 NOT NULL,
    "max_discount_value" numeric,
    "min_order_value" numeric DEFAULT 0,
    "apply_to_scope" "text" DEFAULT 'all'::"text",
    "apply_to_ids" "jsonb",
    "total_usage_limit" integer,
    "usage_count" integer DEFAULT 0,
    "usage_limit_per_user" integer DEFAULT 1,
    "customer_id" bigint,
    "valid_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valid_to" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "customer_type" "text" DEFAULT 'B2C'::"text",
    CONSTRAINT "promotions_customer_type_check" CHECK (("customer_type" = ANY (ARRAY['B2B'::"text", 'B2C'::"text"]))),
    CONSTRAINT "promotions_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['percent'::"text", 'fixed'::"text"]))),
    CONSTRAINT "promotions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'expired'::"text", 'used'::"text", 'inactive'::"text"]))),
    CONSTRAINT "promotions_type_check" CHECK (("type" = ANY (ARRAY['public'::"text", 'personal'::"text", 'point_exchange'::"text"])))
);


ALTER TABLE "public"."promotions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_order_items" (
    "id" bigint NOT NULL,
    "po_id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "quantity_ordered" integer NOT NULL,
    "quantity_received" integer DEFAULT 0,
    "unit_price" numeric NOT NULL,
    "unit" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "uom_ordered" "text",
    "conversion_factor" integer DEFAULT 1,
    "base_quantity" integer,
    "is_bonus" boolean DEFAULT false,
    "vat_rate" numeric DEFAULT 0,
    "rebate_rate" numeric DEFAULT 0,
    "bonus_quantity" integer DEFAULT 0,
    "allocated_shipping_fee" numeric DEFAULT 0,
    "final_unit_cost" numeric DEFAULT 0,
    CONSTRAINT "check_conversion_factor_positive" CHECK (("conversion_factor" > 0)),
    CONSTRAINT "purchase_order_items_quantity_ordered_check" CHECK (("quantity_ordered" > 0)),
    CONSTRAINT "purchase_order_items_quantity_received_check" CHECK (("quantity_received" >= 0)),
    CONSTRAINT "purchase_order_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."purchase_order_items" OWNER TO "postgres";


ALTER TABLE "public"."purchase_order_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."purchase_order_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" bigint NOT NULL,
    "code" "text" NOT NULL,
    "supplier_id" bigint NOT NULL,
    "creator_id" "uuid" DEFAULT "auth"."uid"(),
    "delivery_status" "text" DEFAULT 'pending'::"text",
    "payment_status" "text" DEFAULT 'unpaid'::"text",
    "total_amount" numeric DEFAULT 0 NOT NULL,
    "discount_amount" numeric DEFAULT 0,
    "final_amount" numeric DEFAULT 0 NOT NULL,
    "total_paid" numeric DEFAULT 0,
    "expected_delivery_date" timestamp with time zone,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "delivery_method" "text",
    "status" "text" DEFAULT 'DRAFT'::"text",
    "shipping_partner_id" bigint,
    "shipping_fee" numeric DEFAULT 0,
    "total_packages" integer DEFAULT 1,
    "carrier_name" "text",
    "carrier_contact" "text",
    "carrier_phone" "text",
    "expected_delivery_time" timestamp with time zone,
    CONSTRAINT "purchase_orders_delivery_status_check" CHECK (("delivery_status" = ANY (ARRAY['draft'::"text", 'pending'::"text", 'partial'::"text", 'delivered'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "purchase_orders_final_amount_check" CHECK (("final_amount" >= (0)::numeric)),
    CONSTRAINT "purchase_orders_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'partial'::"text", 'paid'::"text", 'overpaid'::"text"]))),
    CONSTRAINT "purchase_orders_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


ALTER TABLE "public"."purchase_orders" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."purchase_orders_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



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


CREATE TABLE IF NOT EXISTS "public"."sales_invoices" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "invoice_date" "date" NOT NULL,
    "invoice_number" "text",
    "invoice_serial" "text",
    "invoice_template_code" "text",
    "buyer_name" "text",
    "buyer_company_name" "text",
    "buyer_tax_code" "text",
    "buyer_address" "text",
    "buyer_email" "text",
    "payment_method" "text" DEFAULT 'TM/CK'::"text",
    "total_amount_pre_tax" numeric DEFAULT 0,
    "vat_rate" numeric DEFAULT 0,
    "vat_amount" numeric DEFAULT 0,
    "final_amount" numeric DEFAULT 0,
    "order_id" "uuid",
    "customer_id" bigint,
    "customer_b2c_id" bigint,
    "note" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL
);


ALTER TABLE "public"."sales_invoices" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sales_invoices"."status" IS 'pending: Mới tạo/Chờ xử lý
     processing: Đang xử lý (Kế toán đã tải file)
     issued: Đã phát hành (Trigger kích hoạt -> TRỪ KHO VAT)
     verified: Đã đối soát xong';



ALTER TABLE "public"."sales_invoices" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."sales_invoices_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."service_consumables" (
    "id" bigint NOT NULL,
    "service_product_id" bigint,
    "consumable_product_id" bigint,
    "quantity" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."service_consumables" OWNER TO "postgres";


ALTER TABLE "public"."service_consumables" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."service_consumables_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."service_package_items" (
    "id" bigint NOT NULL,
    "package_id" bigint NOT NULL,
    "item_id" bigint NOT NULL,
    "quantity" numeric DEFAULT 1 NOT NULL,
    "item_type" "text" DEFAULT 'consumable'::"text" NOT NULL,
    "schedule_days" integer DEFAULT 0
);


ALTER TABLE "public"."service_package_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."service_package_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."service_package_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."service_package_items_id_seq" OWNED BY "public"."service_package_items"."id";



CREATE TABLE IF NOT EXISTS "public"."service_packages" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "sku" "text" NOT NULL,
    "unit" "text" DEFAULT 'Lần'::"text" NOT NULL,
    "type" "public"."service_package_type" DEFAULT 'service'::"public"."service_package_type" NOT NULL,
    "price" numeric DEFAULT 0 NOT NULL,
    "total_cost_price" numeric DEFAULT 0 NOT NULL,
    "revenue_account_id" "text",
    "valid_from" "date" NOT NULL,
    "valid_to" "date" NOT NULL,
    "status" "public"."account_status" DEFAULT 'active'::"public"."account_status" NOT NULL,
    "validity_days" integer,
    "applicable_branches" bigint[],
    "applicable_channels" "text" DEFAULT 'all'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."service_packages" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."service_packages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."service_packages_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."service_packages_id_seq" OWNED BY "public"."service_packages"."id";



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



CREATE TABLE IF NOT EXISTS "public"."supplier_program_groups" (
    "id" bigint NOT NULL,
    "program_id" bigint,
    "name" "text" NOT NULL,
    "rule_type" "text",
    "rules" "jsonb" DEFAULT '{}'::"jsonb",
    "price_basis" "text" DEFAULT 'pre_vat'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "supplier_program_groups_price_basis_check" CHECK (("price_basis" = ANY (ARRAY['pre_vat'::"text", 'post_vat'::"text"]))),
    CONSTRAINT "supplier_program_groups_rule_type_check" CHECK (("rule_type" = ANY (ARRAY['rebate_revenue'::"text", 'buy_x_get_y'::"text", 'buy_amt_get_gift'::"text", 'direct_discount'::"text"])))
);


ALTER TABLE "public"."supplier_program_groups" OWNER TO "postgres";


ALTER TABLE "public"."supplier_program_groups" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."supplier_program_groups_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."supplier_program_products" (
    "group_id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."supplier_program_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_programs" (
    "id" bigint NOT NULL,
    "supplier_id" bigint NOT NULL,
    "code" "text",
    "name" "text" NOT NULL,
    "type" "public"."supplier_program_type" NOT NULL,
    "rebate_percentage" numeric DEFAULT 0,
    "valid_from" "date" NOT NULL,
    "valid_to" "date" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "document_code" "text",
    "attachment_url" "text",
    "description" "text"
);


ALTER TABLE "public"."supplier_programs" OWNER TO "postgres";


ALTER TABLE "public"."supplier_programs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."supplier_programs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."supplier_wallets" (
    "supplier_id" bigint NOT NULL,
    "balance" numeric DEFAULT 0,
    "total_earned" numeric DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."supplier_wallets" OWNER TO "postgres";


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
    "notes" "text" DEFAULT 'active'::"text",
    "bank_bin" "text"
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



CREATE TABLE IF NOT EXISTS "public"."vaccination_template_items" (
    "id" bigint NOT NULL,
    "template_id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "shot_name" "text" NOT NULL,
    "days_after_start" integer DEFAULT 0,
    "note" "text",
    CONSTRAINT "vaccination_template_items_days_after_start_check" CHECK (("days_after_start" >= 0))
);


ALTER TABLE "public"."vaccination_template_items" OWNER TO "postgres";


ALTER TABLE "public"."vaccination_template_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."vaccination_template_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."vaccination_templates" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "min_age_months" integer,
    "max_age_months" integer,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vaccination_templates_check" CHECK (("max_age_months" >= "min_age_months")),
    CONSTRAINT "vaccination_templates_min_age_months_check" CHECK (("min_age_months" >= 0)),
    CONSTRAINT "vaccination_templates_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."vaccination_templates" OWNER TO "postgres";


ALTER TABLE "public"."vaccination_templates" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."vaccination_templates_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."vat_inventory_ledger" (
    "id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "vat_rate" numeric DEFAULT 0 NOT NULL,
    "quantity_balance" numeric DEFAULT 0 NOT NULL,
    "total_value_balance" numeric DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "vat_inventory_ledger_quantity_balance_check" CHECK (("quantity_balance" >= (0)::numeric))
);


ALTER TABLE "public"."vat_inventory_ledger" OWNER TO "postgres";


COMMENT ON TABLE "public"."vat_inventory_ledger" IS 'Sổ cái theo dõi tồn kho Hóa đơn VAT (Lưu trữ theo Base Unit và Tax Rate)';



ALTER TABLE "public"."vat_inventory_ledger" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."vat_inventory_ledger_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."vendor_product_mappings" (
    "id" bigint NOT NULL,
    "vendor_tax_code" "text" NOT NULL,
    "vendor_product_name" "text" NOT NULL,
    "internal_product_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_used_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "vendor_unit" "text",
    "internal_unit" "text"
);


ALTER TABLE "public"."vendor_product_mappings" OWNER TO "postgres";


ALTER TABLE "public"."vendor_product_mappings" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."vendor_product_mappings_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



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



ALTER TABLE ONLY "public"."service_package_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."service_package_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."service_packages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."service_packages_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."shipping_partners" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."shipping_partners_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."shipping_rules" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."shipping_rules_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."suppliers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."suppliers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."transaction_categories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."transaction_categories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_roles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_roles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."warehouses" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."warehouses_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_account_code_key" UNIQUE ("account_code");



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinical_queues"
    ADD CONSTRAINT "clinical_queues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_b2b_contacts"
    ADD CONSTRAINT "customer_b2b_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_guardians"
    ADD CONSTRAINT "customer_guardians_customer_id_guardian_id_key" UNIQUE ("customer_id", "guardian_id");



ALTER TABLE ONLY "public"."customer_guardians"
    ADD CONSTRAINT "customer_guardians_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_segment_members"
    ADD CONSTRAINT "customer_segment_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_segments"
    ADD CONSTRAINT "customer_segments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_vouchers"
    ADD CONSTRAINT "customer_vouchers_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."finance_invoice_allocations"
    ADD CONSTRAINT "finance_invoice_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_invoices"
    ADD CONSTRAINT "finance_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fund_accounts"
    ADD CONSTRAINT "fund_accounts_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."fund_accounts"
    ADD CONSTRAINT "fund_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_batches"
    ADD CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_check_items"
    ADD CONSTRAINT "inventory_check_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_checks"
    ADD CONSTRAINT "inventory_checks_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."inventory_checks"
    ADD CONSTRAINT "inventory_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_receipt_items"
    ADD CONSTRAINT "inventory_receipt_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_receipts"
    ADD CONSTRAINT "inventory_receipts_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."inventory_receipts"
    ADD CONSTRAINT "inventory_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_transfer_batch_items"
    ADD CONSTRAINT "inventory_transfer_batch_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_transfer_items"
    ADD CONSTRAINT "inventory_transfer_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_code_unique" UNIQUE ("code");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."prescription_template_items"
    ADD CONSTRAINT "prescription_template_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prescription_templates"
    ADD CONSTRAINT "prescription_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_activity_logs"
    ADD CONSTRAINT "product_activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_contents"
    ADD CONSTRAINT "product_contents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_contents"
    ADD CONSTRAINT "product_contents_product_id_channel_key" UNIQUE ("product_id", "channel");



ALTER TABLE ONLY "public"."product_inventory"
    ADD CONSTRAINT "product_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_inventory"
    ADD CONSTRAINT "product_inventory_product_id_warehouse_id_key" UNIQUE ("product_id", "warehouse_id");



ALTER TABLE ONLY "public"."product_units"
    ADD CONSTRAINT "product_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_sku_unique" UNIQUE ("sku");



ALTER TABLE ONLY "public"."promotion_gifts"
    ADD CONSTRAINT "promotion_gifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promotion_targets"
    ADD CONSTRAINT "promotion_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promotion_usages"
    ADD CONSTRAINT "promotion_usages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promotion_usages"
    ADD CONSTRAINT "promotion_usages_promotion_id_customer_id_order_id_key" UNIQUE ("promotion_id", "customer_id", "order_id");



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_key");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_invoices"
    ADD CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_consumables"
    ADD CONSTRAINT "service_consumables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_package_items"
    ADD CONSTRAINT "service_package_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_packages"
    ADD CONSTRAINT "service_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_packages"
    ADD CONSTRAINT "service_packages_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."shipping_partners"
    ADD CONSTRAINT "shipping_partners_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."shipping_partners"
    ADD CONSTRAINT "shipping_partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipping_rules"
    ADD CONSTRAINT "shipping_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_program_groups"
    ADD CONSTRAINT "supplier_program_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_program_products"
    ADD CONSTRAINT "supplier_program_products_pkey" PRIMARY KEY ("group_id", "product_id");



ALTER TABLE ONLY "public"."supplier_programs"
    ADD CONSTRAINT "supplier_programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_wallets"
    ADD CONSTRAINT "supplier_wallets_pkey" PRIMARY KEY ("supplier_id");



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



ALTER TABLE ONLY "public"."clinical_queues"
    ADD CONSTRAINT "unique_appointment_in_queue" UNIQUE ("appointment_id");



ALTER TABLE ONLY "public"."inventory_batches"
    ADD CONSTRAINT "unique_batch_in_warehouse" UNIQUE ("warehouse_id", "product_id", "batch_id");



ALTER TABLE ONLY "public"."customer_b2b_contacts"
    ADD CONSTRAINT "unique_customer_contact_phone" UNIQUE ("customer_b2b_id", "phone");



ALTER TABLE ONLY "public"."product_inventory"
    ADD CONSTRAINT "unique_product_warehouse" UNIQUE ("product_id", "warehouse_id");



ALTER TABLE ONLY "public"."promotion_targets"
    ADD CONSTRAINT "uq_promotion_target" UNIQUE ("promotion_id", "target_type", "target_id");



ALTER TABLE ONLY "public"."customer_segment_members"
    ADD CONSTRAINT "uq_segment_member" UNIQUE ("segment_id", "customer_id");



ALTER TABLE ONLY "public"."vat_inventory_ledger"
    ADD CONSTRAINT "uq_vat_ledger_product_rate" UNIQUE ("product_id", "vat_rate");



ALTER TABLE ONLY "public"."vendor_product_mappings"
    ADD CONSTRAINT "uq_vendor_product_unit_map" UNIQUE ("vendor_tax_code", "vendor_product_name", "vendor_unit");



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



ALTER TABLE ONLY "public"."vaccination_template_items"
    ADD CONSTRAINT "vaccination_template_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vaccination_templates"
    ADD CONSTRAINT "vaccination_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vat_inventory_ledger"
    ADD CONSTRAINT "vat_inventory_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendor_product_mappings"
    ADD CONSTRAINT "vendor_product_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activity_action" ON "public"."product_activity_logs" USING "btree" ("action_type");



CREATE INDEX "idx_activity_date" ON "public"."product_activity_logs" USING "btree" ("created_at");



CREATE INDEX "idx_activity_user" ON "public"."product_activity_logs" USING "btree" ("user_id");



CREATE INDEX "idx_allocations_invoice" ON "public"."finance_invoice_allocations" USING "btree" ("invoice_id");



CREATE INDEX "idx_allocations_po" ON "public"."finance_invoice_allocations" USING "btree" ("po_id");



CREATE INDEX "idx_appointments_customer" ON "public"."appointments" USING "btree" ("customer_id");



CREATE INDEX "idx_appointments_status" ON "public"."appointments" USING "btree" ("status");



CREATE INDEX "idx_appointments_time" ON "public"."appointments" USING "btree" ("appointment_time");



CREATE INDEX "idx_batches_pid_expiry" ON "public"."batches" USING "btree" ("product_id", "expiry_date");



CREATE INDEX "idx_check_items_check_id" ON "public"."inventory_check_items" USING "btree" ("check_id");



CREATE INDEX "idx_clinical_queues_date" ON "public"."clinical_queues" USING "btree" ("created_at");



CREATE INDEX "idx_clinical_queues_status" ON "public"."clinical_queues" USING "btree" ("status");



CREATE INDEX "idx_customer_b2b_contacts_customer_id" ON "public"."customer_b2b_contacts" USING "btree" ("customer_b2b_id");



CREATE INDEX "idx_customers_b2b_name_trgm" ON "public"."customers_b2b" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_customers_b2b_phone" ON "public"."customers_b2b" USING "btree" ("phone");



CREATE INDEX "idx_customers_code_trgm" ON "public"."customers" USING "gin" ("customer_code" "public"."gin_trgm_ops");



CREATE INDEX "idx_customers_last_purchase" ON "public"."customers" USING "btree" ("last_purchase_at");



CREATE INDEX "idx_customers_name_trgm" ON "public"."customers" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE UNIQUE INDEX "idx_customers_name_unique_tochuc" ON "public"."customers" USING "btree" ("name") WHERE ("type" = 'ToChuc'::"public"."customer_b2c_type");



CREATE INDEX "idx_customers_phone_trgm" ON "public"."customers" USING "gin" ("phone" "public"."gin_trgm_ops");



CREATE UNIQUE INDEX "idx_customers_phone_unique_canhan" ON "public"."customers" USING "btree" ("phone") WHERE ("type" = 'CaNhan'::"public"."customer_b2c_type");



CREATE INDEX "idx_finance_trans_category" ON "public"."finance_transactions" USING "btree" ("category_id");



CREATE INDEX "idx_finance_trans_code_trgm" ON "public"."finance_transactions" USING "gin" ("code" "public"."gin_trgm_ops");



CREATE INDEX "idx_finance_trans_created_by" ON "public"."finance_transactions" USING "btree" ("created_by");



CREATE INDEX "idx_finance_trans_date" ON "public"."finance_transactions" USING "btree" ("transaction_date" DESC);



CREATE INDEX "idx_finance_trans_desc_trgm" ON "public"."finance_transactions" USING "gin" ("description" "public"."gin_trgm_ops");



CREATE INDEX "idx_finance_trans_fund" ON "public"."finance_transactions" USING "btree" ("fund_account_id");



CREATE INDEX "idx_finance_trans_partner" ON "public"."finance_transactions" USING "btree" ("partner_type", "partner_id");



CREATE INDEX "idx_finance_trans_partner_name_trgm" ON "public"."finance_transactions" USING "gin" ("partner_name_cache" "public"."gin_trgm_ops");



CREATE INDEX "idx_finance_trans_ref" ON "public"."finance_transactions" USING "btree" ("ref_type", "ref_id");



CREATE INDEX "idx_finance_trans_ref_advance" ON "public"."finance_transactions" USING "btree" ("ref_advance_id");



CREATE INDEX "idx_finance_trans_status" ON "public"."finance_transactions" USING "btree" ("status");



CREATE INDEX "idx_guardians_customer_id" ON "public"."customer_guardians" USING "btree" ("customer_id");



CREATE INDEX "idx_guardians_guardian_id" ON "public"."customer_guardians" USING "btree" ("guardian_id");



CREATE INDEX "idx_inv_trans_action_group" ON "public"."inventory_transactions" USING "btree" ("action_group");



CREATE INDEX "idx_inv_trans_partner" ON "public"."inventory_transactions" USING "btree" ("partner_id");



CREATE INDEX "idx_inv_trans_warehouse_product" ON "public"."inventory_transactions" USING "btree" ("warehouse_id", "product_id");



CREATE INDEX "idx_invoices_number" ON "public"."finance_invoices" USING "btree" ("invoice_number");



CREATE INDEX "idx_invoices_status" ON "public"."finance_invoices" USING "btree" ("status");



CREATE INDEX "idx_invoices_supplier" ON "public"."finance_invoices" USING "btree" ("supplier_id");



CREATE INDEX "idx_order_items_order" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_orders_cust_b2c" ON "public"."orders" USING "btree" ("customer_b2c_id");



CREATE INDEX "idx_orders_customer" ON "public"."orders" USING "btree" ("customer_id");



CREATE INDEX "idx_orders_invoice_status" ON "public"."orders" USING "btree" ("invoice_status");



CREATE INDEX "idx_orders_payment_method" ON "public"."orders" USING "btree" ("payment_method");



CREATE INDEX "idx_orders_remittance" ON "public"."orders" USING "btree" ("remittance_status");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_orders_type" ON "public"."orders" USING "btree" ("order_type");



CREATE INDEX "idx_po_creator_id" ON "public"."purchase_orders" USING "btree" ("creator_id");



CREATE INDEX "idx_po_items_po_id" ON "public"."purchase_order_items" USING "btree" ("po_id");



CREATE INDEX "idx_po_items_product_id" ON "public"."purchase_order_items" USING "btree" ("product_id");



CREATE INDEX "idx_po_status" ON "public"."purchase_orders" USING "btree" ("delivery_status", "payment_status");



CREATE INDEX "idx_po_supplier" ON "public"."purchase_orders" USING "btree" ("supplier_id");



CREATE INDEX "idx_product_inventory_location" ON "public"."product_inventory" USING "btree" ("warehouse_id", "location_cabinet", "location_row", "location_slot");



CREATE INDEX "idx_product_units_barcode" ON "public"."product_units" USING "btree" ("barcode");



CREATE INDEX "idx_product_units_pid" ON "public"."product_units" USING "btree" ("product_id");



CREATE INDEX "idx_products_category" ON "public"."products" USING "btree" ("category_name");



CREATE INDEX "idx_products_distributor" ON "public"."products" USING "btree" ("distributor_id");



CREATE INDEX "idx_products_items_per_carton" ON "public"."products" USING "btree" ("items_per_carton");



CREATE INDEX "idx_products_manufacturer" ON "public"."products" USING "btree" ("manufacturer_name");



CREATE INDEX "idx_products_name_active_trgm" ON "public"."products" USING "gin" ("name" "public"."gin_trgm_ops") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_products_name_trgm" ON "public"."products" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_promotions_customer_type" ON "public"."promotions" USING "btree" ("customer_type");



CREATE INDEX "idx_receipt_items_product_id" ON "public"."inventory_receipt_items" USING "btree" ("product_id");



CREATE INDEX "idx_receipt_items_receipt_id" ON "public"."inventory_receipt_items" USING "btree" ("receipt_id");



CREATE INDEX "idx_receipt_po" ON "public"."inventory_receipts" USING "btree" ("po_id");



CREATE INDEX "idx_receipts_warehouse_id" ON "public"."inventory_receipts" USING "btree" ("warehouse_id");



CREATE INDEX "idx_sales_invoices_date" ON "public"."sales_invoices" USING "btree" ("invoice_date");



CREATE INDEX "idx_sales_invoices_number" ON "public"."sales_invoices" USING "btree" ("invoice_number");



CREATE INDEX "idx_sales_invoices_status" ON "public"."sales_invoices" USING "btree" ("status");



CREATE INDEX "idx_service_package_items_item_id" ON "public"."service_package_items" USING "btree" ("item_id");



CREATE INDEX "idx_service_package_items_package_id" ON "public"."service_package_items" USING "btree" ("package_id");



CREATE INDEX "idx_service_packages_name_trgm" ON "public"."service_packages" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_service_packages_sku" ON "public"."service_packages" USING "btree" ("sku");



CREATE INDEX "idx_shipping_partners_name_trgm" ON "public"."shipping_partners" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_shipping_rules_partner_id" ON "public"."shipping_rules" USING "btree" ("partner_id");



CREATE INDEX "idx_template_items_template_id" ON "public"."prescription_template_items" USING "btree" ("template_id");



CREATE INDEX "idx_templates_diagnosis" ON "public"."prescription_templates" USING "btree" ("diagnosis");



CREATE INDEX "idx_templates_name" ON "public"."prescription_templates" USING "btree" ("name");



CREATE INDEX "idx_transfer_batch_items_item_id" ON "public"."inventory_transfer_batch_items" USING "btree" ("transfer_item_id");



CREATE INDEX "idx_transfer_items_transfer_id" ON "public"."inventory_transfer_items" USING "btree" ("transfer_id");



CREATE UNIQUE INDEX "idx_unique_invoice_identity" ON "public"."finance_invoices" USING "btree" ("supplier_tax_code", "invoice_symbol", "invoice_number") WHERE ("status" <> 'rejected'::"text");



COMMENT ON INDEX "public"."idx_unique_invoice_identity" IS 'Chặn nhập trùng hóa đơn trừ khi hóa đơn cũ đã bị từ chối/hủy';



CREATE INDEX "idx_users_name_trgm" ON "public"."users" USING "gin" ("full_name" "public"."gin_trgm_ops");



CREATE INDEX "idx_users_phone_trgm" ON "public"."users" USING "gin" ("phone" "public"."gin_trgm_ops");



CREATE INDEX "idx_users_work_state" ON "public"."users" USING "btree" ("work_state");



CREATE INDEX "idx_vacc_items_template_id" ON "public"."vaccination_template_items" USING "btree" ("template_id");



CREATE INDEX "idx_vacc_templates_name" ON "public"."vaccination_templates" USING "btree" ("name");



CREATE INDEX "products_fts_idx" ON "public"."products" USING "gin" ("fts");



CREATE INDEX "trgm_idx_products_name" ON "public"."products" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE OR REPLACE TRIGGER "on_finance_transaction_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."finance_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_fund_balance_update"();



CREATE OR REPLACE TRIGGER "on_finance_transaction_notify" AFTER INSERT ON "public"."finance_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_notify_finance_approval"();



CREATE OR REPLACE TRIGGER "on_finance_transaction_remittance_sync" AFTER UPDATE ON "public"."finance_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."sync_order_remittance_status"();



CREATE OR REPLACE TRIGGER "on_inventory_batch_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."inventory_batches" FOR EACH ROW EXECUTE FUNCTION "public"."sync_inventory_batch_to_total"();



CREATE OR REPLACE TRIGGER "on_inventory_track" AFTER UPDATE ON "public"."product_inventory" FOR EACH ROW EXECUTE FUNCTION "public"."track_inventory_changes"();



CREATE OR REPLACE TRIGGER "on_invoice_updated" BEFORE UPDATE ON "public"."finance_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_order_cancel" AFTER UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_order_cancel_restore_stock"();



CREATE OR REPLACE TRIGGER "on_order_status_deduct_inventory" AFTER UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."handle_order_inventory_deduction"();



CREATE OR REPLACE TRIGGER "on_po_notify" AFTER INSERT OR UPDATE ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_notify_warehouse_po"();



CREATE OR REPLACE TRIGGER "on_po_payment_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."finance_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."sync_po_payment_status"();



CREATE OR REPLACE TRIGGER "on_product_track" AFTER UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."track_product_changes"();



CREATE OR REPLACE TRIGGER "on_receipt_header_change" BEFORE UPDATE OF "discount_order", "shipping_fee", "other_fee" ON "public"."inventory_receipts" FOR EACH ROW EXECUTE FUNCTION "public"."recalculate_final_amount"();



CREATE OR REPLACE TRIGGER "on_receipt_item_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."inventory_receipt_items" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_receipt_totals"();



CREATE OR REPLACE TRIGGER "on_sales_invoice_issue" AFTER UPDATE ON "public"."sales_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_deduct_vat_inventory"();



CREATE OR REPLACE TRIGGER "on_sales_invoice_updated" BEFORE UPDATE ON "public"."sales_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_sales_order_confirm" AFTER UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."handle_sales_inventory_deduction"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."assets" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."banks" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."chart_of_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."customers_b2b" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."document_templates" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."fund_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."service_packages" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."shipping_partners" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."system_settings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."transaction_categories" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_user_status_change" AFTER INSERT OR UPDATE OF "status" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_status_to_auth"();



CREATE OR REPLACE TRIGGER "trg_auto_allocate_payment" AFTER INSERT OR UPDATE ON "public"."finance_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."auto_allocate_payment_to_orders"();



CREATE OR REPLACE TRIGGER "trg_auto_refresh_segment" AFTER UPDATE ON "public"."customer_segments" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_refresh_on_criteria_change"();



CREATE OR REPLACE TRIGGER "trg_notify_payment" AFTER INSERT OR UPDATE ON "public"."finance_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_sales_on_payment"();



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "auth"."users"("id");



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



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clinical_queues"
    ADD CONSTRAINT "clinical_queues_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinical_queues"
    ADD CONSTRAINT "clinical_queues_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."clinical_queues"
    ADD CONSTRAINT "clinical_queues_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."customer_b2b_contacts"
    ADD CONSTRAINT "customer_b2b_contacts_customer_b2b_id_fkey" FOREIGN KEY ("customer_b2b_id") REFERENCES "public"."customers_b2b"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_guardians"
    ADD CONSTRAINT "customer_guardians_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_guardians"
    ADD CONSTRAINT "customer_guardians_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_segment_members"
    ADD CONSTRAINT "customer_segment_members_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_segment_members"
    ADD CONSTRAINT "customer_segment_members_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "public"."customer_segments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_vouchers"
    ADD CONSTRAINT "customer_vouchers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_vouchers"
    ADD CONSTRAINT "customer_vouchers_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers_b2b"
    ADD CONSTRAINT "customers_b2b_sales_staff_id_fkey" FOREIGN KEY ("sales_staff_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."finance_invoice_allocations"
    ADD CONSTRAINT "finance_invoice_allocations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."finance_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance_invoice_allocations"
    ADD CONSTRAINT "finance_invoice_allocations_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance_invoices"
    ADD CONSTRAINT "finance_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."transaction_categories"("id");



ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_fund_account_id_fkey" FOREIGN KEY ("fund_account_id") REFERENCES "public"."fund_accounts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_ref_advance_id_fkey" FOREIGN KEY ("ref_advance_id") REFERENCES "public"."finance_transactions"("id");



ALTER TABLE ONLY "public"."fund_accounts"
    ADD CONSTRAINT "fund_accounts_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id");



ALTER TABLE ONLY "public"."inventory_batches"
    ADD CONSTRAINT "inventory_batches_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_batches"
    ADD CONSTRAINT "inventory_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_batches"
    ADD CONSTRAINT "inventory_batches_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_check_items"
    ADD CONSTRAINT "inventory_check_items_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "public"."inventory_checks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_check_items"
    ADD CONSTRAINT "inventory_check_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."inventory_checks"
    ADD CONSTRAINT "inventory_checks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inventory_checks"
    ADD CONSTRAINT "inventory_checks_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inventory_checks"
    ADD CONSTRAINT "inventory_checks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."inventory_receipt_items"
    ADD CONSTRAINT "inventory_receipt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."inventory_receipt_items"
    ADD CONSTRAINT "inventory_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."inventory_receipts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_receipts"
    ADD CONSTRAINT "inventory_receipts_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id");



ALTER TABLE ONLY "public"."inventory_receipts"
    ADD CONSTRAINT "inventory_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."inventory_transfer_batch_items"
    ADD CONSTRAINT "inventory_transfer_batch_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id");



ALTER TABLE ONLY "public"."inventory_transfer_batch_items"
    ADD CONSTRAINT "inventory_transfer_batch_items_transfer_item_id_fkey" FOREIGN KEY ("transfer_item_id") REFERENCES "public"."inventory_transfer_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transfer_items"
    ADD CONSTRAINT "inventory_transfer_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."inventory_transfer_items"
    ADD CONSTRAINT "inventory_transfer_items_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "public"."inventory_transfers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_dest_warehouse_id_fkey" FOREIGN KEY ("dest_warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_source_warehouse_id_fkey" FOREIGN KEY ("source_warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_b2b_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers_b2b"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_b2c_id_fkey" FOREIGN KEY ("customer_b2c_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_remittance_transaction_id_fkey" FOREIGN KEY ("remittance_transaction_id") REFERENCES "public"."finance_transactions"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_shipping_partner_id_fkey" FOREIGN KEY ("shipping_partner_id") REFERENCES "public"."shipping_partners"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."prescription_template_items"
    ADD CONSTRAINT "prescription_template_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."prescription_template_items"
    ADD CONSTRAINT "prescription_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."prescription_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_activity_logs"
    ADD CONSTRAINT "product_activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."product_contents"
    ADD CONSTRAINT "product_contents_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_contents"
    ADD CONSTRAINT "product_contents_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."product_inventory"
    ADD CONSTRAINT "product_inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_inventory"
    ADD CONSTRAINT "product_inventory_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."product_inventory"
    ADD CONSTRAINT "product_inventory_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_units"
    ADD CONSTRAINT "product_units_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."promotion_targets"
    ADD CONSTRAINT "promotion_targets_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promotion_usages"
    ADD CONSTRAINT "promotion_usages_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."promotion_usages"
    ADD CONSTRAINT "promotion_usages_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id");



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_shipping_partner_id_fkey" FOREIGN KEY ("shipping_partner_id") REFERENCES "public"."shipping_partners"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_invoices"
    ADD CONSTRAINT "sales_invoices_customer_b2c_id_fkey" FOREIGN KEY ("customer_b2c_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales_invoices"
    ADD CONSTRAINT "sales_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers_b2b"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales_invoices"
    ADD CONSTRAINT "sales_invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_consumables"
    ADD CONSTRAINT "service_consumables_consumable_product_id_fkey" FOREIGN KEY ("consumable_product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."service_consumables"
    ADD CONSTRAINT "service_consumables_service_product_id_fkey" FOREIGN KEY ("service_product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."service_package_items"
    ADD CONSTRAINT "service_package_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."service_package_items"
    ADD CONSTRAINT "service_package_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_packages"
    ADD CONSTRAINT "service_packages_revenue_account_id_fkey" FOREIGN KEY ("revenue_account_id") REFERENCES "public"."chart_of_accounts"("account_code");



ALTER TABLE ONLY "public"."shipping_rules"
    ADD CONSTRAINT "shipping_rules_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."shipping_partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_program_groups"
    ADD CONSTRAINT "supplier_program_groups_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."supplier_programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_program_products"
    ADD CONSTRAINT "supplier_program_products_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."supplier_program_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_program_products"
    ADD CONSTRAINT "supplier_program_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_programs"
    ADD CONSTRAINT "supplier_programs_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_wallets"
    ADD CONSTRAINT "supplier_wallets_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."vaccination_template_items"
    ADD CONSTRAINT "vaccination_template_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."vaccination_template_items"
    ADD CONSTRAINT "vaccination_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."vaccination_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vat_inventory_ledger"
    ADD CONSTRAINT "vat_inventory_ledger_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendor_product_mappings"
    ADD CONSTRAINT "vendor_product_mappings_internal_product_id_fkey" FOREIGN KEY ("internal_product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."vendor_product_mappings"
    ADD CONSTRAINT "vendor_product_mappings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



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



CREATE POLICY "Allow authenticated full access on service_package_items" ON "public"."service_package_items" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on service_packages" ON "public"."service_packages" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on shipping_partners" ON "public"."shipping_partners" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on shipping_rules" ON "public"."shipping_rules" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on transaction_categories" ON "public"."transaction_categories" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on user_roles" ON "public"."user_roles" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated full access on users" ON "public"."users" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated read access" ON "public"."chart_of_accounts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated write access (Temporary)" ON "public"."chart_of_accounts" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Auth users full access" ON "public"."customer_vouchers" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Auth users full access" ON "public"."promotion_targets" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can delete items" ON "public"."vaccination_template_items" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete templates" ON "public"."vaccination_templates" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can insert items" ON "public"."vaccination_template_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert templates" ON "public"."vaccination_templates" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can select items" ON "public"."vaccination_template_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can select templates" ON "public"."vaccination_templates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update items" ON "public"."vaccination_template_items" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update templates" ON "public"."vaccination_templates" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Enable access for auth users" ON "public"."customer_segment_members" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable access for auth users" ON "public"."customer_segments" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable access for authenticated users" ON "public"."vendor_product_mappings" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable all access for authenticated users" ON "public"."vat_inventory_ledger" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for authenticated" ON "public"."appointments" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for authenticated" ON "public"."batches" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for authenticated" ON "public"."clinical_queues" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for authenticated" ON "public"."finance_invoice_allocations" TO "authenticated" USING (true);



CREATE POLICY "Enable all for authenticated" ON "public"."finance_transactions" TO "authenticated" USING (true);



CREATE POLICY "Enable all for authenticated" ON "public"."inventory_batches" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for authenticated" ON "public"."inventory_transfer_batch_items" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for authenticated" ON "public"."inventory_transfer_items" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for authenticated" ON "public"."inventory_transfers" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for authenticated" ON "public"."order_items" TO "authenticated" USING (true);



CREATE POLICY "Enable all for authenticated" ON "public"."orders" TO "authenticated" USING (true);



CREATE POLICY "Enable all for authenticated" ON "public"."product_contents" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for authenticated" ON "public"."product_units" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for authenticated" ON "public"."purchase_orders" TO "authenticated" USING (true);



CREATE POLICY "Enable all for authenticated" ON "public"."sales_invoices" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for items" ON "public"."purchase_order_items" TO "authenticated" USING (true);



CREATE POLICY "Enable all for receipt items" ON "public"."inventory_receipt_items" TO "authenticated" USING (true);



CREATE POLICY "Enable all for receipts" ON "public"."inventory_receipts" TO "authenticated" USING (true);



CREATE POLICY "Enable delete for authenticated users only" ON "public"."prescription_templates" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable delete items" ON "public"."prescription_template_items" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."prescription_templates" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable insert items" ON "public"."prescription_template_items" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable read access for all users" ON "public"."prescription_templates" FOR SELECT USING (true);



CREATE POLICY "Enable read access items" ON "public"."prescription_template_items" FOR SELECT USING (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."prescription_templates" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable update items" ON "public"."prescription_template_items" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Staff can view all orders" ON "public"."orders" FOR SELECT USING ((("auth"."uid"() = "creator_id") OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Staff full access allocations" ON "public"."finance_invoice_allocations" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Staff full access invoices" ON "public"."finance_invoices" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "User view own noti" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."asset_maintenance_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."asset_maintenance_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."asset_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."banks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chart_of_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clinical_queues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_b2b_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_guardians" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_segment_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_segments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_vouchers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers_b2b" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_invoice_allocations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fund_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_receipt_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_receipts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_transfer_batch_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_transfer_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_transfers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prescription_template_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prescription_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_contents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_units" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promotion_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_consumables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_package_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shipping_partners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shipping_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transaction_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vaccination_template_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vaccination_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vat_inventory_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendor_product_mappings" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."inventory_receipts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."orders";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."purchase_orders";






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














































































































































































GRANT ALL ON FUNCTION "public"."allocate_inbound_costs"("p_receipt_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."allocate_inbound_costs"("p_receipt_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."allocate_inbound_costs"("p_receipt_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_allocate_payment_to_orders"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_allocate_payment_to_orders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_allocate_payment_to_orders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_create_purchase_orders_min_max"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_create_purchase_orders_min_max"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_create_purchase_orders_min_max"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_update_product_barcodes"("p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_update_product_barcodes"("p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_update_product_barcodes"("p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_update_product_prices"("p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_update_product_prices"("p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_update_product_prices"("p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_update_product_strategy"("p_product_ids" bigint[], "p_strategy_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_update_product_strategy"("p_product_ids" bigint[], "p_strategy_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_update_product_strategy"("p_product_ids" bigint[], "p_strategy_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_update_product_units_for_quick_unit_page"("p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_update_product_units_for_quick_unit_page"("p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_update_product_units_for_quick_unit_page"("p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_upsert_customers_b2b"("p_customers_array" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_upsert_customers_b2b"("p_customers_array" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_upsert_customers_b2b"("p_customers_array" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_upsert_customers_b2c"("p_customers_array" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_upsert_customers_b2c"("p_customers_array" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_upsert_customers_b2c"("p_customers_array" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_upsert_products"("p_products_array" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_upsert_products"("p_products_array" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_upsert_products"("p_products_array" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_carton_breakdown"("p_product_id" bigint, "p_required_qty" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_carton_breakdown"("p_product_id" bigint, "p_required_qty" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_carton_breakdown"("p_product_id" bigint, "p_required_qty" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_package_cost"("p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_package_cost"("p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_package_cost"("p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_receipt_totals"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_receipt_totals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_receipt_totals"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_inventory_check"("p_check_id" bigint, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_inventory_check"("p_check_id" bigint, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_inventory_check"("p_check_id" bigint, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_outbound_task"("p_order_id" "uuid", "p_reason" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_outbound_task"("p_order_id" "uuid", "p_reason" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_outbound_task"("p_order_id" "uuid", "p_reason" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_in_patient"("p_customer_id" bigint, "p_doctor_id" "uuid", "p_priority" "text", "p_symptoms" "jsonb", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_in_patient"("p_customer_id" bigint, "p_doctor_id" "uuid", "p_priority" "text", "p_symptoms" "jsonb", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_in_patient"("p_customer_id" bigint, "p_doctor_id" "uuid", "p_priority" "text", "p_symptoms" "jsonb", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_invoice_exists"("p_tax_code" "text", "p_symbol" "text", "p_number" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_invoice_exists"("p_tax_code" "text", "p_symbol" "text", "p_number" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_invoice_exists"("p_tax_code" "text", "p_symbol" "text", "p_number" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_product_dependencies"("p_product_ids" bigint[]) TO "anon";
GRANT ALL ON FUNCTION "public"."check_product_dependencies"("p_product_ids" bigint[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_product_dependencies"("p_product_ids" bigint[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_vat_availability"("p_product_id" bigint, "p_vat_rate" numeric, "p_qty_requested" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."check_vat_availability"("p_product_id" bigint, "p_vat_rate" numeric, "p_qty_requested" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_vat_availability"("p_product_id" bigint, "p_vat_rate" numeric, "p_qty_requested" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_inventory_check"("p_check_id" bigint, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_inventory_check"("p_check_id" bigint, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_inventory_check"("p_check_id" bigint, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_finance_transaction"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_finance_transaction"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_finance_transaction"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_finance_transaction"("p_id" bigint, "p_target_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_finance_transaction"("p_id" bigint, "p_target_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_finance_transaction"("p_id" bigint, "p_target_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_order_payment"("p_order_ids" "uuid"[], "p_fund_account_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_order_payment"("p_order_ids" "uuid"[], "p_fund_account_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_order_payment"("p_order_ids" "uuid"[], "p_fund_account_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_outbound_packing"("p_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_outbound_packing"("p_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_outbound_packing"("p_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_purchase_order"("p_po_id" bigint, "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_purchase_order"("p_po_id" bigint, "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_purchase_order"("p_po_id" bigint, "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_purchase_order_financials"("p_po_id" bigint, "p_items_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_purchase_order_financials"("p_po_id" bigint, "p_items_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_purchase_order_financials"("p_po_id" bigint, "p_items_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_purchase_payment"("p_order_id" bigint, "p_amount" numeric, "p_fund_account_id" bigint, "p_payment_method" "text", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_purchase_payment"("p_order_id" bigint, "p_amount" numeric, "p_fund_account_id" bigint, "p_payment_method" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_purchase_payment"("p_order_id" bigint, "p_amount" numeric, "p_fund_account_id" bigint, "p_payment_method" "text", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_transaction"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_transaction"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_transaction"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_transfer_inbound"("p_transfer_id" bigint, "p_actor_warehouse_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_transfer_inbound"("p_transfer_id" bigint, "p_actor_warehouse_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_transfer_inbound"("p_transfer_id" bigint, "p_actor_warehouse_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_transfer_outbound_fefo"("p_transfer_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_transfer_outbound_fefo"("p_transfer_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_transfer_outbound_fefo"("p_transfer_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_appointment_booking"("p_customer_id" bigint, "p_doctor_id" "uuid", "p_time" timestamp with time zone, "p_symptoms" "jsonb", "p_note" "text", "p_type" "text", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_appointment_booking"("p_customer_id" bigint, "p_doctor_id" "uuid", "p_time" timestamp with time zone, "p_symptoms" "jsonb", "p_note" "text", "p_type" "text", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_appointment_booking"("p_customer_id" bigint, "p_doctor_id" "uuid", "p_time" timestamp with time zone, "p_symptoms" "jsonb", "p_note" "text", "p_type" "text", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_asset"("p_asset_data" "jsonb", "p_maintenance_plans" "jsonb", "p_maintenance_history" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_asset"("p_asset_data" "jsonb", "p_maintenance_plans" "jsonb", "p_maintenance_history" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_asset"("p_asset_data" "jsonb", "p_maintenance_plans" "jsonb", "p_maintenance_history" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_auto_replenishment_request"("p_dest_warehouse_id" bigint, "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_auto_replenishment_request"("p_dest_warehouse_id" bigint, "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_auto_replenishment_request"("p_dest_warehouse_id" bigint, "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_check_session"("p_warehouse_id" bigint, "p_note" "text", "p_scope" "text", "p_text_val" "text", "p_int_val" bigint, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_check_session"("p_warehouse_id" bigint, "p_note" "text", "p_scope" "text", "p_text_val" "text", "p_int_val" bigint, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_check_session"("p_warehouse_id" bigint, "p_note" "text", "p_scope" "text", "p_text_val" "text", "p_int_val" bigint, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_customer_b2b"("p_customer_data" "jsonb", "p_contacts" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_customer_b2b"("p_customer_data" "jsonb", "p_contacts" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_customer_b2b"("p_customer_data" "jsonb", "p_contacts" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_customer_b2c"("p_customer_data" "jsonb", "p_guardians" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_customer_b2c"("p_customer_data" "jsonb", "p_guardians" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_customer_b2c"("p_customer_data" "jsonb", "p_guardians" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_finance_transaction"("p_amount" numeric, "p_business_type" "text", "p_cash_tally" "jsonb", "p_category_id" bigint, "p_description" "text", "p_flow" "text", "p_fund_id" bigint, "p_partner_id" "text", "p_partner_name" "text", "p_partner_type" "text", "p_status" "text", "p_transaction_date" timestamp with time zone, "p_code" "text", "p_ref_type" "text", "p_ref_id" "text", "p_evidence_url" "text", "p_ref_advance_id" bigint, "p_created_by" "uuid", "p_target_bank_info" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_finance_transaction"("p_amount" numeric, "p_business_type" "text", "p_cash_tally" "jsonb", "p_category_id" bigint, "p_description" "text", "p_flow" "text", "p_fund_id" bigint, "p_partner_id" "text", "p_partner_name" "text", "p_partner_type" "text", "p_status" "text", "p_transaction_date" timestamp with time zone, "p_code" "text", "p_ref_type" "text", "p_ref_id" "text", "p_evidence_url" "text", "p_ref_advance_id" bigint, "p_created_by" "uuid", "p_target_bank_info" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_finance_transaction"("p_amount" numeric, "p_business_type" "text", "p_cash_tally" "jsonb", "p_category_id" bigint, "p_description" "text", "p_flow" "text", "p_fund_id" bigint, "p_partner_id" "text", "p_partner_name" "text", "p_partner_type" "text", "p_status" "text", "p_transaction_date" timestamp with time zone, "p_code" "text", "p_ref_type" "text", "p_ref_id" "text", "p_evidence_url" "text", "p_ref_advance_id" bigint, "p_created_by" "uuid", "p_target_bank_info" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_full_supplier_program"("p_program_data" "jsonb", "p_groups_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_full_supplier_program"("p_program_data" "jsonb", "p_groups_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_full_supplier_program"("p_program_data" "jsonb", "p_groups_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_inventory_check"("p_warehouse_id" bigint, "p_user_id" "uuid", "p_note" "text", "p_scope" "text", "p_text_val" "text", "p_int_val" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."create_inventory_check"("p_warehouse_id" bigint, "p_user_id" "uuid", "p_note" "text", "p_scope" "text", "p_text_val" "text", "p_int_val" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_inventory_check"("p_warehouse_id" bigint, "p_user_id" "uuid", "p_note" "text", "p_scope" "text", "p_text_val" "text", "p_int_val" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_inventory_receipt"("p_po_id" bigint, "p_warehouse_id" bigint, "p_note" "text", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_inventory_receipt"("p_po_id" bigint, "p_warehouse_id" bigint, "p_note" "text", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_inventory_receipt"("p_po_id" bigint, "p_warehouse_id" bigint, "p_note" "text", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_manual_transfer"("p_source_warehouse_id" bigint, "p_dest_warehouse_id" bigint, "p_note" "text", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_manual_transfer"("p_source_warehouse_id" bigint, "p_dest_warehouse_id" bigint, "p_note" "text", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_manual_transfer"("p_source_warehouse_id" bigint, "p_dest_warehouse_id" bigint, "p_note" "text", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_new_auth_user"("p_email" "text", "p_password" "text", "p_full_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_new_auth_user"("p_email" "text", "p_password" "text", "p_full_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_new_auth_user"("p_email" "text", "p_password" "text", "p_full_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_prescription_template"("p_data" "jsonb", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_prescription_template"("p_data" "jsonb", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_prescription_template"("p_data" "jsonb", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_product"("p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_items_per_carton" integer, "p_inventory_settings" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_product"("p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_items_per_carton" integer, "p_inventory_settings" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_product"("p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_items_per_carton" integer, "p_inventory_settings" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_product"("p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_items_per_carton" integer, "p_carton_weight" numeric, "p_carton_dimensions" "text", "p_purchasing_policy" "text", "p_inventory_settings" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_product"("p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_items_per_carton" integer, "p_carton_weight" numeric, "p_carton_dimensions" "text", "p_purchasing_policy" "text", "p_inventory_settings" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_product"("p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_items_per_carton" integer, "p_carton_weight" numeric, "p_carton_dimensions" "text", "p_purchasing_policy" "text", "p_inventory_settings" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_product"("p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_items_per_carton" integer, "p_carton_weight" numeric, "p_carton_dimensions" "text", "p_purchasing_policy" "text", "p_inventory_settings" "jsonb", "p_description" "text", "p_registration_number" "text", "p_packing_spec" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_product"("p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_items_per_carton" integer, "p_carton_weight" numeric, "p_carton_dimensions" "text", "p_purchasing_policy" "text", "p_inventory_settings" "jsonb", "p_description" "text", "p_registration_number" "text", "p_packing_spec" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_product"("p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_items_per_carton" integer, "p_carton_weight" numeric, "p_carton_dimensions" "text", "p_purchasing_policy" "text", "p_inventory_settings" "jsonb", "p_description" "text", "p_registration_number" "text", "p_packing_spec" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_purchase_order"("p_supplier_id" bigint, "p_expected_date" timestamp with time zone, "p_note" "text", "p_delivery_method" "text", "p_shipping_partner_id" bigint, "p_shipping_fee" numeric, "p_items" "jsonb", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_purchase_order"("p_supplier_id" bigint, "p_expected_date" timestamp with time zone, "p_note" "text", "p_delivery_method" "text", "p_shipping_partner_id" bigint, "p_shipping_fee" numeric, "p_items" "jsonb", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_purchase_order"("p_supplier_id" bigint, "p_expected_date" timestamp with time zone, "p_note" "text", "p_delivery_method" "text", "p_shipping_partner_id" bigint, "p_shipping_fee" numeric, "p_items" "jsonb", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_sales_order"("p_customer_b2b_id" bigint, "p_customer_b2c_id" bigint, "p_discount_amount" numeric, "p_items" "jsonb", "p_order_type" "text", "p_payment_method" "text", "p_shipping_fee" numeric, "p_status" "text", "p_warehouse_id" bigint, "p_note" "text", "p_delivery_address" "text", "p_delivery_time" "text", "p_shipping_partner_id" bigint, "p_delivery_method" "text", "p_customer_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."create_sales_order"("p_customer_b2b_id" bigint, "p_customer_b2c_id" bigint, "p_discount_amount" numeric, "p_items" "jsonb", "p_order_type" "text", "p_payment_method" "text", "p_shipping_fee" numeric, "p_status" "text", "p_warehouse_id" bigint, "p_note" "text", "p_delivery_address" "text", "p_delivery_time" "text", "p_shipping_partner_id" bigint, "p_delivery_method" "text", "p_customer_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_sales_order"("p_customer_b2b_id" bigint, "p_customer_b2c_id" bigint, "p_discount_amount" numeric, "p_items" "jsonb", "p_order_type" "text", "p_payment_method" "text", "p_shipping_fee" numeric, "p_status" "text", "p_warehouse_id" bigint, "p_note" "text", "p_delivery_address" "text", "p_delivery_time" "text", "p_shipping_partner_id" bigint, "p_delivery_method" "text", "p_customer_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_service_package"("p_data" "jsonb", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_service_package"("p_data" "jsonb", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_service_package"("p_data" "jsonb", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_shipping_partner"("p_partner_data" "jsonb", "p_rules" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_shipping_partner"("p_partner_data" "jsonb", "p_rules" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_shipping_partner"("p_partner_data" "jsonb", "p_rules" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_supplier"("p_name" "text", "p_tax_code" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_address" "text", "p_payment_term" "text", "p_bank_account" "text", "p_bank_name" "text", "p_bank_holder" "text", "p_delivery_method" "text", "p_lead_time" integer, "p_status" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_supplier"("p_name" "text", "p_tax_code" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_address" "text", "p_payment_term" "text", "p_bank_account" "text", "p_bank_name" "text", "p_bank_holder" "text", "p_delivery_method" "text", "p_lead_time" integer, "p_status" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_supplier"("p_name" "text", "p_tax_code" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_address" "text", "p_payment_term" "text", "p_bank_account" "text", "p_bank_name" "text", "p_bank_holder" "text", "p_delivery_method" "text", "p_lead_time" integer, "p_status" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_vaccination_template"("p_data" "jsonb", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_vaccination_template"("p_data" "jsonb", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_vaccination_template"("p_data" "jsonb", "p_items" "jsonb") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."delete_prescription_template"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_prescription_template"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_prescription_template"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_products"("p_ids" bigint[]) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_products"("p_ids" bigint[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_products"("p_ids" bigint[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_purchase_order"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_purchase_order"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_purchase_order"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_service_packages"("p_ids" bigint[]) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_service_packages"("p_ids" bigint[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_service_packages"("p_ids" bigint[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_shipping_partner"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_shipping_partner"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_shipping_partner"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_supplier"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_supplier"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_supplier"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_vaccination_template"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_vaccination_template"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_vaccination_template"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."distribute_voucher_to_segment"("p_promotion_id" "uuid", "p_segment_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."distribute_voucher_to_segment"("p_promotion_id" "uuid", "p_segment_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."distribute_voucher_to_segment"("p_promotion_id" "uuid", "p_segment_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."export_customers_b2b_list"("search_query" "text", "sales_staff_filter" "uuid", "status_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."export_customers_b2b_list"("search_query" "text", "sales_staff_filter" "uuid", "status_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_customers_b2b_list"("search_query" "text", "sales_staff_filter" "uuid", "status_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."export_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."export_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."export_products_list"("search_query" "text", "category_filter" "text", "manufacturer_filter" "text", "status_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."export_products_list"("search_query" "text", "category_filter" "text", "manufacturer_filter" "text", "status_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_products_list"("search_query" "text", "category_filter" "text", "manufacturer_filter" "text", "status_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_shipping_partners"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_shipping_partners"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_shipping_partners"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_warehouses"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_warehouses"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_warehouses"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_applicable_vouchers"("p_customer_id" bigint, "p_order_total" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_applicable_vouchers"("p_customer_id" bigint, "p_order_total" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_applicable_vouchers"("p_customer_id" bigint, "p_order_total" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_asset_details"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_asset_details"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_asset_details"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_assets_list"("search_query" "text", "type_filter" bigint, "branch_filter" bigint, "status_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_assets_list"("search_query" "text", "type_filter" bigint, "branch_filter" bigint, "status_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_assets_list"("search_query" "text", "type_filter" bigint, "branch_filter" bigint, "status_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_vat_rates_for_product"("p_product_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_vat_rates_for_product"("p_product_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_vat_rates_for_product"("p_product_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_vouchers"("p_customer_id" bigint, "p_order_total" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_vouchers"("p_customer_id" bigint, "p_order_total" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_vouchers"("p_customer_id" bigint, "p_order_total" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_customer_b2b_details"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_customer_b2b_details"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_customer_b2b_details"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_customer_b2c_details"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_customer_b2c_details"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_customer_b2c_details"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_customer_debt_info"("p_customer_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_customer_debt_info"("p_customer_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_customer_debt_info"("p_customer_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_customers_b2b_list"("search_query" "text", "sales_staff_filter" "uuid", "status_filter" "text", "page_num" integer, "page_size" integer, "sort_by_debt" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_customers_b2b_list"("search_query" "text", "sales_staff_filter" "uuid", "status_filter" "text", "page_num" integer, "page_size" integer, "sort_by_debt" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_customers_b2b_list"("search_query" "text", "sales_staff_filter" "uuid", "status_filter" "text", "page_num" integer, "page_size" integer, "sort_by_debt" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text", "page_num" integer, "page_size" integer, "sort_by_debt" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text", "page_num" integer, "page_size" integer, "sort_by_debt" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_customers_b2c_list"("search_query" "text", "type_filter" "text", "status_filter" "text", "page_num" integer, "page_size" integer, "sort_by_debt" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_distinct_categories"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_distinct_categories"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_distinct_categories"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_distinct_manufacturers"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_distinct_manufacturers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_distinct_manufacturers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_inbound_detail"("p_po_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_inbound_detail"("p_po_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_inbound_detail"("p_po_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_inventory_check_list"("p_warehouse_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_inventory_check_list"("p_warehouse_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_inventory_check_list"("p_warehouse_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_inventory_checks_list"("p_warehouse_id" bigint, "p_search" "text", "p_status" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_inventory_checks_list"("p_warehouse_id" bigint, "p_search" "text", "p_status" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_inventory_checks_list"("p_warehouse_id" bigint, "p_search" "text", "p_status" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_inventory_drift"("p_check_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_inventory_drift"("p_check_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_inventory_drift"("p_check_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_mapped_product"("p_tax_code" "text", "p_product_name" "text", "p_vendor_unit" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_mapped_product"("p_tax_code" "text", "p_product_name" "text", "p_vendor_unit" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_mapped_product"("p_tax_code" "text", "p_product_name" "text", "p_vendor_unit" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_permissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_permissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_permissions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_outbound_order_detail"("p_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_outbound_order_detail"("p_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_outbound_order_detail"("p_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_outbound_stats"("p_warehouse_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_outbound_stats"("p_warehouse_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_outbound_stats"("p_warehouse_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_partner_debt_live"("p_partner_id" bigint, "p_partner_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_partner_debt_live"("p_partner_id" bigint, "p_partner_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_partner_debt_live"("p_partner_id" bigint, "p_partner_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_reconciliation_orders"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_reconciliation_orders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_reconciliation_orders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_po_logistics_stats"("p_search" "text", "p_status_delivery" "text", "p_status_payment" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_po_logistics_stats"("p_search" "text", "p_status_delivery" "text", "p_status_payment" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_po_logistics_stats"("p_search" "text", "p_status_delivery" "text", "p_status_payment" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pos_usable_promotions"("p_customer_id" bigint, "p_order_total" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_pos_usable_promotions"("p_customer_id" bigint, "p_order_total" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pos_usable_promotions"("p_customer_id" bigint, "p_order_total" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_prescription_template_details"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_prescription_template_details"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_prescription_template_details"("p_id" bigint) TO "service_role";



GRANT ALL ON TABLE "public"."prescription_templates" TO "anon";
GRANT ALL ON TABLE "public"."prescription_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."prescription_templates" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_prescription_templates"("p_search" "text", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_prescription_templates"("p_search" "text", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_prescription_templates"("p_search" "text", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_product_available_stock"("p_warehouse_id" bigint, "p_product_ids" bigint[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_product_available_stock"("p_warehouse_id" bigint, "p_product_ids" bigint[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_product_available_stock"("p_warehouse_id" bigint, "p_product_ids" bigint[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_product_details"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_product_details"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_product_details"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_products_list"("search_query" "text", "category_filter" "text", "manufacturer_filter" "text", "status_filter" "text", "page_num" integer, "page_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_products_list"("search_query" "text", "category_filter" "text", "manufacturer_filter" "text", "status_filter" "text", "page_num" integer, "page_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_products_list"("search_query" "text", "category_filter" "text", "manufacturer_filter" "text", "status_filter" "text", "page_num" integer, "page_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_purchase_order_detail"("p_po_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_purchase_order_detail"("p_po_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_purchase_order_detail"("p_po_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_purchase_order_details"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_purchase_order_details"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_purchase_order_details"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_purchase_orders_master"("p_page" integer, "p_page_size" integer, "p_search" "text", "p_status_delivery" "text", "p_status_payment" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_purchase_orders_master"("p_page" integer, "p_page_size" integer, "p_search" "text", "p_status_delivery" "text", "p_status_payment" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_purchase_orders_master"("p_page" integer, "p_page_size" integer, "p_search" "text", "p_status_delivery" "text", "p_status_payment" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sales_orders_view"("p_page" integer, "p_page_size" integer, "p_search" "text", "p_status" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_order_type" "text", "p_remittance_status" "text", "p_creator_id" "uuid", "p_payment_status" "text", "p_invoice_status" "text", "p_payment_method" "text", "p_warehouse_id" bigint, "p_customer_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_sales_orders_view"("p_page" integer, "p_page_size" integer, "p_search" "text", "p_status" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_order_type" "text", "p_remittance_status" "text", "p_creator_id" "uuid", "p_payment_status" "text", "p_invoice_status" "text", "p_payment_method" "text", "p_warehouse_id" bigint, "p_customer_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sales_orders_view"("p_page" integer, "p_page_size" integer, "p_search" "text", "p_status" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_order_type" "text", "p_remittance_status" "text", "p_creator_id" "uuid", "p_payment_status" "text", "p_invoice_status" "text", "p_payment_method" "text", "p_warehouse_id" bigint, "p_customer_id" bigint) TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_self_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_self_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_self_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_service_package_details"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_service_package_details"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_service_package_details"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_service_packages_list"("p_search_query" "text", "p_type_filter" "text", "p_status_filter" "text", "p_page_num" integer, "p_page_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_service_packages_list"("p_search_query" "text", "p_type_filter" "text", "p_status_filter" "text", "p_page_num" integer, "p_page_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_service_packages_list"("p_search_query" "text", "p_type_filter" "text", "p_status_filter" "text", "p_page_num" integer, "p_page_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shipping_partner_details"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_shipping_partner_details"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shipping_partner_details"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shipping_partners_list"("p_search_query" "text", "p_type_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_shipping_partners_list"("p_search_query" "text", "p_type_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shipping_partners_list"("p_search_query" "text", "p_type_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_supplier_quick_info"("p_supplier_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_supplier_quick_info"("p_supplier_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_supplier_quick_info"("p_supplier_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_suppliers_list"("search_query" "text", "status_filter" "text", "page_num" integer, "page_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_suppliers_list"("search_query" "text", "status_filter" "text", "page_num" integer, "page_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_suppliers_list"("search_query" "text", "status_filter" "text", "page_num" integer, "page_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_transaction_history"("p_flow" "public"."transaction_flow", "p_fund_id" bigint, "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_limit" integer, "p_offset" integer, "p_search" "text", "p_created_by" "uuid", "p_status" "public"."transaction_status") TO "anon";
GRANT ALL ON FUNCTION "public"."get_transaction_history"("p_flow" "public"."transaction_flow", "p_fund_id" bigint, "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_limit" integer, "p_offset" integer, "p_search" "text", "p_created_by" "uuid", "p_status" "public"."transaction_status") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_transaction_history"("p_flow" "public"."transaction_flow", "p_fund_id" bigint, "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_limit" integer, "p_offset" integer, "p_search" "text", "p_created_by" "uuid", "p_status" "public"."transaction_status") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_transactions"("p_page" integer, "p_page_size" integer, "p_search" "text", "p_flow" "text", "p_status" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_creator_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_transactions"("p_page" integer, "p_page_size" integer, "p_search" "text", "p_flow" "text", "p_status" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_creator_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_transactions"("p_page" integer, "p_page_size" integer, "p_search" "text", "p_flow" "text", "p_status" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_creator_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_transfers"("p_page" integer, "p_page_size" integer, "p_search" "text", "p_status" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_creator_id" "uuid", "p_receiver_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_transfers"("p_page" integer, "p_page_size" integer, "p_search" "text", "p_status" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_creator_id" "uuid", "p_receiver_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_transfers"("p_page" integer, "p_page_size" integer, "p_search" "text", "p_status" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_creator_id" "uuid", "p_receiver_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_pending_revenue"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_pending_revenue"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_pending_revenue"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_users_with_roles"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_users_with_roles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_users_with_roles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_vaccination_template_details"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_vaccination_template_details"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_vaccination_template_details"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_vaccination_templates"("p_search" "text", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_vaccination_templates"("p_search" "text", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_vaccination_templates"("p_search" "text", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_valid_vouchers_for_checkout"("p_customer_id" bigint, "p_cart_total" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_valid_vouchers_for_checkout"("p_customer_id" bigint, "p_cart_total" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_valid_vouchers_for_checkout"("p_customer_id" bigint, "p_cart_total" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_warehouse_cabinets"("p_warehouse_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_warehouse_cabinets"("p_warehouse_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_warehouse_cabinets"("p_warehouse_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_warehouse_inbound_tasks"("p_warehouse_id" bigint, "p_page" integer, "p_page_size" integer, "p_search" "text", "p_status" "text", "p_date_from" "date", "p_date_to" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_warehouse_inbound_tasks"("p_warehouse_id" bigint, "p_page" integer, "p_page_size" integer, "p_search" "text", "p_status" "text", "p_date_from" "date", "p_date_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_warehouse_inbound_tasks"("p_warehouse_id" bigint, "p_page" integer, "p_page_size" integer, "p_search" "text", "p_status" "text", "p_date_from" "date", "p_date_to" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_warehouse_outbound_tasks"("p_warehouse_id" bigint, "p_page" integer, "p_page_size" integer, "p_search" "text", "p_status" "text", "p_shipping_partner_id" bigint, "p_date_from" "date", "p_date_to" "date", "p_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_warehouse_outbound_tasks"("p_warehouse_id" bigint, "p_page" integer, "p_page_size" integer, "p_search" "text", "p_status" "text", "p_shipping_partner_id" bigint, "p_date_from" "date", "p_date_to" "date", "p_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_warehouse_outbound_tasks"("p_warehouse_id" bigint, "p_page" integer, "p_page_size" integer, "p_search" "text", "p_status" "text", "p_shipping_partner_id" bigint, "p_date_from" "date", "p_date_to" "date", "p_type" "text") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."handle_fund_balance_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_fund_balance_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_fund_balance_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_order_cancellation"("p_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."handle_order_cancellation"("p_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_order_cancellation"("p_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_order_inventory_deduction"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_order_inventory_deduction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_order_inventory_deduction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_sales_inventory_deduction"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_sales_inventory_deduction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_sales_inventory_deduction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handover_to_shipping"("p_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."handover_to_shipping"("p_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handover_to_shipping"("p_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."import_customers_b2b"("p_customers_array" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."import_customers_b2b"("p_customers_array" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_customers_b2b"("p_customers_array" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."import_opening_stock_v3_by_id"("p_warehouse_id" bigint, "p_user_id" "uuid", "p_stock_array" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."import_opening_stock_v3_by_id"("p_warehouse_id" bigint, "p_user_id" "uuid", "p_stock_array" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_opening_stock_v3_by_id"("p_warehouse_id" bigint, "p_user_id" "uuid", "p_stock_array" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."import_product_from_ai"("p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."import_product_from_ai"("p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_product_from_ai"("p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."import_suppliers_bulk"("p_suppliers" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."import_suppliers_bulk"("p_suppliers" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_suppliers_bulk"("p_suppliers" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."invite_new_user"("p_email" "text", "p_full_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."invite_new_user"("p_email" "text", "p_full_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_new_user"("p_email" "text", "p_full_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_noti_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_noti_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_noti_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_products_from_excel"("p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."match_products_from_excel"("p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_products_from_excel"("p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_group"("p_permission_key" "text", "p_title" "text", "p_message" "text", "p_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_group"("p_permission_key" "text", "p_title" "text", "p_message" "text", "p_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_group"("p_permission_key" "text", "p_title" "text", "p_message" "text", "p_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_sales_on_payment"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_sales_on_payment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_sales_on_payment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_users_by_permission"("p_permission_key" "text", "p_title" "text", "p_message" "text", "p_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_users_by_permission"("p_permission_key" "text", "p_title" "text", "p_message" "text", "p_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_users_by_permission"("p_permission_key" "text", "p_title" "text", "p_message" "text", "p_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pay_purchase_order_via_wallet"("p_po_id" bigint, "p_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."pay_purchase_order_via_wallet"("p_po_id" bigint, "p_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pay_purchase_order_via_wallet"("p_po_id" bigint, "p_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_inbound_receipt"("p_po_id" bigint, "p_warehouse_id" bigint, "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."process_inbound_receipt"("p_po_id" bigint, "p_warehouse_id" bigint, "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_inbound_receipt"("p_po_id" bigint, "p_warehouse_id" bigint, "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_sales_invoice_deduction"("p_invoice_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."process_sales_invoice_deduction"("p_invoice_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_sales_invoice_deduction"("p_invoice_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_vat_invoice_entry"("p_invoice_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."process_vat_invoice_entry"("p_invoice_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_vat_invoice_entry"("p_invoice_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."quick_assign_barcode"("p_product_id" bigint, "p_unit_id" bigint, "p_barcode" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."quick_assign_barcode"("p_product_id" bigint, "p_unit_id" bigint, "p_barcode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."quick_assign_barcode"("p_product_id" bigint, "p_unit_id" bigint, "p_barcode" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reactivate_customer_b2b"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."reactivate_customer_b2b"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reactivate_customer_b2b"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."reactivate_customer_b2c"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."reactivate_customer_b2c"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reactivate_customer_b2c"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."reactivate_shipping_partner"("p_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."reactivate_shipping_partner"("p_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reactivate_shipping_partner"("p_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_final_amount"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_final_amount"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_final_amount"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_segment_members"("p_segment_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_segment_members"("p_segment_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_segment_members"("p_segment_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."reverse_vat_invoice_entry"("p_invoice_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."reverse_vat_invoice_entry"("p_invoice_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reverse_vat_invoice_entry"("p_invoice_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."save_outbound_progress"("p_order_id" "uuid", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."save_outbound_progress"("p_order_id" "uuid", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_outbound_progress"("p_order_id" "uuid", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_customers_b2b_v2"("p_keyword" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_customers_b2b_v2"("p_keyword" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_customers_b2b_v2"("p_keyword" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_customers_by_phone_b2c"("p_search_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_customers_by_phone_b2c"("p_search_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_customers_by_phone_b2c"("p_search_query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_customers_pos"("p_keyword" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_customers_pos"("p_keyword" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_customers_pos"("p_keyword" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_items_for_sales"("p_keyword" "text", "p_warehouse_id" bigint, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_items_for_sales"("p_keyword" "text", "p_warehouse_id" bigint, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_items_for_sales"("p_keyword" "text", "p_warehouse_id" bigint, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_product_batches"("p_product_id" bigint, "p_warehouse_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."search_product_batches"("p_product_id" bigint, "p_warehouse_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_product_batches"("p_product_id" bigint, "p_warehouse_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_products_for_b2b_order"("p_keyword" "text", "p_warehouse_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."search_products_for_b2b_order"("p_keyword" "text", "p_warehouse_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_products_for_b2b_order"("p_keyword" "text", "p_warehouse_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_products_for_purchase"("p_keyword" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_products_for_purchase"("p_keyword" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_products_for_purchase"("p_keyword" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_products_for_transfer"("p_warehouse_id" bigint, "p_keyword" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_products_for_transfer"("p_warehouse_id" bigint, "p_keyword" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_products_for_transfer"("p_warehouse_id" bigint, "p_keyword" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_products_pos"("p_keyword" "text", "p_warehouse_id" bigint, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_products_pos"("p_keyword" "text", "p_warehouse_id" bigint, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_products_pos"("p_keyword" "text", "p_warehouse_id" bigint, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_products_v2"("p_keyword" "text", "p_category" "text", "p_manufacturer" "text", "p_status" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_products_v2"("p_keyword" "text", "p_category" "text", "p_manufacturer" "text", "p_status" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_products_v2"("p_keyword" "text", "p_category" "text", "p_manufacturer" "text", "p_status" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."send_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."send_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_type" "text") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."submit_cash_remittance"("p_order_ids" "uuid"[], "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_cash_remittance"("p_order_ids" "uuid"[], "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_cash_remittance"("p_order_ids" "uuid"[], "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_transfer_shipping"("p_transfer_id" bigint, "p_batch_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_transfer_shipping"("p_transfer_id" bigint, "p_batch_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_transfer_shipping"("p_transfer_id" bigint, "p_batch_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_inventory_batch_to_total"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_inventory_batch_to_total"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_inventory_batch_to_total"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_order_remittance_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_order_remittance_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_order_remittance_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_po_payment_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_po_payment_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_po_payment_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_status_to_auth"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_status_to_auth"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_status_to_auth"() TO "service_role";



GRANT ALL ON FUNCTION "public"."track_inventory_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."track_inventory_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_inventory_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."track_product_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."track_product_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_product_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_deduct_vat_inventory"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_deduct_vat_inventory"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_deduct_vat_inventory"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_notify_finance_approval"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_notify_finance_approval"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_notify_finance_approval"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_notify_warehouse_po"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_notify_warehouse_po"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_notify_warehouse_po"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_order_cancel_restore_stock"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_order_cancel_restore_stock"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_order_cancel_restore_stock"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_refresh_on_criteria_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_refresh_on_criteria_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_refresh_on_criteria_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_asset"("p_id" bigint, "p_asset_data" "jsonb", "p_maintenance_plans" "jsonb", "p_maintenance_history" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_asset"("p_id" bigint, "p_asset_data" "jsonb", "p_maintenance_plans" "jsonb", "p_maintenance_history" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_asset"("p_id" bigint, "p_asset_data" "jsonb", "p_maintenance_plans" "jsonb", "p_maintenance_history" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_customer_b2b"("p_id" bigint, "p_customer_data" "jsonb", "p_contacts" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."update_customer_b2b"("p_id" bigint, "p_customer_data" "jsonb", "p_contacts" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_customer_b2b"("p_id" bigint, "p_customer_data" "jsonb", "p_contacts" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_customer_b2c"("p_id" bigint, "p_customer_data" "jsonb", "p_guardians" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_customer_b2c"("p_id" bigint, "p_customer_data" "jsonb", "p_guardians" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_customer_b2c"("p_id" bigint, "p_customer_data" "jsonb", "p_guardians" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_full_supplier_program"("p_program_id" bigint, "p_program_data" "jsonb", "p_groups_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_full_supplier_program"("p_program_id" bigint, "p_program_data" "jsonb", "p_groups_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_full_supplier_program"("p_program_id" bigint, "p_program_data" "jsonb", "p_groups_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_inventory_check_info"("p_check_id" bigint, "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_inventory_check_info"("p_check_id" bigint, "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_inventory_check_info"("p_check_id" bigint, "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_outbound_package_count"("p_order_id" "uuid", "p_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_outbound_package_count"("p_order_id" "uuid", "p_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_outbound_package_count"("p_order_id" "uuid", "p_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_permissions_for_role"("p_role_id" "uuid", "p_permission_keys" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."update_permissions_for_role"("p_role_id" "uuid", "p_permission_keys" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_permissions_for_role"("p_role_id" "uuid", "p_permission_keys" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_prescription_template"("p_id" bigint, "p_data" "jsonb", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_prescription_template"("p_id" bigint, "p_data" "jsonb", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_prescription_template"("p_id" bigint, "p_data" "jsonb", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_product"("p_id" bigint, "p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_items_per_carton" integer, "p_carton_weight" numeric, "p_carton_dimensions" "text", "p_purchasing_policy" "text", "p_inventory_settings" "jsonb", "p_description" "text", "p_registration_number" "text", "p_packing_spec" "text", "p_updated_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_product"("p_id" bigint, "p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_items_per_carton" integer, "p_carton_weight" numeric, "p_carton_dimensions" "text", "p_purchasing_policy" "text", "p_inventory_settings" "jsonb", "p_description" "text", "p_registration_number" "text", "p_packing_spec" "text", "p_updated_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_product"("p_id" bigint, "p_name" "text", "p_sku" "text", "p_barcode" "text", "p_active_ingredient" "text", "p_image_url" "text", "p_category_name" "text", "p_manufacturer_name" "text", "p_distributor_id" bigint, "p_status" "text", "p_invoice_price" numeric, "p_actual_cost" numeric, "p_wholesale_unit" "text", "p_retail_unit" "text", "p_conversion_factor" integer, "p_wholesale_margin_value" numeric, "p_wholesale_margin_type" "text", "p_retail_margin_value" numeric, "p_retail_margin_type" "text", "p_items_per_carton" integer, "p_carton_weight" numeric, "p_carton_dimensions" "text", "p_purchasing_policy" "text", "p_inventory_settings" "jsonb", "p_description" "text", "p_registration_number" "text", "p_packing_spec" "text", "p_updated_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_product_location"("p_warehouse_id" bigint, "p_product_id" bigint, "p_cabinet" "text", "p_row" "text", "p_slot" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_product_location"("p_warehouse_id" bigint, "p_product_id" bigint, "p_cabinet" "text", "p_row" "text", "p_slot" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_product_location"("p_warehouse_id" bigint, "p_product_id" bigint, "p_cabinet" "text", "p_row" "text", "p_slot" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_product_status"("p_ids" bigint[], "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_product_status"("p_ids" bigint[], "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_product_status"("p_ids" bigint[], "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_purchase_order"("p_po_id" bigint, "p_supplier_id" bigint, "p_expected_date" timestamp with time zone, "p_note" "text", "p_items" "jsonb", "p_delivery_method" "text", "p_shipping_partner_id" bigint, "p_shipping_fee" numeric, "p_status" "text", "p_total_packages" integer, "p_carrier_name" "text", "p_carrier_contact" "text", "p_carrier_phone" "text", "p_expected_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."update_purchase_order"("p_po_id" bigint, "p_supplier_id" bigint, "p_expected_date" timestamp with time zone, "p_note" "text", "p_items" "jsonb", "p_delivery_method" "text", "p_shipping_partner_id" bigint, "p_shipping_fee" numeric, "p_status" "text", "p_total_packages" integer, "p_carrier_name" "text", "p_carrier_contact" "text", "p_carrier_phone" "text", "p_expected_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_purchase_order"("p_po_id" bigint, "p_supplier_id" bigint, "p_expected_date" timestamp with time zone, "p_note" "text", "p_items" "jsonb", "p_delivery_method" "text", "p_shipping_partner_id" bigint, "p_shipping_fee" numeric, "p_status" "text", "p_total_packages" integer, "p_carrier_name" "text", "p_carrier_contact" "text", "p_carrier_phone" "text", "p_expected_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_self_profile"("p_profile_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_self_profile"("p_profile_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_self_profile"("p_profile_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_service_package"("p_id" bigint, "p_data" "jsonb", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_service_package"("p_id" bigint, "p_data" "jsonb", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_service_package"("p_id" bigint, "p_data" "jsonb", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_shipping_partner"("p_id" bigint, "p_partner_data" "jsonb", "p_rules" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."update_shipping_partner"("p_id" bigint, "p_partner_data" "jsonb", "p_rules" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_shipping_partner"("p_id" bigint, "p_partner_data" "jsonb", "p_rules" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_supplier"("p_id" bigint, "p_name" "text", "p_tax_code" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_address" "text", "p_payment_term" "text", "p_bank_account" "text", "p_bank_name" "text", "p_bank_holder" "text", "p_delivery_method" "text", "p_lead_time" integer, "p_status" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_supplier"("p_id" bigint, "p_name" "text", "p_tax_code" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_address" "text", "p_payment_term" "text", "p_bank_account" "text", "p_bank_name" "text", "p_bank_holder" "text", "p_delivery_method" "text", "p_lead_time" integer, "p_status" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_supplier"("p_id" bigint, "p_name" "text", "p_tax_code" "text", "p_contact_person" "text", "p_phone" "text", "p_email" "text", "p_address" "text", "p_payment_term" "text", "p_bank_account" "text", "p_bank_name" "text", "p_bank_holder" "text", "p_delivery_method" "text", "p_lead_time" integer, "p_status" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_assignments"("p_user_id" "uuid", "p_assignments" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_assignments"("p_user_id" "uuid", "p_assignments" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_assignments"("p_user_id" "uuid", "p_assignments" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_status"("p_user_id" "uuid", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_status"("p_user_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_status"("p_user_id" "uuid", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_vaccination_template"("p_id" bigint, "p_data" "jsonb", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_vaccination_template"("p_id" bigint, "p_data" "jsonb", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_vaccination_template"("p_id" bigint, "p_data" "jsonb", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_product_with_units"("p_product_json" "jsonb", "p_units_json" "jsonb", "p_contents_json" "jsonb", "p_inventory_json" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_product_with_units"("p_product_json" "jsonb", "p_units_json" "jsonb", "p_contents_json" "jsonb", "p_inventory_json" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_product_with_units"("p_product_json" "jsonb", "p_units_json" "jsonb", "p_contents_json" "jsonb", "p_inventory_json" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_promotion_code"("p_code" "text", "p_customer_id" bigint, "p_order_value" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."verify_promotion_code"("p_code" "text", "p_customer_id" bigint, "p_order_value" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_promotion_code"("p_code" "text", "p_customer_id" bigint, "p_order_value" numeric) TO "service_role";



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
























GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



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



GRANT ALL ON TABLE "public"."batches" TO "anon";
GRANT ALL ON TABLE "public"."batches" TO "authenticated";
GRANT ALL ON TABLE "public"."batches" TO "service_role";



GRANT ALL ON SEQUENCE "public"."batches_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."batches_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."batches_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."chart_of_accounts" TO "anon";
GRANT ALL ON TABLE "public"."chart_of_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."chart_of_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."clinical_queues" TO "anon";
GRANT ALL ON TABLE "public"."clinical_queues" TO "authenticated";
GRANT ALL ON TABLE "public"."clinical_queues" TO "service_role";



GRANT ALL ON SEQUENCE "public"."clinical_queues_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."clinical_queues_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."clinical_queues_id_seq" TO "service_role";



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



GRANT ALL ON TABLE "public"."customer_segment_members" TO "anon";
GRANT ALL ON TABLE "public"."customer_segment_members" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_segment_members" TO "service_role";



GRANT ALL ON SEQUENCE "public"."customer_segment_members_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customer_segment_members_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customer_segment_members_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."customer_segments" TO "anon";
GRANT ALL ON TABLE "public"."customer_segments" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_segments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."customer_segments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customer_segments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customer_segments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."customer_vouchers" TO "anon";
GRANT ALL ON TABLE "public"."customer_vouchers" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_vouchers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."customer_vouchers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customer_vouchers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customer_vouchers_id_seq" TO "service_role";



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



GRANT ALL ON TABLE "public"."finance_invoice_allocations" TO "anon";
GRANT ALL ON TABLE "public"."finance_invoice_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_invoice_allocations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."finance_invoice_allocations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."finance_invoice_allocations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."finance_invoice_allocations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."finance_invoices" TO "anon";
GRANT ALL ON TABLE "public"."finance_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_invoices" TO "service_role";



GRANT ALL ON SEQUENCE "public"."finance_invoices_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."finance_invoices_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."finance_invoices_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."finance_transactions" TO "anon";
GRANT ALL ON TABLE "public"."finance_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_transactions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."finance_transactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."finance_transactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."finance_transactions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."fund_accounts" TO "anon";
GRANT ALL ON TABLE "public"."fund_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."fund_accounts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."fund_accounts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."fund_accounts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."fund_accounts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_batches" TO "anon";
GRANT ALL ON TABLE "public"."inventory_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_batches" TO "service_role";



GRANT ALL ON SEQUENCE "public"."inventory_batches_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inventory_batches_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inventory_batches_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_check_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_check_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_check_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."inventory_check_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inventory_check_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inventory_check_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_checks" TO "anon";
GRANT ALL ON TABLE "public"."inventory_checks" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_checks" TO "service_role";



GRANT ALL ON SEQUENCE "public"."inventory_checks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inventory_checks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inventory_checks_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_receipt_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_receipt_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_receipt_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."inventory_receipt_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inventory_receipt_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inventory_receipt_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_receipts" TO "anon";
GRANT ALL ON TABLE "public"."inventory_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_receipts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."inventory_receipts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inventory_receipts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inventory_receipts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_transactions" TO "anon";
GRANT ALL ON TABLE "public"."inventory_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_transactions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."inventory_transactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inventory_transactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inventory_transactions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_transfer_batch_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_transfer_batch_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_transfer_batch_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."inventory_transfer_batch_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inventory_transfer_batch_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inventory_transfer_batch_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_transfer_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_transfer_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_transfer_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."inventory_transfer_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inventory_transfer_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inventory_transfer_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_transfers" TO "anon";
GRANT ALL ON TABLE "public"."inventory_transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_transfers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."inventory_transfers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inventory_transfers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inventory_transfers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."permissions" TO "anon";
GRANT ALL ON TABLE "public"."permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."permissions" TO "service_role";



GRANT ALL ON TABLE "public"."prescription_template_items" TO "anon";
GRANT ALL ON TABLE "public"."prescription_template_items" TO "authenticated";
GRANT ALL ON TABLE "public"."prescription_template_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."prescription_template_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."prescription_template_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."prescription_template_items_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."prescription_templates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."prescription_templates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."prescription_templates_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."product_activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_activity_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_activity_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_activity_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_activity_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_contents" TO "anon";
GRANT ALL ON TABLE "public"."product_contents" TO "authenticated";
GRANT ALL ON TABLE "public"."product_contents" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_contents_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_contents_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_contents_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_inventory" TO "anon";
GRANT ALL ON TABLE "public"."product_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."product_inventory" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_inventory_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_inventory_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_inventory_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_units" TO "anon";
GRANT ALL ON TABLE "public"."product_units" TO "authenticated";
GRANT ALL ON TABLE "public"."product_units" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_units_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_units_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_units_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."promotion_gifts" TO "anon";
GRANT ALL ON TABLE "public"."promotion_gifts" TO "authenticated";
GRANT ALL ON TABLE "public"."promotion_gifts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."promotion_gifts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."promotion_gifts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."promotion_gifts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."promotion_targets" TO "anon";
GRANT ALL ON TABLE "public"."promotion_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."promotion_targets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."promotion_targets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."promotion_targets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."promotion_targets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."promotion_usages" TO "anon";
GRANT ALL ON TABLE "public"."promotion_usages" TO "authenticated";
GRANT ALL ON TABLE "public"."promotion_usages" TO "service_role";



GRANT ALL ON TABLE "public"."promotions" TO "anon";
GRANT ALL ON TABLE "public"."promotions" TO "authenticated";
GRANT ALL ON TABLE "public"."promotions" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_order_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."purchase_order_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."purchase_order_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."purchase_order_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT ALL ON SEQUENCE "public"."purchase_orders_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."purchase_orders_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."purchase_orders_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."sales_invoices" TO "anon";
GRANT ALL ON TABLE "public"."sales_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_invoices" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sales_invoices_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sales_invoices_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sales_invoices_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."service_consumables" TO "anon";
GRANT ALL ON TABLE "public"."service_consumables" TO "authenticated";
GRANT ALL ON TABLE "public"."service_consumables" TO "service_role";



GRANT ALL ON SEQUENCE "public"."service_consumables_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."service_consumables_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."service_consumables_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."service_package_items" TO "anon";
GRANT ALL ON TABLE "public"."service_package_items" TO "authenticated";
GRANT ALL ON TABLE "public"."service_package_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."service_package_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."service_package_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."service_package_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."service_packages" TO "anon";
GRANT ALL ON TABLE "public"."service_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."service_packages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."service_packages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."service_packages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."service_packages_id_seq" TO "service_role";



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



GRANT ALL ON TABLE "public"."supplier_program_groups" TO "anon";
GRANT ALL ON TABLE "public"."supplier_program_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_program_groups" TO "service_role";



GRANT ALL ON SEQUENCE "public"."supplier_program_groups_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."supplier_program_groups_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."supplier_program_groups_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_program_products" TO "anon";
GRANT ALL ON TABLE "public"."supplier_program_products" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_program_products" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_programs" TO "anon";
GRANT ALL ON TABLE "public"."supplier_programs" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_programs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."supplier_programs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."supplier_programs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."supplier_programs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_wallets" TO "anon";
GRANT ALL ON TABLE "public"."supplier_wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_wallets" TO "service_role";



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



GRANT ALL ON TABLE "public"."vaccination_template_items" TO "anon";
GRANT ALL ON TABLE "public"."vaccination_template_items" TO "authenticated";
GRANT ALL ON TABLE "public"."vaccination_template_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."vaccination_template_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."vaccination_template_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."vaccination_template_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."vaccination_templates" TO "anon";
GRANT ALL ON TABLE "public"."vaccination_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."vaccination_templates" TO "service_role";



GRANT ALL ON SEQUENCE "public"."vaccination_templates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."vaccination_templates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."vaccination_templates_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."vat_inventory_ledger" TO "anon";
GRANT ALL ON TABLE "public"."vat_inventory_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."vat_inventory_ledger" TO "service_role";



GRANT ALL ON SEQUENCE "public"."vat_inventory_ledger_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."vat_inventory_ledger_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."vat_inventory_ledger_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."vendor_product_mappings" TO "anon";
GRANT ALL ON TABLE "public"."vendor_product_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_product_mappings" TO "service_role";



GRANT ALL ON SEQUENCE "public"."vendor_product_mappings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."vendor_product_mappings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."vendor_product_mappings_id_seq" TO "service_role";



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































