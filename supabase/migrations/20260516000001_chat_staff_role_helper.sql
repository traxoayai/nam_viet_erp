-- Helper kiểm tra user hiện tại là sales/admin chatbot.
-- Date: 2026-05-16
-- Lý do: Plan 1 dùng auth.jwt() ->> 'role' nhưng Supabase Auth không tự gắn claim 'role'.
-- Thay bằng SECURITY DEFINER function đọc role_permissions (RBAC hiện tại).

BEGIN;

CREATE OR REPLACE FUNCTION public.is_chat_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND rp.permission_key IN ('crm.chatbot.handle', 'crm.chatbot.admin')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_chat_staff() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_chat_staff() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_chat_staff() TO authenticated, service_role;

-- =====================================================================
-- Cập nhật RLS Plan 1: thay auth.jwt() ->> 'role' bằng is_chat_staff()
-- =====================================================================

-- chat_sessions: sales/admin thấy session đã handoff hoặc đang human/closed
DROP POLICY IF EXISTS chat_sessions_internal ON public.chat_sessions;
CREATE POLICY chat_sessions_internal ON public.chat_sessions FOR SELECT
  USING (
    public.is_chat_staff()
    AND status IN ('handoff_pending', 'human', 'closed')
  );

-- chat_sessions: sales/admin update (assign, close)
DROP POLICY IF EXISTS chat_sessions_update_sales ON public.chat_sessions;
CREATE POLICY chat_sessions_update_sales ON public.chat_sessions FOR UPDATE
  USING (public.is_chat_staff())
  WITH CHECK (public.is_chat_staff());

-- chat_messages: SELECT — owner session hoặc staff; loại bỏ soft-deleted
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
      OR public.is_chat_staff()
    )
  );

-- chat_messages: INSERT sales/admin — chỉ role IN ('sales','bot','system')
DROP POLICY IF EXISTS chat_messages_insert_sales ON public.chat_messages;
CREATE POLICY chat_messages_insert_sales ON public.chat_messages FOR INSERT
  WITH CHECK (
    public.is_chat_staff()
    AND role IN ('sales', 'bot', 'system')
  );

-- chat_messages: UPDATE — owner hoặc staff
DROP POLICY IF EXISTS chat_messages_update_own ON public.chat_messages;
CREATE POLICY chat_messages_update_own ON public.chat_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = chat_messages.session_id
        AND s.user_id = auth.uid()
    )
    OR public.is_chat_staff()
  );

-- chat_handoffs: internal only
DROP POLICY IF EXISTS chat_handoffs_internal ON public.chat_handoffs;
CREATE POLICY chat_handoffs_internal ON public.chat_handoffs FOR ALL
  USING (public.is_chat_staff())
  WITH CHECK (public.is_chat_staff());

-- =====================================================================
-- Seed permission keys vào bảng permissions (columns: key, name, module)
-- KHÔNG có cột label — schema thực tế dùng 'name'.
-- =====================================================================
INSERT INTO public.permissions (key, name, module)
VALUES
  ('crm.chatbot.handle', 'Xử lý handoff chatbot', 'CRM'),
  ('crm.chatbot.admin', 'Admin chatbot (analytics, audit)', 'CRM'),
  ('crm.chatbot.view_analytics', 'Xem báo cáo chatbot', 'CRM'),
  ('crm.chatbot.audit', 'Audit compliance chatbot', 'CRM')
ON CONFLICT (key) DO NOTHING;

COMMIT;
