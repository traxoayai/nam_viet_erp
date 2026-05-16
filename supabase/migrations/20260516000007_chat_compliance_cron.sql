-- 20260516000007_chat_compliance_cron.sql
-- Plan 2 Task 17: RPC audit_chat_messages_daily + pg_cron job.
-- Date: 2026-05-16
--
-- Mục đích:
--   - RPC SECURITY DEFINER quét sample tin role='bot' trong 1 ngày cụ thể,
--     chạy public.detect_medical_advice() lên content, INSERT vào
--     chat_compliance_audits cho các tin matched. Idempotent qua UNIQUE
--     (message_id, rule_code).
--   - Schedule job pg_cron 'audit_chat_daily' chạy 02:00 mỗi ngày
--     (audit ngày hôm trước).
--
-- pg_cron available trên Supabase local (v1.6.4). Phần cron.schedule được
-- wrap trong DO block để không crash nếu môi trường thiếu extension.

BEGIN;

CREATE OR REPLACE FUNCTION public.audit_chat_messages_daily(
  p_for_day date DEFAULT (now() - interval '1 day')::date,
  p_sample_size int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_inserted int := 0;
  v_total_scanned int := 0;
BEGIN
  WITH sample AS (
    SELECT m.id, m.session_id, m.content
    FROM public.chat_messages m
    WHERE m.role = 'bot'
      AND m.created_at::date = p_for_day
      AND m.deleted_at IS NULL
      AND m.content IS NOT NULL
    ORDER BY random()
    LIMIT GREATEST(COALESCE(p_sample_size, 50), 1)
  ),
  audited AS (
    SELECT
      s.id AS message_id,
      s.session_id,
      public.detect_medical_advice(s.content) AS result,
      s.content
    FROM sample s
  ),
  ins AS (
    INSERT INTO public.chat_compliance_audits (
      message_id, session_id, rule_code, severity, matched_keywords, excerpt
    )
    SELECT
      a.message_id,
      a.session_id,
      'R-04',
      a.result->>'severity',
      ARRAY(SELECT jsonb_array_elements_text(a.result->'matches')),
      LEFT(a.content, 240)
    FROM audited a
    WHERE (a.result->>'matched')::boolean = true
    ON CONFLICT (message_id, rule_code) DO NOTHING
    RETURNING 1
  ),
  counts AS (
    SELECT
      (SELECT COUNT(*)::int FROM ins) AS inserted_count,
      (SELECT COUNT(*)::int FROM sample) AS sample_count
  )
  SELECT inserted_count, sample_count
    INTO v_inserted, v_total_scanned
  FROM counts;

  RETURN jsonb_build_object(
    'day', p_for_day,
    'scanned', v_total_scanned,
    'flagged', v_inserted
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_chat_messages_daily(date, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_chat_messages_daily(date, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.audit_chat_messages_daily(date, int) TO service_role;

COMMENT ON FUNCTION public.audit_chat_messages_daily(date, int) IS
  'Plan 2 Task 17: batch audit chat bot messages bằng detect_medical_advice; chạy nightly qua pg_cron.';

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
  WHERE jobname = 'audit_chat_daily';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  -- Tạo job mới: 02:00 mỗi ngày, audit data của ngày hôm trước
  PERFORM cron.schedule(
    'audit_chat_daily',
    '0 2 * * *',
    $job$SELECT public.audit_chat_messages_daily();$job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule failed: %', SQLERRM;
END
$cron$;

COMMIT;
