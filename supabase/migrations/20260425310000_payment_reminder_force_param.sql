-- Add p_force param to check_pending_payment_reminders
-- ============================================================================
-- Test integration cần fire RPC ngoài giờ 08-20 VN. Refactor: param `p_force`
-- (default 0 = giữ nguyên hour-check cũ → cron không đổi behavior).
-- Khi p_force=1 → bypass hour check, scan ngay.
--
-- Cron schedule (`payment-reminder-15min`) vẫn gọi không param → default 0.
-- Test set p_force=1 cover happy path bất kể giờ chạy.
--
-- Date: 2026-04-25
-- ============================================================================

BEGIN;

-- Drop overload no-param trước (nếu tồn tại) để tránh ambiguous
DROP FUNCTION IF EXISTS public.check_pending_payment_reminders();

CREATE OR REPLACE FUNCTION public.check_pending_payment_reminders(
  p_force INT DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url   TEXT;
  v_service_key    TEXT;
  v_portal_url     TEXT;
  v_vn_hour        INT;
  v_order          RECORD;
  v_age_hours      NUMERIC;
  v_milestone      INT;
  v_already_sent   INT;
  v_next_idx       INT;
  v_hours_left     NUMERIC;
  v_remaining      NUMERIC;
  v_business_name  TEXT;
  v_user           RECORD;
BEGIN
  -- Hour check chỉ áp dụng khi p_force=0 (cron mặc định).
  -- Test gọi với p_force=1 để bypass.
  IF p_force IS NULL OR p_force = 0 THEN
    v_vn_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh'));
    IF v_vn_hour < 8 OR v_vn_hour >= 20 THEN
      RETURN;
    END IF;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_supabase_url
      FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO v_service_key
      FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
    SELECT decrypted_secret INTO v_portal_url
      FROM vault.decrypted_secrets WHERE name = 'PORTAL_URL' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
    v_service_key  := NULL;
    v_portal_url   := NULL;
  END;

  v_portal_url := COALESCE(v_portal_url, '#');

  FOR v_order IN
    SELECT o.id, o.code, o.customer_id, o.final_amount,
           COALESCE(o.paid_amount, 0) AS paid_amount,
           o.created_at, c.name AS customer_name
    FROM public.orders o
    LEFT JOIN public.customers_b2b c ON c.id = o.customer_id
    WHERE o.status = 'PENDING'
      AND o.customer_id IS NOT NULL
      AND o.created_at > NOW() - INTERVAL '24 hours'
      AND o.created_at <= NOW() - INTERVAL '2 hours'
  LOOP
    v_age_hours := EXTRACT(EPOCH FROM (NOW() - v_order.created_at)) / 3600.0;
    v_milestone := CASE
      WHEN v_age_hours >= 20 THEN 3
      WHEN v_age_hours >= 12 THEN 2
      WHEN v_age_hours >= 2  THEN 1
      ELSE 0
    END;

    IF v_milestone = 0 THEN CONTINUE; END IF;

    SELECT COUNT(*)::INT INTO v_already_sent
    FROM public.b2b_notifications
    WHERE customer_b2b_id = v_order.customer_id
      AND type = 'order_status'
      AND (data ->> 'order_id') = v_order.id::text
      AND (data ->> 'reminder_kind') = 'payment_pending';

    IF v_already_sent >= v_milestone THEN CONTINUE; END IF;

    v_next_idx   := v_already_sent + 1;
    v_hours_left := GREATEST(0, 24 - v_age_hours);
    v_remaining  := GREATEST(0, v_order.final_amount - v_order.paid_amount);

    INSERT INTO public.b2b_notifications (customer_b2b_id, type, title, body, data)
    VALUES (
      v_order.customer_id,
      'order_status',
      'Nhắc thanh toán đơn ' || v_order.code,
      'Đơn ' || v_order.code || ' còn '
        || to_char(v_remaining, 'FM999,999,999,999') || 'đ chưa thanh toán. '
        || 'Đơn sẽ tự hủy sau ~' || ROUND(v_hours_left) || ' giờ nữa nếu chưa thanh toán.',
      jsonb_build_object(
        'order_id',       v_order.id,
        'order_code',     v_order.code,
        'reminder_kind',  'payment_pending',
        'milestone_idx',  v_next_idx,
        'remaining',      v_remaining,
        'hours_left',     ROUND(v_hours_left),
        'link',           '/don-hang/' || v_order.code
      )
    );

    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL THEN
      SELECT COALESCE(c.name, 'Quý khách') INTO v_business_name
      FROM public.customers_b2b c WHERE c.id = v_order.customer_id;

      FOR v_user IN
        SELECT pu.email, pu.display_name
        FROM public.portal_users pu
        WHERE pu.customer_b2b_id = v_order.customer_id
          AND pu.status = 'active'
          AND pu.email IS NOT NULL
      LOOP
        BEGIN
          PERFORM net.http_post(
            url := v_supabase_url || '/functions/v1/send-portal-email',
            headers := jsonb_build_object(
              'Content-Type',  'application/json',
              'Authorization', 'Bearer ' || v_service_key
            ),
            body := jsonb_build_object(
              'type',  'payment_reminder',
              'email', v_user.email,
              'data',  jsonb_build_object(
                'order_code',       v_order.code,
                'display_name',     COALESCE(v_user.display_name, v_business_name),
                'business_name',    v_business_name,
                'portal_url',       v_portal_url,
                'total_amount',     v_order.final_amount,
                'remaining_amount', v_remaining,
                'hours_left',       ROUND(v_hours_left),
                'milestone_idx',    v_next_idx
              )
            ),
            timeout_milliseconds := 3000
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'payment_reminder email failed for order %: %', v_order.code, SQLERRM;
        END;
      END LOOP;
    END IF;
  END LOOP;
END;
$function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
