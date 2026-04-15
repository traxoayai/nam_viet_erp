-- =============================================================================
-- Gmail Watch Auto-Renew Cron
-- Date: 2026-04-15
-- Gmail watch subscription expires after 7 days.
-- This cron runs every 6 days to renew it via the Edge Function.
-- =============================================================================

BEGIN;

-- Cron job: renew Gmail watch every 6 days at 02:00 UTC (09:00 Vietnam)
SELECT cron.schedule(
  'renew-gmail-watch',
  '0 2 */6 * *',
  $$
  SELECT extensions.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1)
           || '/functions/v1/gmail-push-receiver',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-gmail-push-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'GMAIL_PUSH_SECRET' LIMIT 1)
    ),
    body := '{"action":"renew-watch"}'::jsonb
  );
  $$
);

COMMIT;
