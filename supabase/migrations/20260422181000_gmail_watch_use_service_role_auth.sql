-- Migration: Gmail watch cron dùng Bearer service_role thay x-gmail-push-secret
-- ============================================================================
-- BUG:
--   Sau khi fix http_post schema (20260422180000), cron gmail-watch vẫn 401.
--   Lý do: vault.GMAIL_PUSH_SECRET không đồng bộ với env var GMAIL_PUSH_SECRET
--   của Edge Function gmail-push-receiver (2 nơi lưu độc lập, giá trị khác).
--
-- FIX:
--   Edge Function chấp nhận cả x-gmail-push-secret HOẶC Authorization Bearer
--   service_role_key (source:
--   functions/gmail-push-receiver/index.ts dòng 347-352).
--   Dùng Bearer service_role → chắc chắn khớp vì lấy từ vault + Edge Function
--   runtime cùng nhận service_role_key từ Supabase infra (không mismatch).
--
-- Date: 2026-04-22
-- ============================================================================

BEGIN;

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
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := '{"action":"renew-watch"}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);

COMMIT;
