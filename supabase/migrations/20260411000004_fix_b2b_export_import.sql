-- Fix 1: Xuất Excel B2B bị lỗi ambiguous function
--   Nguyên nhân: CREATE OR REPLACE đổi sales_staff_filter từ TEXT→UUID
--   tạo thêm overload thay vì replace. Cần DROP bản cũ (text, text, text).
--
-- Fix 2: Nhập Excel B2B - địa chỉ luôn NULL
--   Nguyên nhân: SQL đọc customer_data->>'address' nhưng frontend gửi
--   'vat_address' và 'shipping_address'.

BEGIN;

------------------------------------------------------------------------
-- Fix 1: DROP overload cũ của export_customers_b2b_list
--   Bản cũ: (sales_staff_filter text, search_query text, status_filter text)
--   Bản đúng (giữ lại): (search_query text, sales_staff_filter uuid, status_filter text)
------------------------------------------------------------------------
DROP FUNCTION IF EXISTS "public"."export_customers_b2b_list"("sales_staff_filter" "text", "search_query" "text", "status_filter" "text");

------------------------------------------------------------------------
-- Fix 2: Sửa bulk_upsert_customers_b2b đọc đúng key JSON từ frontend
--   'address' → 'vat_address' / 'shipping_address'
------------------------------------------------------------------------
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
                customer_data->>'vat_address',
                customer_data->>'shipping_address',
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
                tax_code = EXCLUDED.tax_code,
                debt_limit = EXCLUDED.debt_limit,
                payment_term = EXCLUDED.payment_term,
                vat_address = EXCLUDED.vat_address,
                shipping_address = EXCLUDED.shipping_address,
                sales_staff_id = COALESCE(EXCLUDED.sales_staff_id, customers_b2b.sales_staff_id),
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
                SELECT id, paid_amount INTO v_debt_order_id, v_paid_amount
                FROM public.orders
                WHERE code = 'DEBT-INIT-' || v_final_customer_code;

                IF v_debt_order_id IS NULL THEN
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
                    IF v_paid_amount = 0 THEN
                        UPDATE public.orders
                        SET total_amount = v_initial_debt,
                            final_amount = v_initial_debt,
                            updated_at = NOW()
                        WHERE id = v_debt_order_id;
                    END IF;
                END IF;
            END IF;

            v_success_count := v_success_count + 1;
        END LOOP;

        RETURN jsonb_build_object('success', true, 'count', v_success_count);
    END;
$$;

COMMIT;
