-- =============================================================================
-- Migration: handle_new_user không ban Portal users
-- Date: 2026-04-20
--
-- Root cause bug "Portal user bị BAN sau khi đăng ký":
--   1. Register Portal → auth.admin.createUser → auth.users mới.
--   2. Trigger on_auth_user_created → handle_new_user INSERT public.users
--      với status='pending_approval' (mặc định dành cho nhân viên ERP chờ duyệt).
--   3. Trigger trg_users_sync_status → sync_user_status_to_auth()
--      → banned_until = now() + 100 years (vì status != 'active').
--   4. Khi admin duyệt Portal → chỉ tạo portal_users, KHÔNG đổi public.users.status
--      → user vẫn ban → signInWithPassword trả user_banned.
--
-- Fix triệt để: handle_new_user check metadata `is_portal_user` → set status='active'
-- cho Portal users ngay từ đầu (vì status của họ quản lý qua portal_users riêng,
-- không dùng public.users.status như flow ERP nhân viên).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_is_portal BOOLEAN := COALESCE(
    (NEW.raw_user_meta_data->>'is_portal_user')::boolean,
    false
  );
  v_status TEXT := CASE WHEN v_is_portal THEN 'active' ELSE 'pending_approval' END;
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url, status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    v_status
  );
  RETURN NEW;
END;
$function$;

COMMIT;
