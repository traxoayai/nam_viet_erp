-- Gmail Push (Pub/Sub) tracking keys
-- Luu tru historyId va watch expiry cho Edge Function gmail-push-receiver
-- 2026-04-12

BEGIN;

-- log_system_action() version cũ dùng NEW.id sẽ crash trên system_settings (key-based).
-- Migration kế tiếp (20260412200001) fix function và re-enable trigger.
ALTER TABLE public.system_settings DISABLE TRIGGER trg_log_system_settings;

INSERT INTO public.system_settings (key, value)
VALUES
  ('gmail_push_last_history_id', '"0"'::jsonb),
  ('gmail_push_watch_expiry', '"0"'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMIT;
