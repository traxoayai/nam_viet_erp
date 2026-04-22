-- Migration: Fix extensions.http_post → net.http_post + idle tx hardening
-- ============================================================================
-- CONTEXT:
--   Từ 2026-04-14 đến nay, nhiều function/cron dùng `extensions.http_post(...)`
--   — function NÀY KHÔNG TỒN TẠI trên Supabase project này. Chỉ có `net.http_post`.
--   Vì http call được wrap trong BEGIN...EXCEPTION WHEN OTHERS → error bị swallow.
--   Hệ quả silent fail:
--     - Admin email: đơn Portal mới / đăng ký mới / thanh toán mới → KHÔNG gửi
--     - Gmail watch auto-renew cron → KHÔNG renew → webhook Gmail hết hạn 7 ngày
--     - Payment reminder cron (mới 22/4) → chỉ in-app hoạt động, email fail
--
--   Root cause của login fail `b2b@test.com` hôm nay: transaction zombie
--   (`COPY system_logs TO stdout`) idle 7h14p giữ lock → gotrue timeout 502.
--   Postgres không có timeout mặc định cho idle-in-transaction.
--
-- FIX (atomic — tất cả hoặc không):
--   1. ALTER ROLE đặt idle_in_transaction_session_timeout cho role app runtime
--      (authenticated/service_role/anon). KHÔNG đụng role hệ thống
--      (supabase_admin/supabase_auth_admin/postgres) để không break migration/admin.
--   2. CREATE OR REPLACE 4 function đổi `extensions.http_post` → `net.http_post`
--      với signature đúng (url, body, params, headers, timeout).
--      Giữ NGUYÊN toàn bộ logic khác (phiên bản lấy từ bản latest của từng function).
--   3. Reschedule cron `renew-gmail-watch` với http call đúng.
--   4. Thêm cron `idle-tx-monitor` chạy mỗi 15 phút:
--        - Phát hiện idle-in-transaction > 10 phút
--        - Insert notification cho admin (không auto-kill — cần admin review)
--        - Auto-kill nếu > 60 phút (zombie chắc chắn)
--
-- Date: 2026-04-22
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. IDLE-IN-TRANSACTION TIMEOUT
-- ============================================================================
-- 5 phút đủ rộng cho mọi query hợp pháp của app, đủ chặt để ngăn zombie tích tụ.
-- KHÔNG set cho supabase_admin/postgres/supabase_auth_admin để migration/dump dài
-- và gotrue không bị ngắt.

ALTER ROLE authenticated SET idle_in_transaction_session_timeout = '5min';
ALTER ROLE anon          SET idle_in_transaction_session_timeout = '5min';
ALTER ROLE service_role  SET idle_in_transaction_session_timeout = '5min';

-- ============================================================================
-- 2a. fn_notify_admin_new_registration — đổi http_post schema
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_notify_admin_new_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user RECORD;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
    v_service_key := NULL;
  END;

  FOR v_user IN
    SELECT DISTINCT ur.user_id, u.email
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN auth.users u ON ur.user_id = u.id
    WHERE rp.permission_key IN ('portal.manage', 'admin-all')
  LOOP
    BEGIN
      INSERT INTO public.notifications (user_id, title, message, type, category, reference_id)
      VALUES (
        v_user.user_id,
        'Đăng ký Portal mới',
        NEW.business_name || ' — ' || COALESCE(NEW.contact_name, NEW.email),
        'info',
        'portal_registration',
        NEW.id
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[notify_admin_new_registration] insert notification failed for user %: %', v_user.user_id, SQLERRM;
    END;

    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL AND v_user.email IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-portal-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'type', 'admin_new_registration',
            'email', v_user.email,
            'data', jsonb_build_object(
              'business_name', NEW.business_name,
              'contact_name', COALESCE(NEW.contact_name, ''),
              'contact_email', COALESCE(NEW.email, ''),
              'contact_phone', COALESCE(NEW.phone, '')
            )
          ),
          timeout_milliseconds := 3000
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[notify_admin_new_registration] email send failed: %', SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 2b. fn_notify_admin_new_portal_order — đổi http_post schema
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_notify_admin_new_portal_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user RECORD;
  v_customer_name TEXT;
  v_supabase_url TEXT;
  v_service_key TEXT;
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

  BEGIN
    SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
    v_service_key := NULL;
  END;

  FOR v_user IN
    SELECT DISTINCT ur.user_id, u.email
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN auth.users u ON ur.user_id = u.id
    WHERE rp.permission_key IN ('portal.manage', 'admin-all')
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, category, reference_id)
    VALUES (
      v_user.user_id,
      'Đơn hàng Portal mới',
      NEW.code || ' — ' || v_customer_name,
      'info',
      'portal_order',
      NEW.id
    );

    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL AND v_user.email IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-portal-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'type', 'admin_new_order',
            'email', v_user.email,
            'data', jsonb_build_object(
              'order_code', NEW.code,
              'customer_name', v_customer_name,
              'total_amount', COALESCE(NEW.final_amount, NEW.total_amount, 0)
            )
          ),
          timeout_milliseconds := 3000
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[notify_admin_new_portal_order] email send failed: %', SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 2c. fn_notify_admin_payment_received — đổi http_post schema
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_notify_admin_payment_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user RECORD;
  v_amount_text TEXT;
  v_partner TEXT;
  v_ref TEXT;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  IF NEW.flow != 'in' THEN RETURN NEW; END IF;
  IF NEW.status != 'completed' THEN RETURN NEW; END IF;

  v_amount_text := to_char(NEW.amount, 'FM999,999,999,999') || ' đ';
  v_partner := COALESCE(NEW.partner_name_cache, 'Không rõ');
  v_ref := COALESCE(NEW.ref_id, NEW.code);

  BEGIN
    SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
    v_service_key := NULL;
  END;

  FOR v_user IN
    SELECT DISTINCT ur.user_id, u.email
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN auth.users u ON ur.user_id = u.id
    WHERE rp.permission_key IN ('portal.manage', 'finance.view_balance', 'admin-all')
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, category, metadata, reference_id)
    VALUES (
      v_user.user_id,
      'Thanh toán mới: ' || v_amount_text,
      v_partner || ' — ' || v_ref,
      'success',
      'payment_received',
      jsonb_build_object('transaction_id', NEW.id, 'code', NEW.code, 'ref_id', v_ref),
      NULL
    );

    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL AND v_user.email IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-portal-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'type', 'admin_payment_received',
            'email', v_user.email,
            'data', jsonb_build_object(
              'amount', v_amount_text,
              'partner_name', v_partner,
              'reference', v_ref,
              'description', COALESCE(NEW.description, '')
            )
          ),
          timeout_milliseconds := 3000
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[notify_admin_payment_received] email send failed: %', SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 2d. check_pending_payment_reminders — đổi http_post schema (từ 20260422170000)
-- ============================================================================

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
  v_milestone      INT;
  v_already_sent   INT;
  v_next_idx       INT;
  v_hours_left     NUMERIC;
  v_remaining      NUMERIC;
  v_business_name  TEXT;
  v_user           RECORD;
