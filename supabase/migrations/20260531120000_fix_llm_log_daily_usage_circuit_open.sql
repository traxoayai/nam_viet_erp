-- Fix Critical #4: llm_log_daily_usage view lumps 'circuit_open' và 'tool_use_failed' vào bucket 'error'.
-- Date: 2026-05-31
--
-- Vấn đề: View cũ chỉ tách 'success' và 'rate_limit', còn lại (bao gồm 'circuit_open' khi
-- breaker mở và 'tool_use_failed' khi LLM gọi tool sai schema) đều bị gộp vào 'error'.
-- Dashboard chat_staff không phân biệt được nguyên nhân thật → khó debug provider nào fail.
--
-- Fix:
--   1. Update docstring trên cột status để liệt kê đầy đủ enum hợp lệ
--      (không add CHECK constraint vì legacy data có thể chứa giá trị khác).
--   2. CREATE OR REPLACE FUNCTION llm_log_daily_usage thêm 2 cột:
--        - circuit_open       (COUNT FILTER status = 'circuit_open')
--        - tool_use_failed    (COUNT FILTER status = 'tool_use_failed')
--      Cột 'error' bây giờ chỉ đếm status NOT IN ('success','rate_limit','circuit_open','tool_use_failed').
--   3. Giữ nguyên SECURITY DEFINER, search_path, RLS guard `is_chat_staff()`.

BEGIN;

-- 1. Cập nhật docstring cho cột status (không add CHECK constraint vì legacy rows).
COMMENT ON COLUMN public.llm_request_log.status IS
  'Trạng thái attempt LLM. Enum hợp lệ: ''success'' | ''rate_limit'' | ''circuit_open'' | ''tool_use_failed'' | ''error''. Không có CHECK constraint để tương thích legacy data.';

-- 2. Drop old function trước rồi tạo lại — vì RETURNS TABLE đổi signature
--    (thêm 2 cột mới + đổi total_tokens_in/out -> total_latency_ms),
--    Postgres không cho phép CREATE OR REPLACE thay đổi return type.
DROP FUNCTION IF EXISTS public.llm_log_daily_usage(date);

CREATE FUNCTION public.llm_log_daily_usage(p_day date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  provider text,
  success integer,
  rate_limit integer,
  circuit_open integer,
  tool_use_failed integer,
  error integer,
  total_latency_ms bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    provider,
    COUNT(*) FILTER (WHERE status = 'success')::int AS success,
    COUNT(*) FILTER (WHERE status = 'rate_limit')::int AS rate_limit,
    COUNT(*) FILTER (WHERE status = 'circuit_open')::int AS circuit_open,
    COUNT(*) FILTER (WHERE status = 'tool_use_failed')::int AS tool_use_failed,
    COUNT(*) FILTER (
      WHERE status NOT IN ('success', 'rate_limit', 'circuit_open', 'tool_use_failed')
    )::int AS error,
    COALESCE(SUM(latency_ms), 0)::bigint AS total_latency_ms
  FROM public.llm_request_log
  WHERE public.is_chat_staff()
    AND created_at::date = p_day
  GROUP BY provider
  ORDER BY provider;
$$;

REVOKE EXECUTE ON FUNCTION public.llm_log_daily_usage(date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.llm_log_daily_usage(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.llm_log_daily_usage(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.llm_log_daily_usage(date) TO service_role;

COMMIT;
