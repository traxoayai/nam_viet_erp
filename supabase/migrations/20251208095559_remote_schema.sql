create type "public"."order_status" as enum ('DRAFT', 'QUOTE', 'QUOTE_EXPIRED', 'CONFIRMED', 'PACKED', 'SHIPPING', 'DELIVERED', 'CANCELLED');

drop function if exists "public"."get_suppliers_list"(search_query text, status_filter text, page_num integer, page_size integer);

drop function if exists "public"."get_transaction_history"(p_flow public.transaction_flow, p_fund_id bigint, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_limit integer, p_offset integer, p_search text, p_status text);

alter table "public"."finance_transactions" alter column "status" drop default;

alter type "public"."transaction_status" rename to "transaction_status__old_version_to_be_dropped";

create type "public"."transaction_status" as enum ('pending', 'confirmed', 'cancelled', 'completed', 'approved');


  create table "public"."order_items" (
    "id" uuid not null default gen_random_uuid(),
    "order_id" uuid not null,
    "product_id" bigint not null,
    "quantity" integer not null,
    "uom" text not null,
    "conversion_factor" integer default 1,
    "base_quantity" integer generated always as ((quantity * conversion_factor)) stored,
    "unit_price" numeric not null,
    "discount" numeric default 0,
    "is_gift" boolean default false,
    "note" text,
    "batch_no" text,
    "expiry_date" date,
    "total_line" numeric generated always as ((((quantity)::numeric * unit_price) - discount)) stored,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."order_items" enable row level security;

alter table "public"."finance_transactions" alter column status type "public"."transaction_status" using status::text::"public"."transaction_status";

alter table "public"."finance_transactions" alter column "status" set default 'pending'::public.transaction_status;

drop type "public"."transaction_status__old_version_to_be_dropped";

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);

CREATE INDEX idx_orders_customer ON public.orders USING btree (customer_id);

CREATE INDEX idx_orders_status ON public.orders USING btree (status);

CREATE UNIQUE INDEX order_items_pkey ON public.order_items USING btree (id);

alter table "public"."order_items" add constraint "order_items_pkey" PRIMARY KEY using index "order_items_pkey";

alter table "public"."order_items" add constraint "order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE not valid;

alter table "public"."order_items" validate constraint "order_items_order_id_fkey";

alter table "public"."order_items" add constraint "order_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) not valid;

alter table "public"."order_items" validate constraint "order_items_product_id_fkey";

alter table "public"."order_items" add constraint "order_items_quantity_check" CHECK ((quantity > 0)) not valid;

alter table "public"."order_items" validate constraint "order_items_quantity_check";

alter table "public"."order_items" add constraint "order_items_unit_price_check" CHECK ((unit_price >= (0)::numeric)) not valid;

alter table "public"."order_items" validate constraint "order_items_unit_price_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.confirm_finance_transaction(p_id bigint, p_target_status text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_sales_order(p_customer_id bigint, p_delivery_address text, p_delivery_time text, p_note text, p_items jsonb, p_discount_amount numeric DEFAULT 0, p_shipping_fee numeric DEFAULT 0, p_status public.order_status DEFAULT 'DRAFT'::public.order_status)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_order_id UUID;
    v_code TEXT;
    v_item JSONB;
    v_product_record RECORD;
    v_conversion_factor INTEGER;
    v_total_amount NUMERIC := 0;
