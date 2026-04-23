-- HOTFIX follow-up: regression từ 240000 + 240100 phát hiện qua integration test
-- ============================================================================
-- BUG 1: notify_payment_received insert b2b_notifications thiếu `old_status` +
--        `new_status` trong data JSON. Client Portal / test integration đang
--        assert 2 field này.
--
-- BUG 2: record_manual_payment_received check `IF auth.uid() IS NULL THEN
--        RAISE 'Chưa đăng nhập'` khiến service_role (admin client, Edge
--        Function, cron job) không gọi được RPC. Tests integration fail hết.
--        Fix: bypass auth + role check khi caller = service_role (trust
--        admin/server context). Giữ nguyên check cho authenticated user.
-- Date: 2026-04-23
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. notify_payment_received: thêm old_status + new_status vào b2b_notifications.data
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_payment_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_paid_increased BOOLEAN;
  v_confirmed BOOLEAN;
  v_customer_name TEXT;
  v_delta numeric;
  v_remaining numeric;
  v_title TEXT;
  v_body TEXT;
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_creator RECORD;
  v_portal_user RECORD;
BEGIN
  v_paid_increased := COALESCE(OLD.paid_amount, 0) < COALESCE(NEW.paid_amount, 0);
  v_confirmed := OLD.status = 'PENDING' AND NEW.status = 'CONFIRMED';

  IF NOT (v_paid_increased OR v_confirmed) THEN
    RETURN NEW;
  END IF;

  v_delta := COALESCE(NEW.paid_amount, 0) - COALESCE(OLD.paid_amount, 0);
  v_remaining := GREATEST(NEW.final_amount - COALESCE(NEW.paid_amount, 0), 0);

  IF NEW.customer_id IS NOT NULL THEN
    SELECT name INTO v_customer_name FROM public.customers_b2b WHERE id = NEW.customer_id;
  ELSIF NEW.customer_b2c_id IS NOT NULL THEN
    SELECT name INTO v_customer_name FROM public.customers WHERE id = NEW.customer_b2c_id;
  END IF;

  v_title := CASE
    WHEN v_confirmed THEN 'Đơn ' || NEW.code || ' đã thanh toán đủ'
    ELSE 'Đã nhận thanh toán cho đơn ' || NEW.code
  END;
  v_body := CASE
    WHEN v_confirmed THEN 'Đơn hàng ' || NEW.code || ' đã thanh toán đủ '
      || to_char(NEW.final_amount, 'FM999,999,999,999') || 'đ. Đội kho sẽ sớm chuẩn bị hàng.'
    ELSE 'Đã nhận ' || to_char(v_delta, 'FM999,999,999,999') || 'đ cho đơn ' || NEW.code
      || '. Còn thiếu: ' || to_char(v_remaining, 'FM999,999,999,999') || 'đ.'
  END;

  IF NEW.customer_id IS NOT NULL THEN
    -- [FIX] Thêm old_status + new_status cho consumer dựa vào status transition
    INSERT INTO public.b2b_notifications (customer_b2b_id, type, title, body, data)
    VALUES (
      NEW.customer_id,
      'order_status',
      v_title,
      v_body,
      jsonb_build_object(
        'order_id', NEW.id,
        'order_code', NEW.code,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'event', CASE WHEN v_confirmed THEN 'payment_confirmed' ELSE 'payment_received' END,
        'amount', v_delta,
        'paid_total', NEW.paid_amount,
        'final_amount', NEW.final_amount,
        'remaining', v_remaining,
        'link', '/don-hang/' || NEW.code
      )
    );
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_supabase_url
      FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL';
    SELECT decrypted_secret INTO v_service_key
      FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
    RAISE WARNING 'notify_payment_received: không đọc được vault secret: %', SQLERRM;
  END;

  IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL AND NEW.customer_id IS NOT NULL THEN
    FOR v_portal_user IN
      SELECT pu.email, pu.display_name
      FROM public.portal_users pu
      WHERE pu.customer_b2b_id = NEW.customer_id
        AND pu.status = 'active'
        AND pu.email IS NOT NULL AND pu.email <> ''
    LOOP
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-portal-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'type', 'payment_received_customer',
            'email', v_portal_user.email,
            'data', jsonb_build_object(
              'business_name', COALESCE(v_customer_name, 'Quý khách'),
              'display_name', COALESCE(v_portal_user.display_name, v_customer_name),
              'order_code', NEW.code,
              'amount', v_delta::text,
              'total_paid', NEW.paid_amount,
              'final_amount', NEW.final_amount,
              'remaining_amount', v_remaining,
              'status_confirmed', v_confirmed
            )
          ),
          timeout_milliseconds := 5000
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'notify_payment_received: email KH fail, order=%, email=%, err=%',
          NEW.code, v_portal_user.email, SQLERRM;
      END;
    END LOOP;
  END IF;

  IF NEW.creator_id IS NOT NULL THEN
    SELECT u.id AS user_id, u.email
    INTO v_creator
    FROM auth.users u WHERE u.id = NEW.creator_id;

    IF v_creator.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_id)
      VALUES (
        v_creator.user_id,
        '[ERP] ' || v_title,
        COALESCE(v_customer_name, 'Khách lẻ') || ': ' || v_body,
        'payment',
        NEW.id
      );

      IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL
         AND v_creator.email IS NOT NULL AND v_creator.email <> '' THEN
        BEGIN
          PERFORM net.http_post(
            url := v_supabase_url || '/functions/v1/send-portal-email',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_service_key
            ),
            body := jsonb_build_object(
              'type', 'payment_received_internal',
              'email', v_creator.email,
              'data', jsonb_build_object(
                'customer_name', COALESCE(v_customer_name, 'Khách lẻ'),
                'order_code', NEW.code,
                'amount', v_delta::text,
                'final_amount', NEW.final_amount,
                'remaining_amount', v_remaining,
                'status_confirmed', v_confirmed
              )
            ),
            timeout_milliseconds := 5000
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'notify_payment_received: email NV KD fail, order=%, err=%', NEW.code, SQLERRM;
        END;
      END IF;
    END IF;
  END IF;

  IF v_confirmed THEN
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    SELECT ur.user_id,
           'Đơn mới cần đóng hàng: ' || NEW.code,
           COALESCE(v_customer_name, 'Khách lẻ') || ' | ' ||
             to_char(NEW.final_amount, 'FM999,999,999,999') || 'đ',
           'warehouse_task',
           NEW.id
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE r.name IN ('warehouse_admin', 'warehouse_staff')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. record_manual_payment_received: bypass auth/role check cho service_role
-- ============================================================================
-- Lý do: admin client (service_role) trong Edge Function, cron, integration
-- test KHÔNG có JWT user → auth.uid() NULL → fail. Service_role vốn đã là
-- trust boundary cao nhất (không expose client-side), cho phép bypass.
-- Authenticated user thường (UI portal) vẫn phải đủ role.
CREATE OR REPLACE FUNCTION public.record_manual_payment_received(
  p_order_id uuid,
  p_amount numeric DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_partner_type TEXT;
  v_partner_id TEXT;
  v_partner_name TEXT;
  v_fund_id BIGINT;
  v_amount numeric;
  v_trans_code TEXT;
  v_actor_email TEXT;
  v_has_role BOOLEAN;
  v_is_service_role BOOLEAN;
BEGIN
  v_is_service_role := (auth.role() = 'service_role');

  -- Auth check: chỉ bắt buộc cho non-service caller
  IF NOT v_is_service_role AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Chưa đăng nhập';
  END IF;

  -- Role check: service_role bypass (trust boundary)
  IF NOT v_is_service_role THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('admin', 'sales_admin', 'warehouse_admin', 'finance_admin')
    ) INTO v_has_role;

    IF NOT v_has_role THEN
      RAISE EXCEPTION 'Không có quyền ghi nhận thanh toán. Cần role admin/sales_admin/warehouse_admin/finance_admin.';
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT email INTO v_actor_email FROM auth.users WHERE id = auth.uid();
  ELSE
    v_actor_email := 'service_role';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('order-pay-' || p_order_id::text, 0)
  );

  SELECT o.id, o.code, o.final_amount, o.paid_amount, o.payment_status, o.status,
         o.customer_id, o.customer_b2c_id,
         cb.name AS b2b_name, cc.name AS b2c_name
  INTO v_order
  FROM public.orders o
  LEFT JOIN public.customers_b2b cb ON o.customer_id = cb.id
  LEFT JOIN public.customers cc ON o.customer_b2c_id = cc.id
  WHERE o.id = p_order_id
  FOR UPDATE OF o;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy đơn hàng';
  END IF;
  IF v_order.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'Đơn đã hủy, không thể ghi nhận thanh toán';
  END IF;
  IF v_order.payment_status = 'paid' THEN
    RAISE EXCEPTION 'Đơn đã thanh toán đủ';
  END IF;

  v_amount := COALESCE(
    p_amount,
    GREATEST(v_order.final_amount - COALESCE(v_order.paid_amount, 0), 0)
  );
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Số tiền phải > 0';
  END IF;

  IF v_amount > (v_order.final_amount - COALESCE(v_order.paid_amount, 0)) + 100 THEN
    RAISE EXCEPTION 'Số tiền vượt quá số nợ còn lại của đơn (% đ)',
      to_char(v_order.final_amount - COALESCE(v_order.paid_amount, 0), 'FM999,999,999');
  END IF;

  SELECT id INTO v_fund_id
  FROM public.fund_accounts WHERE type = 'bank' LIMIT 1;
  IF v_fund_id IS NULL THEN v_fund_id := 1; END IF;

  IF v_order.customer_id IS NOT NULL THEN
    v_partner_type := 'customer_b2b';
    v_partner_id := v_order.customer_id::TEXT;
    v_partner_name := v_order.b2b_name;
  ELSE
    v_partner_type := 'customer';
    v_partner_id := v_order.customer_b2c_id::TEXT;
    v_partner_name := v_order.b2c_name;
  END IF;

  v_trans_code := 'PT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' ||
                  LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  INSERT INTO public.finance_transactions (
    code, amount, flow, business_type, fund_account_id,
    partner_type, partner_id, partner_name_cache,
    ref_type, ref_id, description, status
  ) VALUES (
    v_trans_code, v_amount, 'in', 'trade', v_fund_id,
    v_partner_type, v_partner_id, COALESCE(v_partner_name, 'Khách lẻ'),
    'order', v_order.code,
    'Xác nhận thủ công bởi ' || v_actor_email ||
      CASE WHEN p_note IS NULL OR btrim(p_note) = '' THEN '' ELSE '. Ghi chú: ' || p_note END,
    'completed'
  );

  RETURN jsonb_build_object(
    'success', true,
    'trans_code', v_trans_code,
    'amount', v_amount,
    'order_code', v_order.code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_manual_payment_received(uuid, numeric, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
