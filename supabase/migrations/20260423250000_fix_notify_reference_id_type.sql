-- HOTFIX: notify_payment_received cast reference_id SAI type
-- ============================================================================
-- BUG: INSERT INTO notifications (reference_id) VALUES (NEW.id::text)
--      — notifications.reference_id là UUID, NEW.id (orders.id) cũng UUID.
--      Cast ::text khiến Postgres throw 42804 "column is of type uuid but
--      expression is of type text" → toàn bộ UPDATE orders rollback → NV bấm
--      "Đã Thu" fail, không ghi nhận được thanh toán.
--
-- REPRO: admin-nam-viet.vercel.app/finance/transactions → Đã Thu trên 1 PT
-- pending → toast đỏ: column "reference_id" is of type uuid but expression
-- is of type text.
--
-- FIX: Bỏ cast ::text (orders.id vốn đã là uuid). Giữ nguyên mọi logic khác.
-- Date: 2026-04-23
-- ============================================================================

BEGIN;

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
    INSERT INTO public.b2b_notifications (customer_b2b_id, type, title, body, data)
    VALUES (
      NEW.customer_id,
      'order_status',
      v_title,
      v_body,
      jsonb_build_object(
        'order_id', NEW.id, 'order_code', NEW.code,
        'event', CASE WHEN v_confirmed THEN 'payment_confirmed' ELSE 'payment_received' END,
        'amount', v_delta, 'paid_total', NEW.paid_amount,
        'final_amount', NEW.final_amount, 'remaining', v_remaining,
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
      -- [FIX] Bỏ cast ::text — notifications.reference_id là uuid, orders.id cũng uuid
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
    -- [FIX] Bỏ cast ::text giống trên
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

COMMIT;
