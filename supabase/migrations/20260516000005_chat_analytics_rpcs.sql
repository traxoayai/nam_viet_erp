-- 20260516000005_chat_analytics_rpcs.sql
-- Plan 2 Task 10: 4 RPC analytics cho Chatbot Dashboard.
-- Date: 2026-05-16
--
-- RPC list:
--   1. chat_stats_overview(p_from, p_to, p_platform)
--        → jsonb: total_sessions, orders_via_bot, handoff_rate, ai_cost_usd
--   2. chat_sessions_per_day(p_from, p_to, p_platform)
--        → TABLE(day, sessions, orders) — 1 row/day với generate_series fill 0.
--   3. chat_top_intents(p_from, p_to, p_limit)
--        → TABLE(intent, count) — top intent của tin role='user'.
--   4. chat_unmatched_questions(p_from, p_to, p_limit)
--        → TABLE(question, occurred_at, session_id) — câu hỏi intent='unknown'/NULL.
--
-- Tất cả SECURITY DEFINER, STABLE, REVOKE PUBLIC + anon, GRANT authenticated.
-- Gate quyền qua public.is_chat_staff() — non-staff luôn nhận empty/zero
-- (không RAISE để dashboard không vỡ khi user vô tình hết quyền giữa session).
--
-- IMPORTANT — Schema reality:
--   `orders` KHÔNG có cột `source`. Plan gốc dùng o.source='chatbot' không
--   khả thi. Cũng KHÔNG có FK/cột nào nối orders ↔ chat_sessions ở DB layer
--   (draft_cart_id là logical link app-side). Vì vậy:
--     - orders_via_bot và orders/day đếm TẤT CẢ orders trong khoảng → bao
--       gồm cả đơn không qua chatbot. Có ghi note 'orders_note' trong
--       jsonb của overview để dashboard hiển thị disclaimer.
--   Khi schema có cột source/ref về session → cập nhật bằng migration sau.

BEGIN;

-- =====================================================================
-- 1. chat_stats_overview
-- =====================================================================
CREATE OR REPLACE FUNCTION public.chat_stats_overview(
  p_from date,
  p_to   date,
  p_platform text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  WITH sessions_filter AS (
    SELECT s.id,
           s.status,
           s.assigned_sales_id
    FROM public.chat_sessions s
    WHERE public.is_chat_staff()
      AND s.started_at::date BETWEEN p_from AND p_to
      AND (p_platform IS NULL OR s.platform = p_platform)
  ),
  orders_filter AS (
    SELECT o.id
    FROM public.orders o
    WHERE public.is_chat_staff()
      AND o.created_at::date BETWEEN p_from AND p_to
  )
  SELECT jsonb_build_object(
    'total_sessions',  (SELECT COUNT(*)::int FROM sessions_filter),
    'orders_via_bot',  (SELECT COUNT(DISTINCT id)::int FROM orders_filter),
    'handoff_rate',
      (
        SELECT CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND(
            100.0 * COUNT(*) FILTER (
              WHERE status IN ('handoff_pending', 'human', 'closed')
                AND assigned_sales_id IS NOT NULL
            ) / COUNT(*),
            1
          )
        END
        FROM sessions_filter
      ),
    'ai_cost_usd', 0,
    'orders_note',
      'orders_via_bot counts all orders in range (orders table has no source/session link).'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.chat_stats_overview(date, date, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.chat_stats_overview(date, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.chat_stats_overview(date, date, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.chat_stats_overview(date, date, text) IS
  'Chatbot analytics: 4 KPI tổng quan (sessions, orders, handoff_rate, ai_cost).';

-- =====================================================================
-- 2. chat_sessions_per_day
-- =====================================================================
CREATE OR REPLACE FUNCTION public.chat_sessions_per_day(
  p_from date,
  p_to   date,
  p_platform text DEFAULT NULL
)
RETURNS TABLE (day date, sessions int, orders int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  WITH d AS (
    SELECT generate_series(p_from, p_to, '1 day'::interval)::date AS day
  ),
  s AS (
    SELECT cs.started_at::date AS day,
           COUNT(*)::int       AS cnt
    FROM public.chat_sessions cs
    WHERE public.is_chat_staff()
      AND cs.started_at::date BETWEEN p_from AND p_to
      AND (p_platform IS NULL OR cs.platform = p_platform)
    GROUP BY 1
  ),
  o AS (
    SELECT oo.created_at::date AS day,
           COUNT(*)::int       AS cnt
    FROM public.orders oo
    WHERE public.is_chat_staff()
      AND oo.created_at::date BETWEEN p_from AND p_to
    GROUP BY 1
  )
  SELECT d.day,
         COALESCE(s.cnt, 0)::int AS sessions,
         COALESCE(o.cnt, 0)::int AS orders
  FROM d
  LEFT JOIN s USING (day)
  LEFT JOIN o USING (day)
  ORDER BY d.day;
$$;

REVOKE EXECUTE ON FUNCTION public.chat_sessions_per_day(date, date, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.chat_sessions_per_day(date, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.chat_sessions_per_day(date, date, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.chat_sessions_per_day(date, date, text) IS
  'Chatbot analytics: chuỗi ngày sessions vs orders (generate_series, fill 0).';

-- =====================================================================
-- 3. chat_top_intents
-- =====================================================================
CREATE OR REPLACE FUNCTION public.chat_top_intents(
  p_from  date,
  p_to    date,
  p_limit int DEFAULT 10
)
RETURNS TABLE (intent text, count int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(m.intent, 'unknown')::text AS intent,
         COUNT(*)::int                       AS count
  FROM public.chat_messages m
  WHERE public.is_chat_staff()
    AND m.role = 'user'
    AND m.deleted_at IS NULL
    AND m.created_at::date BETWEEN p_from AND p_to
  GROUP BY 1
  ORDER BY 2 DESC, 1 ASC
  LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;

REVOKE EXECUTE ON FUNCTION public.chat_top_intents(date, date, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.chat_top_intents(date, date, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.chat_top_intents(date, date, int)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.chat_top_intents(date, date, int) IS
  'Chatbot analytics: top intent của tin role=user, intent NULL → unknown.';

-- =====================================================================
-- 4. chat_unmatched_questions
-- =====================================================================
CREATE OR REPLACE FUNCTION public.chat_unmatched_questions(
  p_from  date,
  p_to    date,
  p_limit int DEFAULT 20
)
RETURNS TABLE (question text, occurred_at timestamptz, session_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT m.content::text   AS question,
         m.created_at      AS occurred_at,
         m.session_id      AS session_id
  FROM public.chat_messages m
  WHERE public.is_chat_staff()
    AND m.role = 'user'
    AND (m.intent IS NULL OR m.intent = 'unknown')
    AND m.deleted_at IS NULL
    AND m.content IS NOT NULL
    AND btrim(m.content) <> ''
    AND m.created_at::date BETWEEN p_from AND p_to
  ORDER BY m.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
$$;

REVOKE EXECUTE ON FUNCTION public.chat_unmatched_questions(date, date, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.chat_unmatched_questions(date, date, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.chat_unmatched_questions(date, date, int)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.chat_unmatched_questions(date, date, int) IS
  'Chatbot analytics: câu hỏi user chưa match intent (NULL hoặc unknown).';

COMMIT;
