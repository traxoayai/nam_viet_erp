-- ============================================================
-- Portal Hub: source column, dashboard RPC, admin notifications
-- Ngày: 2026-04-12
-- ============================================================

BEGIN;

-- ============================================================
-- A. ADD SOURCE COLUMN TO ORDERS
-- ============================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'erp';
COMMENT ON COLUMN public.orders.source IS 'Origin of order: erp or portal. NULL treated as erp.';
CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders (source);

-- ============================================================
-- B. UPDATE create_sales_order RPC — add p_source param
-- ============================================================
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

  -- A. VALIDATION
  IF p_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Bắt buộc phải chọn Kho xuất hàng (p_warehouse_id).';
  END IF;

  IF p_order_type IS NULL OR p_order_type = '' THEN
    IF p_customer_b2c_id IS NOT NULL THEN v_safe_order_type := 'POS'; ELSE v_safe_order_type := 'B2B'; END IF;
  ELSE
    v_safe_order_type := p_order_type;
  END IF;

  v_final_b2b_id := COALESCE(p_customer_b2b_id, p_customer_id);

  IF v_safe_order_type = 'POS' THEN v_prefix := 'POS-'; ELSE v_prefix := 'SO-'; END IF;
  v_code := v_prefix || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  -- B. CALCULATE TOTALS
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total_amount := v_total_amount + ((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC);
  END LOOP;

  -- C. STOCK CHECK
  IF p_status IN ('CONFIRMED', 'COMPLETED', 'PACKED', 'SHIPPING', 'DELIVERED', 'DONE') THEN
    PERFORM public._validate_stock_availability(p_warehouse_id, p_items);
  END IF;

  -- D. VOUCHER VALIDATION
  IF p_voucher_code IS NOT NULL AND p_voucher_code <> '' THEN
      v_voucher_check := public.verify_promotion_code(p_voucher_code, v_final_b2b_id, v_total_amount);
      IF (v_voucher_check->>'valid')::BOOLEAN = false THEN
          RAISE EXCEPTION 'Voucher không hợp lệ: %', (v_voucher_check->>'message');
      END IF;
      v_voucher_discount := (v_voucher_check->>'discount_amount')::NUMERIC;
  END IF;

  v_final_amount := v_total_amount - COALESCE(p_discount_amount, 0) - v_voucher_discount + COALESCE(p_shipping_fee, 0);

  -- E. CREDIT EXPOSURE CHECK (B2B)
  -- [FIX 2026-04-09]: Tạm bỏ credit check tương tự migration 20260411000000

  -- F. INSERT ORDER HEADER
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

  -- G. PROCESS ITEMS & CONDITIONAL DEDUCTION
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

    -- [FIX 2026-04-09]: Không trừ kho cho B2B khi status = CONFIRMED
    IF (p_status IN ('COMPLETED', 'PACKED', 'SHIPPING', 'DELIVERED', 'DONE'))
       OR (v_safe_order_type = 'POS' AND p_status = 'CONFIRMED')
    THEN
      PERFORM public._deduct_stock_fefo(p_warehouse_id, (v_item->>'product_id')::BIGINT, v_base_quantity_needed, v_unit_price, v_code, v_final_b2b_id::TEXT);
    END IF;
  END LOOP;

  -- H. RECORD VOUCHER USAGE
  IF v_voucher_discount > 0 THEN
      INSERT INTO public.promotion_usages (promotion_id, customer_id, order_id, discount_amount)
      VALUES ((v_voucher_check->'promotion'->>'id')::UUID, v_final_b2b_id, v_order_id, v_voucher_discount);
      UPDATE public.promotions SET usage_count = usage_count + 1 WHERE id = (v_voucher_check->'promotion'->>'id')::UUID;
  END IF;

  -- I. AUTO FINANCE TRANSACTION
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

-- ============================================================
-- C. UPDATE get_sales_orders_view RPC — add p_source filter
-- ============================================================
DROP FUNCTION IF EXISTS "public"."get_sales_orders_view";

CREATE OR REPLACE FUNCTION "public"."get_sales_orders_view"(
    "p_page" integer DEFAULT 1,
    "p_page_size" integer DEFAULT 10,
    "p_search" "text" DEFAULT NULL::"text",
    "p_status" "text" DEFAULT NULL::"text",
    "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone,
    "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone,
    "p_order_type" "text" DEFAULT NULL::"text",
    "p_remittance_status" "text" DEFAULT NULL::"text",
    "p_creator_id" "uuid" DEFAULT NULL::"uuid",
    "p_payment_status" "text" DEFAULT NULL::"text",
    "p_invoice_status" "text" DEFAULT NULL::"text",
    "p_payment_method" "text" DEFAULT NULL::"text",
    "p_warehouse_id" bigint DEFAULT NULL::bigint,
    "p_customer_id" bigint DEFAULT NULL::bigint,
    "p_source" "text" DEFAULT NULL::"text"
)
RETURNS "jsonb"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
    v_offset INT := (p_page - 1) * p_page_size;
    v_result JSONB;
    v_stats JSONB;
BEGIN
    -- A. STATS
    WITH stats_filter AS (
        SELECT final_amount, paid_amount, remittance_status, payment_method, status
        FROM public.orders o
        WHERE
            (p_order_type IS NULL OR o.order_type = p_order_type)
            AND (p_status IS NULL OR o.status = p_status)
            AND (p_date_from IS NULL OR o.created_at >= p_date_from)
            AND (p_date_to IS NULL OR o.created_at <= p_date_to)
            AND (p_creator_id IS NULL OR o.creator_id = p_creator_id)
            AND (p_warehouse_id IS NULL OR o.warehouse_id = p_warehouse_id)
            AND (p_source IS NULL OR COALESCE(o.source, 'erp') = p_source)
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

            -- Source
            COALESCE(o.source, 'erp') as source,

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
            AND (p_payment_method IS NULL OR o.payment_method = p_payment_method)
            AND (p_warehouse_id IS NULL OR o.warehouse_id = p_warehouse_id)
            AND (p_customer_id IS NULL OR (o.customer_id = p_customer_id OR o.customer_b2c_id = p_customer_id))
            AND (p_source IS NULL OR COALESCE(o.source, 'erp') = p_source)

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

-- ============================================================
-- D. PORTAL DASHBOARD RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_portal_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_result JSONB;
  v_today DATE := CURRENT_DATE;
  v_week_start DATE := date_trunc('week', CURRENT_DATE)::DATE;
  v_month_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
BEGIN
  SELECT jsonb_build_object(
    'pending_registrations', (
      SELECT COUNT(*) FROM public.registration_requests WHERE status = 'pending'
    ),
    'orders_today', (
      SELECT COUNT(*) FROM public.orders
      WHERE COALESCE(source, 'erp') = 'portal' AND created_at >= v_today
    ),
    'orders_this_week', (
      SELECT COUNT(*) FROM public.orders
      WHERE COALESCE(source, 'erp') = 'portal' AND created_at >= v_week_start
    ),
    'revenue_this_month', (
      SELECT COALESCE(SUM(final_amount), 0) FROM public.orders
      WHERE COALESCE(source, 'erp') = 'portal'
        AND created_at >= v_month_start
        AND status NOT IN ('DRAFT', 'CANCELLED')
    ),
    'daily_orders', (
      SELECT COALESCE(jsonb_agg(row_to_json(d)), '[]'::jsonb)
      FROM (
        SELECT
          gs::date as date,
          COUNT(o.id) as count
        FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, '1 day') gs
        LEFT JOIN public.orders o
          ON o.created_at::date = gs::date
          AND COALESCE(o.source, 'erp') = 'portal'
        GROUP BY gs::date
        ORDER BY gs::date
      ) d
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================
-- E. ADMIN NOTIFICATION TRIGGERS
-- ============================================================

-- E.1: Notify admin on new registration request
CREATE OR REPLACE FUNCTION public.fn_notify_admin_new_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  FOR v_user_id IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    WHERE rp.permission_key IN ('portal.manage', 'admin-all')
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    VALUES (
      v_user_id,
      'Đăng ký Portal mới',
      NEW.business_name || ' — ' || COALESCE(NEW.contact_name, NEW.email),
      'info',
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_new_registration ON public.registration_requests;
CREATE TRIGGER trg_notify_admin_new_registration
  AFTER INSERT ON public.registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_admin_new_registration();

-- E.2: Notify admin on new portal order
CREATE OR REPLACE FUNCTION public.fn_notify_admin_new_portal_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_customer_name TEXT;
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

  FOR v_user_id IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    WHERE rp.permission_key IN ('portal.manage', 'admin-all')
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    VALUES (
      v_user_id,
      'Đơn hàng Portal mới',
      NEW.code || ' — ' || v_customer_name,
      'info',
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_new_portal_order ON public.orders;
CREATE TRIGGER trg_notify_admin_new_portal_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_admin_new_portal_order();

-- ============================================================
-- F. PORTAL PERMISSIONS
-- ============================================================
INSERT INTO public.permissions (key, name, module)
VALUES
  ('portal.view', 'Xem Portal', 'portal'),
  ('portal.manage', 'Quản lý Portal', 'portal')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- G. ENABLE REALTIME + RELOAD
-- ============================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- already added
END;
$$;
NOTIFY pgrst, 'reload schema';

COMMIT;
