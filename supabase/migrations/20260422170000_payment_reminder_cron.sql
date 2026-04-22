-- Migration: Cron nhắc thanh toán đơn Portal PENDING (Email + In-app)
-- ============================================================================
-- GOAL:
--   Với đơn `orders.status = 'PENDING'` tạo trong 24h qua:
--   Gửi tối đa 3 nhắc ở các mốc T+2h, T+12h, T+20h trước khi cron auto-hủy T+24h
--   (cron hủy đã có: migration 20260416230000_cancel_unpaid_orders_cron.sql).
--
--   Mỗi lần nhắc:
--     1. Insert 1 row vào `b2b_notifications` (type='order_status') → realtime in-app.
--     2. Gọi Edge Function `send-portal-email` với type='payment_reminder' cho mọi
--        portal_user active của customer_b2b.
--
-- IDEMPOTENCY:
--   Đếm số lần đã nhắc qua `b2b_notifications.data->>'reminder_kind' = 'payment_pending'`.
--   Chỉ gửi khi `reminders_sent < milestone_target`, bước 1 mốc mỗi tick để tránh
--   nhồi cùng lúc khi cron catchup sau outage.
--
-- GIỜ GỬI:
--   Chỉ chạy khi giờ hiện tại (Asia/Ho_Chi_Minh) trong [08:00, 20:00).
--   Ngoài giờ, function return sớm; cron vẫn tick nhưng không làm gì.
--
-- SCHEDULE:
--   Cron `payment-reminder-pending-orders` chạy mỗi 30 phút.
--
-- VAULT SECRETS (đã có sẵn, dùng lại pattern của 20260414210000):
--   - SUPABASE_URL
--   - SUPABASE_SERVICE_ROLE_KEY
--   - PORTAL_URL (link về Portal B2B; nếu không có → fallback '#')
--
-- Date: 2026-04-22
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.check_pending_payment_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_supabase_url   TEXT;
  v_service_key    TEXT;
  v_portal_url     TEXT;
  v_vn_hour        INT;

  v_order          RECORD;
  v_age_hours      NUMERIC;
  v_milestone      INT;       -- mốc lý tưởng theo age (0..3)
  v_already_sent   INT;       -- số lần đã nhắc cho đơn này
  v_next_idx       INT;       -- mốc sẽ gửi lần này (1..3)
  v_hours_left     NUMERIC;
  v_remaining      NUMERIC;
  v_business_name  TEXT;

  v_user           RECORD;
BEGIN
  -- 1. Giới hạn giờ gửi: chỉ trong 08:00–20:00 (Asia/Ho_Chi_Minh)
  v_vn_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh'));
  IF v_vn_hour < 8 OR v_vn_hour >= 20 THEN
    RETURN;
  END IF;

  -- 2. Đọc secrets (best-effort; vẫn chạy in-app nếu thiếu)
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

  -- 3. Quét đơn cần nhắc
  FOR v_order IN
    SELECT
      o.id,
      o.code,
      o.customer_id,
      o.final_amount,
      COALESCE(o.paid_amount, 0) AS paid_amount,
      o.created_at,
      c.name AS customer_name
    FROM public.orders o
    LEFT JOIN public.customers_b2b c ON c.id = o.customer_id
    WHERE o.status = 'PENDING'
      AND o.customer_id IS NOT NULL
      -- Chỉ nhắc đơn trong cửa sổ 24h (ngoài 24h cron hủy sẽ xử lý).
      AND o.created_at > NOW() - INTERVAL '24 hours'
      AND o.created_at <= NOW() - INTERVAL '2 hours'
  LOOP
    v_age_hours := EXTRACT(EPOCH FROM (NOW() - v_order.created_at)) / 3600.0;

    -- Mốc lý tưởng theo tuổi đơn
    v_milestone := CASE
      WHEN v_age_hours >= 20 THEN 3
      WHEN v_age_hours >= 12 THEN 2
      WHEN v_age_hours >= 2  THEN 1
      ELSE 0
    END;

    IF v_milestone = 0 THEN
      CONTINUE;
    END IF;

    -- Đếm số nhắc đã gửi (chỉ đếm row có flag reminder_kind='payment_pending')
    SELECT COUNT(*)::INT INTO v_already_sent
    FROM public.b2b_notifications
    WHERE customer_b2b_id = v_order.customer_id
      AND type = 'order_status'
      AND (data ->> 'order_id') = v_order.id::text
      AND (data ->> 'reminder_kind') = 'payment_pending';

    IF v_already_sent >= v_milestone THEN
      CONTINUE;
    END IF;

    -- Chỉ bước 1 mốc mỗi tick (catchup từ từ)
    v_next_idx   := v_already_sent + 1;
    v_hours_left := GREATEST(0, 24 - v_age_hours);
    v_remaining  := GREATEST(0, v_order.final_amount - v_order.paid_amount);

    -- 3a. In-app notification
    INSERT INTO public.b2b_notifications (
      customer_b2b_id, type, title, body, data
    ) VALUES (
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

    -- 3b. Email cho từng portal_user active của customer
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
          PERFORM extensions.http_post(
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
            )
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'payment_reminder email failed for order %: %', v_order.code, SQLERRM;
        END;
      END LOOP;
    END IF;

  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.check_pending_payment_reminders() IS
  'Nhắc thanh toán cho đơn Portal PENDING ở các mốc T+2/T+12/T+20 giờ. Chạy mỗi 30 phút, skip ngoài giờ 08–20 VN.';

-- ============================================================================
-- SCHEDULE (pg_cron)
-- ============================================================================
-- Unschedule nếu đã tồn tại (idempotent re-run)
DO $$
BEGIN
  PERFORM cron.unschedule('payment-reminder-pending-orders');
EXCEPTION WHEN OTHERS THEN
  -- Job chưa tồn tại — bỏ qua
  NULL;
END $$;

SELECT cron.schedule(
  'payment-reminder-pending-orders',
  '*/30 * * * *',
  $$SELECT public.check_pending_payment_reminders()$$
);

COMMIT;
