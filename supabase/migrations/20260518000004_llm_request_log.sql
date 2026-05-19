-- Gap A5: llm_request_log — log mỗi attempt LLM router để theo dõi quota daily.
-- Date: 2026-05-18
-- Mỗi message bot sinh ra có thể tạo nhiều row (fallback chain qua 4 provider).
-- View llm_log_daily_usage tổng hợp theo provider/ngày cho dashboard chat_staff.

BEGIN;

CREATE TABLE IF NOT EXISTS public.llm_request_log (
  id bigserial PRIMARY KEY,
  session_id uuid REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider text NOT NULL,
  model text,
  status text NOT NULL,  -- 'success' | 'rate_limit' | 'error' | 'tool_use_failed'
  latency_ms int,
  tokens_in int,
  tokens_out int,
  error_message text,
  attempted_providers text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS llm_request_log_session_idx
  ON public.llm_request_log (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS llm_request_log_provider_day_idx
  ON public.llm_request_log (provider, created_at);
CREATE INDEX IF NOT EXISTS llm_request_log_status_idx
  ON public.llm_request_log (status, created_at DESC)
  WHERE status <> 'success';

ALTER TABLE public.llm_request_log ENABLE ROW LEVEL SECURITY;

-- SELECT: chỉ chat_staff. Khách không cần thấy tokens/model (leak chi phí).
DROP POLICY IF EXISTS llm_log_select_staff ON public.llm_request_log;
CREATE POLICY llm_log_select_staff ON public.llm_request_log
  FOR SELECT
  USING (public.is_chat_staff());

-- INSERT: chỉ service_role (route handler dùng service key) — không qua RLS public.
-- Authenticated users không có quyền insert trực tiếp.
DROP POLICY IF EXISTS llm_log_insert_staff ON public.llm_request_log;
CREATE POLICY llm_log_insert_staff ON public.llm_request_log
  FOR INSERT
  WITH CHECK (public.is_chat_staff());

-- Không cho phép UPDATE/DELETE — log là immutable.

COMMENT ON TABLE public.llm_request_log IS
  'Log mỗi attempt gọi LLM provider (success/rate_limit/error/tool_use_failed). RLS chỉ chat_staff đọc.';

-- =====================================================================
-- View tổng quan daily usage per provider — dashboard chat_staff.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.llm_log_daily_usage(p_day date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  provider text,
  total int,
  success int,
  rate_limit int,
  error int,
  total_tokens_in bigint,
  total_tokens_out bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    provider,
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE status = 'success')::int AS success,
    COUNT(*) FILTER (WHERE status = 'rate_limit')::int AS rate_limit,
    COUNT(*) FILTER (WHERE status NOT IN ('success', 'rate_limit'))::int AS error,
    COALESCE(SUM(tokens_in), 0)::bigint AS total_tokens_in,
    COALESCE(SUM(tokens_out), 0)::bigint AS total_tokens_out
  FROM public.llm_request_log
  WHERE public.is_chat_staff()
    AND created_at::date = p_day
  GROUP BY provider
  ORDER BY provider;
$$;

REVOKE EXECUTE ON FUNCTION public.llm_log_daily_usage(date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.llm_log_daily_usage(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.llm_log_daily_usage(date)
  TO authenticated, service_role;

COMMIT;
