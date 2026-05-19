-- Task 2: RLS policies cho chat_sessions, chat_messages, chat_handoffs
-- + củng cố security fix: revoke EXECUTE get_columns từ anon (và PUBLIC bao gồm anon)
-- Date: 2026-05-15
--
-- Note: migration 20260515000001a đã enable RLS + revoke anon từ get_columns,
-- nhưng vì statement GRANT ban đầu cấp cho PUBLIC nên anon vẫn EXECUTE được
-- qua PUBLIC role. Migration này revoke PUBLIC để chốt issue Task 1.

BEGIN;

-- =====================================================================
-- Issue Task 1 fix: revoke anon (qua PUBLIC) khỏi get_columns
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.get_columns(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_columns(text) FROM anon;
-- authenticated + service_role giữ EXECUTE (test dùng service_role,
-- Portal authenticated dùng để introspect schema).
GRANT EXECUTE ON FUNCTION public.get_columns(text) TO authenticated, service_role;

-- =====================================================================
-- Defensive: đảm bảo RLS enable (idempotent — migration 20260515000001a đã làm)
-- =====================================================================
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_handoffs ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- chat_sessions policies
-- =====================================================================
-- user thấy session của chính mình
DROP POLICY IF EXISTS chat_sessions_own ON public.chat_sessions;
CREATE POLICY chat_sessions_own ON public.chat_sessions FOR SELECT
  USING (user_id = auth.uid());

-- sales/admin thấy session đã chuyển handoff hoặc đang human
DROP POLICY IF EXISTS chat_sessions_internal ON public.chat_sessions;
CREATE POLICY chat_sessions_internal ON public.chat_sessions FOR SELECT
  USING (
    auth.jwt() ->> 'role' IN ('sales', 'admin')
    AND status IN ('handoff_pending', 'human', 'closed')
  );

-- user insert session của chính mình
DROP POLICY IF EXISTS chat_sessions_insert_own ON public.chat_sessions;
CREATE POLICY chat_sessions_insert_own ON public.chat_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- user update session của chính mình (đổi last_activity_at, status…)
DROP POLICY IF EXISTS chat_sessions_update_own ON public.chat_sessions;
CREATE POLICY chat_sessions_update_own ON public.chat_sessions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- sales/admin update session đã handoff (assign sales, close…)
DROP POLICY IF EXISTS chat_sessions_update_sales ON public.chat_sessions;
CREATE POLICY chat_sessions_update_sales ON public.chat_sessions FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('sales', 'admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('sales', 'admin'));

-- =====================================================================
-- chat_messages policies
-- =====================================================================
-- SELECT: owner session hoặc sales/admin; loại bỏ soft-deleted
DROP POLICY IF EXISTS chat_messages_select ON public.chat_messages;
CREATE POLICY chat_messages_select ON public.chat_messages FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.chat_sessions s
        WHERE s.id = chat_messages.session_id
          AND s.user_id = auth.uid()
      )
      OR auth.jwt() ->> 'role' IN ('sales', 'admin')
    )
  );

-- INSERT user: chỉ insert role='user' vào session của mình
DROP POLICY IF EXISTS chat_messages_insert_user ON public.chat_messages;
CREATE POLICY chat_messages_insert_user ON public.chat_messages FOR INSERT
  WITH CHECK (
    role = 'user'
    AND EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = chat_messages.session_id
        AND s.user_id = auth.uid()
    )
  );

-- INSERT sales/admin: chỉ role IN ('sales','bot','system')
DROP POLICY IF EXISTS chat_messages_insert_sales ON public.chat_messages;
CREATE POLICY chat_messages_insert_sales ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('sales', 'admin')
    AND role IN ('sales', 'bot', 'system')
  );

-- UPDATE: owner (soft-delete clear-history) hoặc sales/admin
DROP POLICY IF EXISTS chat_messages_update_own ON public.chat_messages;
CREATE POLICY chat_messages_update_own ON public.chat_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = chat_messages.session_id
        AND s.user_id = auth.uid()
    )
    OR auth.jwt() ->> 'role' IN ('sales', 'admin')
  );

-- =====================================================================
-- chat_handoffs policies — internal only
-- =====================================================================
DROP POLICY IF EXISTS chat_handoffs_internal ON public.chat_handoffs;
CREATE POLICY chat_handoffs_internal ON public.chat_handoffs FOR ALL
  USING (auth.jwt() ->> 'role' IN ('sales', 'admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('sales', 'admin'));

COMMIT;
