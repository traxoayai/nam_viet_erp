-- Chat tables Phase 1 MVP — chat_sessions, chat_messages, chat_handoffs
-- Date: 2026-05-15
-- Note: KHÔNG có FK draft_cart_id → carts vì repo này chưa có bảng `carts`
-- (giỏ hàng portal lưu ở `portal_cart_items`). Để là uuid thuần cho Phase 1,
-- promotion thành FK khi schema cart unify sau này.

BEGIN;

-- Helper RPC để test/admin có thể introspect columns không qua information_schema RLS.
CREATE OR REPLACE FUNCTION public.get_columns(table_name text)
RETURNS TABLE(column_name text, data_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT c.column_name::text, c.data_type::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = get_columns.table_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_columns(text) TO authenticated, anon, service_role;

-- =====================================================================
-- chat_sessions: 1 phiên chat per (user, platform), có thể có nhiều phiên/user.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'bot'
    CHECK (status IN ('bot', 'handoff_pending', 'human', 'closed')),
  assigned_sales_id uuid REFERENCES auth.users(id),
  draft_cart_id uuid, -- không FK; sẽ link logic ở app layer
  platform text NOT NULL DEFAULT 'web'
    CHECK (platform IN ('web', 'zalo', 'fb')),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_idx
  ON public.chat_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS chat_sessions_status_idx
  ON public.chat_sessions (status)
  WHERE status IN ('handoff_pending', 'human');

COMMENT ON TABLE public.chat_sessions IS
  'Phiên chat Phase 1 MVP — 1 user có thể có nhiều phiên (mỗi platform 1 phiên active).';

-- =====================================================================
-- chat_messages: tin nhắn từ user/bot/sales/system trong 1 phiên.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL
    CHECK (role IN ('user', 'bot', 'sales', 'system')),
  content_type text NOT NULL
    CHECK (content_type IN ('text', 'image', 'card', 'postback')),
  content text,
  attachments jsonb,
  llm_meta jsonb,
  intent text,
  entities jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_session_idx
  ON public.chat_messages (session_id, created_at)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.chat_messages IS
  'Tin nhắn trong phiên chat — soft delete qua deleted_at để audit.';

-- =====================================================================
-- chat_handoffs: yêu cầu handoff bot → human (nhân viên sales).
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.chat_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS chat_handoffs_unresolved_idx
  ON public.chat_handoffs (created_at DESC)
  WHERE resolved_at IS NULL;

COMMENT ON TABLE public.chat_handoffs IS
  'Yêu cầu chuyển phiên chat từ bot sang sales — resolved_at NULL = chờ xử lý.';

COMMIT;