BEGIN
    -- 1. Sinh mã đơn: SO-YYMMDD-XXXX
    v_code := 'SO-' || to_char(now(), 'YYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');

    -- 2. Tạo Header
    INSERT INTO public.orders (
        code, customer_id, creator_id, status,
        delivery_address, delivery_time, note,
        discount_amount, shipping_fee
    ) VALUES (
        v_code, p_customer_id, auth.uid(), p_status,
        p_delivery_address, p_delivery_time, p_note,
        p_discount_amount, p_shipping_fee
    ) RETURNING id INTO v_order_id;

    -- 3. Tạo Items & Tính tiền
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Lấy thông tin quy đổi từ bảng Product
        SELECT items_per_carton, wholesale_unit INTO v_product_record
        FROM public.products WHERE id = (v_item->>'product_id')::BIGINT;

        -- Tính hệ số quy đổi
        IF (v_item->>'uom') = v_product_record.wholesale_unit THEN
            v_conversion_factor := COALESCE(v_product_record.items_per_carton, 1);
        ELSE
            v_conversion_factor := 1;
        END IF;

        -- Insert Item
        INSERT INTO public.order_items (
            order_id, product_id, quantity, uom, conversion_factor,
            unit_price, discount, is_gift, note
        ) VALUES (
            v_order_id,
            (v_item->>'product_id')::BIGINT,
            (v_item->>'quantity')::INTEGER,
            v_item->>'uom',
            v_conversion_factor,
            (v_item->>'unit_price')::NUMERIC,
            COALESCE((v_item->>'discount')::NUMERIC, 0),
            COALESCE((v_item->>'is_gift')::BOOLEAN, false),
            v_item->>'note'
        );

        -- Cộng dồn tổng tiền hàng (Trước CK tổng)
        -- Công thức: (SL * Giá) - CK dòng
        v_total_amount := v_total_amount + (
            ((v_item->>'quantity')::INTEGER * (v_item->>'unit_price')::NUMERIC) - COALESCE((v_item->>'discount')::NUMERIC, 0)
        );
    END LOOP;

    -- 4. Cập nhật Tổng tiền & Thành tiền cuối cùng
    UPDATE public.orders 
    SET total_amount = v_total_amount,
        final_amount = v_total_amount - p_discount_amount + p_shipping_fee
    WHERE id = v_order_id;

    RETURN v_order_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_available_vouchers(p_customer_id bigint, p_order_total numeric)
 RETURNS TABLE(id uuid, code text, name text, description text, discount_type text, discount_value numeric, max_discount_value numeric, min_order_value numeric, valid_to timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_customer_debt_info(p_customer_id bigint)
 RETURNS TABLE(customer_id bigint, customer_name text, debt_limit numeric, current_debt numeric, available_credit numeric, is_bad_debt boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.handle_sales_inventory_deduction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_item RECORD;
    v_current_stock INTEGER;
    v_warehouse_id BIGINT := 1; -- Tạm thời Hardcode kho Tổng B2B (ID=1)
BEGIN
    -- Chỉ chạy khi trạng thái chuyển sang 'CONFIRMED' (Chốt đơn)
    -- Và trạng thái cũ KHÔNG PHẢI là CONFIRMED/PACKED/SHIPPING... (tránh trừ 2 lần)
    IF NEW.status = 'CONFIRMED' AND (OLD.status IS NULL OR OLD.status NOT IN ('CONFIRMED', 'PACKED', 'SHIPPING', 'DELIVERED')) THEN
        
        FOR v_item IN SELECT * FROM public.order_items WHERE order_id = NEW.id LOOP
            -- 1. Kiểm tra tồn kho
            SELECT stock_quantity INTO v_current_stock
            FROM public.product_inventory
            WHERE product_id = v_item.product_id AND warehouse_id = v_warehouse_id;

            IF v_current_stock IS NULL OR v_current_stock < v_item.base_quantity THEN
                RAISE EXCEPTION 'Sản phẩm ID % không đủ tồn kho (Tồn: %, Cần: %)', v_item.product_id, COALESCE(v_current_stock,0), v_item.base_quantity;
            END IF;

            -- 2. Trừ kho
            UPDATE public.product_inventory
            SET stock_quantity = stock_quantity - v_item.base_quantity
            WHERE product_id = v_item.product_id AND warehouse_id = v_warehouse_id;
        END LOOP;
    END IF;
    
    -- TODO: Xử lý logic cộng lại kho khi HỦY đơn (CANCELLED) - Sẽ làm ở Phase sau
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.search_items_for_sales(p_keyword text, p_warehouse_id bigint DEFAULT 1, p_limit integer DEFAULT 20)
 RETURNS TABLE(id bigint, type text, sku text, name text, image_url text, uom text, uom_wholesale text, stock_quantity integer, price_retail numeric, price_wholesale numeric, items_per_carton integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.search_product_batches(p_product_id bigint, p_warehouse_id bigint DEFAULT 1)
 RETURNS TABLE(lot_number text, expiry_date date, days_remaining integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Lưu ý: Đây là gợi ý lô dựa trên lịch sử nhập.
    -- Hệ thống hiện tại (V1) quản lý tồn kho tổng (product_inventory).
    -- Việc tracking số lượng chi tiết từng lô (Batch Inventory) sẽ được nâng cấp ở V2.
    RETURN QUERY
    SELECT DISTINCT 
        iri.lot_number,
        iri.expiry_date,
        (iri.expiry_date - CURRENT_DATE)::int as days_remaining
    FROM public.inventory_receipt_items iri
    JOIN public.inventory_receipts ir ON iri.receipt_id = ir.id
    WHERE 
        iri.product_id = p_product_id
        AND ir.warehouse_id = p_warehouse_id
        AND iri.expiry_date > CURRENT_DATE -- Chỉ lấy lô còn hạn
    ORDER BY iri.expiry_date ASC; -- FIFO: Hết hạn trước xuất trước
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_finance_transaction(p_flow public.transaction_flow, p_business_type public.business_type, p_fund_account_id bigint, p_amount numeric, p_category_id bigint DEFAULT NULL::bigint, p_partner_type text DEFAULT NULL::text, p_partner_id text DEFAULT NULL::text, p_partner_name text DEFAULT NULL::text, p_ref_type text DEFAULT NULL::text, p_ref_id text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_evidence_url text DEFAULT NULL::text, p_status public.transaction_status DEFAULT 'pending'::public.transaction_status, p_cash_tally jsonb DEFAULT NULL::jsonb, p_ref_advance_id bigint DEFAULT NULL::bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_new_id BIGINT;
    v_code TEXT;
    v_prefix TEXT;
    v_partner_name_final TEXT;
BEGIN
    IF p_flow = 'in' THEN v_prefix := 'PT'; ELSE v_prefix := 'PC'; END IF;
    v_code := v_prefix || '-' || to_char(now(), 'YYMMDD') || '-' || lpad(floor(random() * 10000)::text, 4, '0');

    v_partner_name_final := p_partner_name;
    IF v_partner_name_final IS NULL AND p_partner_id IS NOT NULL THEN
        IF p_partner_type = 'supplier' THEN
            SELECT name INTO v_partner_name_final FROM public.suppliers WHERE id = p_partner_id::bigint;
        ELSIF p_partner_type = 'customer' THEN
            SELECT name INTO v_partner_name_final FROM public.customers WHERE id = p_partner_id::bigint;
        ELSIF p_partner_type = 'customer_b2b' THEN
            SELECT name INTO v_partner_name_final FROM public.customers_b2b WHERE id = p_partner_id::bigint;
        ELSIF p_partner_type = 'employee' THEN
            SELECT full_name INTO v_partner_name_final FROM public.users WHERE id = p_partner_id::uuid;
        END IF;
    END IF;

    INSERT INTO public.finance_transactions (
        code, flow, business_type, category_id,
        amount, fund_account_id,
        partner_type, partner_id, partner_name_cache,
        ref_type, ref_id,
        description, evidence_url, created_by,
        status, cash_tally, ref_advance_id
    ) VALUES (
        v_code, p_flow, p_business_type, p_category_id,
        p_amount, p_fund_account_id,
        p_partner_type, p_partner_id, v_partner_name_final,
        p_ref_type, p_ref_id,
        p_description, p_evidence_url, auth.uid(),
        p_status, p_cash_tally, p_ref_advance_id
    )
    RETURNING id INTO v_new_id;

    IF p_ref_advance_id IS NOT NULL THEN
        UPDATE public.finance_transactions
        SET status = 'completed', updated_at = now()
        WHERE id = p_ref_advance_id;
    END IF;

    RETURN v_new_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_suppliers_list(search_query text, status_filter text, page_num integer, page_size integer)
 RETURNS TABLE(id bigint, key text, code text, name text, contact_person text, phone text, status text, debt numeric, bank_bin text, bank_account text, bank_name text, bank_holder text, total_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH filtered_suppliers AS (
        SELECT 
            s.id,
            s.id::TEXT AS key,
            'NCC-' || s.id::TEXT AS code,
            s.name,
            s.contact_person,
            s.phone,
            s.status,
            0::NUMERIC AS debt,
            
            -- Full Bank Info
            s.bank_bin,
            s.bank_account,
            s.bank_name,
            s.bank_holder, -- Đã bổ sung
            
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
        AND (p_status IS NULL OR t.status = p_status::public.transaction_status)
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

CREATE OR REPLACE FUNCTION public.handle_fund_balance_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

grant delete on table "public"."order_items" to "anon";

grant insert on table "public"."order_items" to "anon";

grant references on table "public"."order_items" to "anon";

grant select on table "public"."order_items" to "anon";

grant trigger on table "public"."order_items" to "anon";

grant truncate on table "public"."order_items" to "anon";

grant update on table "public"."order_items" to "anon";

grant delete on table "public"."order_items" to "authenticated";

grant insert on table "public"."order_items" to "authenticated";

grant references on table "public"."order_items" to "authenticated";

grant select on table "public"."order_items" to "authenticated";

grant trigger on table "public"."order_items" to "authenticated";

grant truncate on table "public"."order_items" to "authenticated";

grant update on table "public"."order_items" to "authenticated";

grant delete on table "public"."order_items" to "service_role";

grant insert on table "public"."order_items" to "service_role";

grant references on table "public"."order_items" to "service_role";

grant select on table "public"."order_items" to "service_role";

grant trigger on table "public"."order_items" to "service_role";

grant truncate on table "public"."order_items" to "service_role";

grant update on table "public"."order_items" to "service_role";


  create policy "Enable all for authenticated"
  on "public"."order_items"
  as permissive
  for all
  to authenticated
using (true);



  create policy "Enable all for authenticated"
  on "public"."orders"
  as permissive
  for all
  to authenticated
using (true);


CREATE TRIGGER on_sales_order_confirm AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_sales_inventory_deduction();


