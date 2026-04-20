-- =============================================================================
-- Migration: Fix fn_notify_admin_new_registration để chèn đúng category
-- Date: 2026-04-20
--
-- Vấn đề:
-- Function body hiện tại trên PROD insert notification KHÔNG có column category
-- → NotificationBell không thể map sang route /portal/registrations.
-- Ngoài ra từ 2026-04-15 về sau, nhiều registration không trigger notification
-- (có thể do hotfix ngoài migration track). Re-apply idempotent version chuẩn.
-- =============================================================================

BEGIN;

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
        RAISE WARNING '[notify_admin_new_registration] email send failed: %', SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Đảm bảo trigger vẫn attached (idempotent)
DROP TRIGGER IF EXISTS trg_notify_admin_new_registration ON public.registration_requests;
CREATE TRIGGER trg_notify_admin_new_registration
  AFTER INSERT ON public.registration_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_admin_new_registration();

COMMIT;
