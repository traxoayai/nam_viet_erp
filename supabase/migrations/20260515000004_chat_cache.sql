-- Phase 1 Chatbot — Task 10c: chat_cache cho response cache 10 phút
-- Mục tiêu: cache reply theo (user_id, normalized query) để giảm gọi LLM.
-- Bảng nội bộ — chỉ service_role / admin được đọc/ghi (qua route handler server-side).
-- Không expose qua PostgREST cho authenticated/anon vì cache_key đã hash user_id.

BEGIN;

CREATE TABLE IF NOT EXISTS public.chat_cache (
  cache_key   text        PRIMARY KEY,
  response    jsonb       NOT NULL,
  hits        int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS chat_cache_expires_idx
  ON public.chat_cache (expires_at);

ALTER TABLE public.chat_cache ENABLE ROW LEVEL SECURITY;

-- Chỉ service_role hoặc admin (custom claim) mới được tương tác.
DROP POLICY IF EXISTS chat_cache_internal ON public.chat_cache;
CREATE POLICY chat_cache_internal ON public.chat_cache
  FOR ALL
  USING (auth.jwt() ->> 'role' IN ('service_role', 'admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('service_role', 'admin'));

COMMENT ON TABLE public.chat_cache IS
  'Response cache 10 phút cho chatbot — key = sha256(user_id|normalized_query). RLS chỉ service_role.';

COMMIT;
