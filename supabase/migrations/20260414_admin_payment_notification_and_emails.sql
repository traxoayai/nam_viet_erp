-- Migration: Admin payment notification trigger + email cho tất cả admin triggers
-- Date: 2026-04-14
-- Mô tả:
--   1. Enable pg_net extension
--   2. Trigger thông báo admin khi nhận thanh toán (finance_transactions)
--   3. Cập nhật fn_notify_admin_new_registration → thêm email qua pg_net
--   4. Cập nhật fn_notify_admin_new_portal_order → thêm email qua pg_net
--   5. Cập nhật fn_notify_admin_payment_received → thêm email qua pg_net

BEGIN;

-- 1. Enable pg_net extension for async HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Admin payment notification trigger
CREATE OR REPLACE FUNCTION public.fn_notify_admin_payment_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_amount_text TEXT;
  v_partner TEXT;
  v_ref TEXT;
BEGIN
  -- Only notify for completed incoming payments
  IF NEW.flow != 'in' THEN RETURN NEW; END IF;
  IF NEW.status != 'completed' THEN RETURN NEW; END IF;

  v_amount_text := to_char(NEW.amount, 'FM999,999,999,999') || ' đ';
  v_partner := COALESCE(NEW.partner_name_cache, 'Không rõ');
  v_ref := COALESCE(NEW.ref_id, NEW.code);

  FOR v_user_id IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    WHERE rp.permission_key IN ('portal.manage', 'finance.view_balance', 'admin-all')
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    VALUES (
      v_user_id,
      'Thanh toán mới: ' || v_amount_text,
      v_partner || ' — ' || v_ref || ' — ' || COALESCE(NEW.description, ''),
      'success',
      NULL
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_payment_received ON public.finance_transactions;
CREATE TRIGGER trg_notify_admin_payment_received
  AFTER INSERT ON public.finance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_admin_payment_received();

-- 3. Update fn_notify_admin_new_registration to also send email via pg_net
CREATE OR REPLACE FUNCTION public.fn_notify_admin_new_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_user RECORD;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Get config for email sending (best-effort)
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
    -- In-app notification
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    VALUES (
      v_user.user_id,
      'Đăng ký Portal mới',
      NEW.business_name || ' — ' || COALESCE(NEW.contact_name, NEW.email),
      'info',
      NEW.id
    );

    -- Email (best-effort, async via pg_net)
    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL AND v_user.email IS NOT NULL THEN
      BEGIN
        PERFORM extensions.http_post(
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
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Email send failed: %', SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 4. Update fn_notify_admin_new_portal_order to also send email
CREATE OR REPLACE FUNCTION public.fn_notify_admin_new_portal_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
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

  -- Get config for email (best-effort)
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
    -- In-app notification
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    VALUES (
      v_user.user_id,
      'Đơn hàng Portal mới',
      NEW.code || ' — ' || v_customer_name,
      'info',
      NEW.id
    );

    -- Email (best-effort, async)
    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL AND v_user.email IS NOT NULL THEN
      BEGIN
        PERFORM extensions.http_post(
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
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Email send failed: %', SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 5. Also add email to payment trigger
CREATE OR REPLACE FUNCTION public.fn_notify_admin_payment_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
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
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    VALUES (
      v_user.user_id,
      'Thanh toán mới: ' || v_amount_text,
      v_partner || ' — ' || v_ref,
      'success',
      NULL
    );

    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL AND v_user.email IS NOT NULL THEN
      BEGIN
        PERFORM extensions.http_post(
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
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Email send failed: %', SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMIT;
