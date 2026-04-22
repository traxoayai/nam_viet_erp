-- =============================================================================
-- Migration: handle_new_user SKIP insert public.users cho Portal users
-- Date: 2026-04-21
--
-- Bug PROD:
-- Register Portal trên PROD fail 100% với "Database error creating new user"
-- (auth.admin.createUser trả 500). Chạy smoke test 3 biến thể đều fail:
--   - is_portal_user=true  → fail
--   - is_portal_user=false → fail
--   - no metadata          → fail
--
-- Nghi phạm:
-- Chain trigger lồng nhau khi INSERT auth.users:
--   1. on_auth_user_created → handle_new_user() INSERT public.users (status='active')
--   2. on_user_status_change → sync_user_status_to_auth() UPDATE auth.users.banned_until
-- UPDATE auth.users trong cùng transaction mà auth.users INSERT chưa commit +
-- GoTrue đang giữ lock → race / constraint check fail.
--
-- Fix:
-- Portal users KHÔNG cần row public.users (quản lý qua bảng portal_users riêng).
-- Bỏ hoàn toàn INSERT cho portal → không trigger sync_user_status_to_auth →
-- không UPDATE auth.users nested → auth.admin.createUser hoàn tất an toàn.
--
-- An toàn:
-- - ERP employee flow (is_portal_user=false hoặc metadata rỗng) VẪN INSERT
--   public.users như cũ với status='pending_approval' — không breaking change.
-- - Portal flow (is_portal_user=true) chỉ return NEW, không ảnh hưởng
--   registration_requests / portal_users (do BE tự INSERT sau).
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
BEGIN
  -- Portal users không cần row public.users → skip để tránh nested trigger chain
  -- với sync_user_status_to_auth (gây fail "Database error creating new user").
  IF v_is_portal THEN
    RETURN NEW;
  END IF;

  -- ERP employees: giữ nguyên hành vi cũ.
  INSERT INTO public.users (id, email, full_name, avatar_url, status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    'pending_approval'
  );
  RETURN NEW;
END;
$function$;

COMMIT;