BEGIN
  v_vn_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh'));
  IF v_vn_hour < 8 OR v_vn_hour >= 20 THEN
    RETURN;
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
$$;

-- ============================================================================
-- 3. RESCHEDULE gmail-watch cron with correct http_post
-- ============================================================================

DO $$
BEGIN
  PERFORM cron.unschedule('renew-gmail-watch');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'renew-gmail-watch',
  '0 2 */6 * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1)
           || '/functions/v1/gmail-push-receiver',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-gmail-push-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'GMAIL_PUSH_SECRET' LIMIT 1)
    ),
    body := '{"action":"renew-watch"}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);

-- ============================================================================
-- 4. IDLE TRANSACTION MONITOR
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_idle_transactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tx     RECORD;
  v_admin  RECORD;
  v_age    INTERVAL;
  v_killed BOOLEAN;
BEGIN
  FOR v_tx IN
    SELECT pid, usename, state, xact_start, query_start,
           NOW() - xact_start AS tx_age,
           LEFT(query, 300) AS query_preview
    FROM pg_stat_activity
    WHERE state = 'idle in transaction'
      AND xact_start IS NOT NULL
      AND NOW() - xact_start > INTERVAL '10 minutes'
      -- Loại trừ role hệ thống (có thể hợp lệ giữ tx lâu trong edge case)
      AND usename NOT IN ('supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin', 'supabase_replication_admin')
  LOOP
    v_age := v_tx.tx_age;
    v_killed := FALSE;

    -- Auto-kill zombie chắc chắn (> 60 phút)
    IF v_age > INTERVAL '60 minutes' THEN
      BEGIN
        PERFORM pg_terminate_backend(v_tx.pid);
        v_killed := TRUE;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[idle-tx-monitor] Failed to kill pid %: %', v_tx.pid, SQLERRM;
      END;
    END IF;

    -- Notify admin (dedup: 1 notification / pid / giờ)
    FOR v_admin IN
      SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON ur.role_id = rp.role_id
      WHERE rp.permission_key = 'admin-all'
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_admin.user_id
          AND n.category = 'idle_tx_zombie'
          AND (n.metadata ->> 'pid')::INT = v_tx.pid
          AND n.created_at > NOW() - INTERVAL '1 hour'
      ) THEN
        INSERT INTO public.notifications (user_id, title, message, type, category, metadata)
        VALUES (
          v_admin.user_id,
          CASE WHEN v_killed
            THEN '[Auto-killed] Idle transaction zombie'
            ELSE 'Idle transaction cảnh báo'
          END,
          'PID ' || v_tx.pid || ' (' || COALESCE(v_tx.usename, 'unknown')
            || ') idle ' || EXTRACT(EPOCH FROM v_age)::INT / 60 || ' phút. '
            || CASE WHEN v_killed THEN 'Đã tự động terminate.' ELSE 'Cần review.' END,
          CASE WHEN v_killed THEN 'warning' ELSE 'error' END,
          'idle_tx_zombie',
          jsonb_build_object(
            'pid', v_tx.pid,
            'usename', v_tx.usename,
            'tx_age_minutes', EXTRACT(EPOCH FROM v_age)::INT / 60,
            'query_preview', v_tx.query_preview,
            'auto_killed', v_killed
          )
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.check_idle_transactions() IS
  'Mỗi 15 phút: phát hiện idle-in-transaction > 10 phút (alert admin), > 60 phút (auto-kill). Loại trừ role hệ thống.';

DO $$
BEGIN
  PERFORM cron.unschedule('idle-tx-monitor');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'idle-tx-monitor',
  '*/15 * * * *',
  $$SELECT public.check_idle_transactions()$$
);

NOTIFY pgrst, 'reload schema';

COMMIT;
