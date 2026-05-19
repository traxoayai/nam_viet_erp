-- 20260518000007_chat_feedback_loop_cron.sql
-- C7 — Feedback loop weekly analysis (cluster wrong_answer keywords)
-- Date: 2026-05-18
--
-- Mục đích:
--   - Tạo bảng chat_feedback_weekly_clusters để lưu cụm keyword frequent từ
--     phản hồi 'wrong_answer' trong tuần — phục vụ training data + retro với sales.
--   - Function analyze_chat_feedback_weekly() đọc feedback type='wrong_answer'
--     trong 7 ngày, JOIN với chat_messages để lấy user message gốc (tin user
--     gần nhất TRƯỚC tin bot bị flag), tokenize tiếng Việt naive, loại
--     stopwords, lấy top keyword (length >= 4) → INSERT vào clusters.
--   - Schedule pg_cron 'feedback_loop_weekly' chạy 04:00 sáng thứ 2 hàng tuần.
--
-- pg_cron available trên Supabase local (v1.6.4). Phần cron.schedule được
-- wrap trong DO block để không crash nếu môi trường thiếu extension.

BEGIN;

-- =====================================================================
-- Table: chat_feedback_weekly_clusters
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.chat_feedback_weekly_clusters (
  id bigserial PRIMARY KEY,
  week_start date NOT NULL,
  pattern_keyword text NOT NULL,
  sample_message_ids uuid[] NOT NULL,
  feedback_count int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_feedback_weekly_clusters_week_idx
  ON public.chat_feedback_weekly_clusters (week_start DESC, feedback_count DESC);

ALTER TABLE public.chat_feedback_weekly_clusters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages clusters" ON public.chat_feedback_weekly_clusters;
CREATE POLICY "Service role manages clusters" ON public.chat_feedback_weekly_clusters
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE public.chat_feedback_weekly_clusters IS
  'C7 feedback loop: cụm keyword frequent từ wrong_answer feedback theo tuần.';

-- =====================================================================
-- Function: analyze_chat_feedback_weekly
-- =====================================================================
CREATE OR REPLACE FUNCTION public.analyze_chat_feedback_weekly(
  p_week_start date DEFAULT (now() - interval '7 days')::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_week_end date := p_week_start + interval '7 days';
  v_feedback_count int := 0;
  v_clusters_inserted int := 0;
  v_top_keywords_limit int := 20;
  v_stopwords text[] := ARRAY[
    'em','anh','chị','tôi','cho','của','là','và','có','không',
    'được','xin','giúp','vui','lòng'
  ];
BEGIN
  -- Đếm feedback trong khoảng tuần để báo cáo
  SELECT COUNT(*)::int INTO v_feedback_count
  FROM public.chat_feedback f
  WHERE f.feedback_type = 'wrong_answer'
    AND f.created_at >= p_week_start
    AND f.created_at <  v_week_end;

  IF v_feedback_count = 0 THEN
    RETURN jsonb_build_object(
      'week_start',         p_week_start,
      'week_end',           v_week_end,
      'feedback_scanned',   0,
      'clusters_inserted',  0,
      'note',               'No wrong_answer feedback in window'
    );
  END IF;

  -- Bước 1: với mỗi feedback wrong_answer, lấy tin user gần nhất TRƯỚC
  --         tin bot bị flag (cùng session, role='user', created_at <= bot's).
  -- Bước 2: tokenize content (lowercase, tách non-word), lọc stopword + length>=4.
  -- Bước 3: aggregate theo keyword → INSERT top N vào clusters.
  WITH feedback_window AS (
    SELECT
      f.id            AS feedback_id,
      f.message_id    AS bot_message_id,
      m.session_id    AS session_id,
      m.created_at    AS bot_created_at
    FROM public.chat_feedback f
    JOIN public.chat_messages m ON m.id = f.message_id
    WHERE f.feedback_type = 'wrong_answer'
      AND f.created_at >= p_week_start
      AND f.created_at <  v_week_end
  ),
  user_prompts AS (
    SELECT DISTINCT ON (fw.feedback_id)
      fw.feedback_id,
      fw.bot_message_id,
      um.id      AS user_message_id,
      um.content AS user_content
    FROM feedback_window fw
    JOIN public.chat_messages um
      ON um.session_id = fw.session_id
     AND um.role = 'user'
     AND um.deleted_at IS NULL
     AND um.created_at <= fw.bot_created_at
     AND um.content IS NOT NULL
    ORDER BY fw.feedback_id, um.created_at DESC
  ),
  tokens AS (
    SELECT
      up.user_message_id,
      lower(trim(t.token)) AS token
    FROM user_prompts up
    CROSS JOIN LATERAL regexp_split_to_table(
      lower(coalesce(up.user_content, '')),
      '[^[:alnum:]]+'
    ) AS t(token)
  ),
  filtered AS (
    SELECT
      t.user_message_id,
      t.token
    FROM tokens t
    WHERE t.token IS NOT NULL
      AND length(t.token) >= 4
      AND NOT (t.token = ANY(v_stopwords))
  ),
  keyword_agg AS (
    SELECT
      f.token                                            AS pattern_keyword,
      COUNT(DISTINCT f.user_message_id)::int             AS feedback_count,
      (ARRAY_AGG(DISTINCT f.user_message_id))[1:5]       AS sample_ids
    FROM filtered f
    GROUP BY f.token
    HAVING COUNT(DISTINCT f.user_message_id) >= 1
    ORDER BY COUNT(DISTINCT f.user_message_id) DESC
    LIMIT v_top_keywords_limit
  ),
  ins AS (
    INSERT INTO public.chat_feedback_weekly_clusters (
      week_start, pattern_keyword, sample_message_ids, feedback_count
    )
    SELECT
      p_week_start,
      ka.pattern_keyword,
      ka.sample_ids,
      ka.feedback_count
    FROM keyword_agg ka
    RETURNING 1
  )
  SELECT COUNT(*)::int INTO v_clusters_inserted FROM ins;

  RETURN jsonb_build_object(
    'week_start',         p_week_start,
    'week_end',           v_week_end,
    'feedback_scanned',   v_feedback_count,
    'clusters_inserted',  v_clusters_inserted
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.analyze_chat_feedback_weekly(date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.analyze_chat_feedback_weekly(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.analyze_chat_feedback_weekly(date) TO service_role;

COMMENT ON FUNCTION public.analyze_chat_feedback_weekly(date) IS
  'C7 feedback loop: phân tích wrong_answer feedback 7 ngày → cluster keyword frequent. Chạy weekly qua pg_cron.';

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
  WHERE jobname = 'feedback_loop_weekly';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  -- Tạo job mới: 04:00 sáng thứ 2 hàng tuần, analyze tuần vừa qua
  PERFORM cron.schedule(
    'feedback_loop_weekly',
    '0 4 * * 1',
    $job$SELECT public.analyze_chat_feedback_weekly();$job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule failed: %', SQLERRM;
END
$cron$;

COMMIT;
