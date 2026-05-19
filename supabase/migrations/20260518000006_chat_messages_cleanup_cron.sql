-- 20260518000006_chat_messages_cleanup_cron.sql
-- G1 — Cleanup chat_messages 12 tháng (R-07 SRS F-002)
-- Date: 2026-05-18
--
-- Mục đích:
--   - Function SECURITY DEFINER soft-delete (set deleted_at = now()) các tin nhắn
--     trong chat_messages có created_at < now() - interval '365 days' và
--     deleted_at IS NULL. Compliance với SRS F-002 (data retention 12 tháng).
--   - Schedule job pg_cron 'cleanup_chat_messages_daily' chạy 03:00 hàng ngày
--     (sau audit nightly 02:00 để tránh race condition).
--
-- pg_cron available trên Supabase local (v1.6.4). Phần cron.schedule được
-- wrap trong DO block để không crash nếu môi trường thiếu extension.

BEGIN;

CREATE OR REPLACE FUNCTION public.cleanup_old_chat_messages()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_cutoff timestamptz := now() - interval '365 days';
  v_deleted_count int := 0;
BEGIN
  WITH updated AS (
    UPDATE public.chat_messages
       SET deleted_at = now()
     WHERE created_at < v_cutoff
       AND deleted_at IS NULL
    RETURNING 1
  )
  SELECT COUNT(*)::int INTO v_deleted_count FROM updated;

  RETURN jsonb_build_object(
    'deleted_count', v_deleted_count,
    'cutoff_date',   v_cutoff::text
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_chat_messages() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_chat_messages() FROM anon;
GRANT EXECUTE ON FUNCTION public.cleanup_old_chat_messages() TO service_role;

COMMENT ON FUNCTION public.cleanup_old_chat_messages() IS
  'G1 / R-07 SRS F-002: soft-delete chat_messages cũ hơn 365 ngày. Chạy nightly qua pg_cron.';

-- =====================================================================
-- pg_cron schedule (wrap trong DO để safe khi extension không có sẵn)
-- =====================================================================
DO $cron$
DECLARE
  v_jobid bigint;
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension không khả dụng (%). Bỏ qua schedule.', SQLERRM;
    RETURN;
  END;

  -- Unschedule job cũ nếu đã tồn tại (idempotent)
  SELECT jobid INTO v_jobid
  FROM cron.job
  WHERE jobname = 'cleanup_chat_messages_daily';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  -- Tạo job mới: 03:00 mỗi ngày, soft-delete tin nhắn > 365 ngày
  PERFORM cron.schedule(
    'cleanup_chat_messages_daily',
    '0 3 * * *',
    $job$SELECT public.cleanup_old_chat_messages();$job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule failed: %', SQLERRM;
END
$cron$;

COMMIT;
