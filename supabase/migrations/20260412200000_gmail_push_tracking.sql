-- Gmail Push (Pub/Sub) tracking keys
-- Luu tru historyId va watch expiry cho Edge Function gmail-push-receiver
-- 2026-04-12

BEGIN;

INSERT INTO public.system_settings (key, value)
VALUES
  ('gmail_push_last_history_id', '"0"'::jsonb),
  ('gmail_push_watch_expiry', '"0"'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMIT;
