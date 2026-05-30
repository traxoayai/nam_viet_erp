-- 20260516000003_inbox_rpcs.sql
-- Plan 2 Task 4: 5 RPC backend cho Sales Inbox.
-- Date: 2026-05-16
--
-- RPC list:
--  1. list_inbox_sessions(p_tab, p_limit) — join portal_users (display_name, phone)
--  2. assign_chat_session_to_self(p_session_id) — claim phiên, mark handoff resolved
--  3. send_sales_reply(p_session_id, p_content) — insert tin role='sales'
--  4. close_chat_session(p_session_id) — đóng phiên + insert system message
--  5. return_chat_session_to_bot(p_session_id) — trả về bot, clear assigned
--
-- Tất cả SECURITY DEFINER, REVOKE PUBLIC + anon, GRANT authenticated.
-- Validate `is_chat_staff()` ở đầu function → raise 42501 nếu không phải staff.
-- Schema verified live: portal_users dùng cột `display_name` + `phone`
-- (KHÔNG có cột full_name).

BEGIN;

-- =====================================================================
-- 1. list_inbox_sessions
-- =====================================================================
CREATE OR REPLACE FUNCTION public.list_inbox_sessions(
  p_tab text,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  status text,
  assigned_sales_id uuid,
  draft_cart_id uuid,
  platform text,
  context jsonb,
  started_at timestamptz,
  last_activity_at timestamptz,
  closed_at timestamptz,
  customer_name text,
  customer_phone text,
  unresolved_handoff_reason text,
  last_message_preview text,
  last_message_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_status text;
  v_limit integer;
BEGIN
  IF NOT public.is_chat_staff() THEN
    RAISE EXCEPTION 'Không có quyền truy cập inbox' USING ERRCODE = '42501';
  END IF;

  v_status := CASE p_tab
    WHEN 'pending' THEN 'handoff_pending'
    WHEN 'active'  THEN 'human'
    WHEN 'closed'  THEN 'closed'
    ELSE NULL
  END;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'p_tab phải là pending | active | closed' USING ERRCODE = '22023';
  END IF;

  v_limit := COALESCE(p_limit, 50);
  IF v_limit <= 0 OR v_limit > 500 THEN
    v_limit := 50;
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.status,
    s.assigned_sales_id,
    s.draft_cart_id,
    s.platform,
    s.context,
    s.started_at,
    s.last_activity_at,
    s.closed_at,
    pu.display_name AS customer_name,
    pu.phone        AS customer_phone,
    (
      SELECT h.reason
      FROM public.chat_handoffs h
      WHERE h.session_id = s.id
        AND h.resolved_at IS NULL
      ORDER BY h.created_at DESC
      LIMIT 1
    ) AS unresolved_handoff_reason,
    (
      SELECT m.content
      FROM public.chat_messages m
      WHERE m.session_id = s.id
        AND m.deleted_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT 1
    ) AS last_message_preview,
    COALESCE(
      (
        SELECT m.created_at
        FROM public.chat_messages m
        WHERE m.session_id = s.id
          AND m.deleted_at IS NULL
        ORDER BY m.created_at DESC
        LIMIT 1
      ),
      s.last_activity_at
    ) AS last_message_at
  FROM public.chat_sessions s
  LEFT JOIN public.portal_users pu ON pu.auth_user_id = s.user_id
  WHERE s.status = v_status
  ORDER BY s.last_activity_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_inbox_sessions(text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_inbox_sessions(text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_inbox_sessions(text, integer)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.list_inbox_sessions(text, integer) IS
  'Sales Inbox: liệt kê phiên theo tab pending/active/closed, kèm customer + last message.';

-- =====================================================================
-- 2. assign_chat_session_to_self
-- =====================================================================
CREATE OR REPLACE FUNCTION public.assign_chat_session_to_self(
  p_session_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_chat_staff() THEN
    RAISE EXCEPTION 'Không có quyền nhận phiên' USING ERRCODE = '42501';
  END IF;

  UPDATE public.chat_sessions
     SET assigned_sales_id = v_uid,
         status            = 'human',
         last_activity_at  = now()
   WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy phiên chat' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.chat_handoffs
     SET resolved_at = now()
   WHERE session_id  = p_session_id
     AND resolved_at IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_chat_session_to_self(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_chat_session_to_self(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_chat_session_to_self(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.assign_chat_session_to_self(uuid) IS
  'Sales claim phiên: set assigned_sales_id=auth.uid(), status=human, resolve handoff.';

-- =====================================================================
-- 3. send_sales_reply
-- =====================================================================
CREATE OR REPLACE FUNCTION public.send_sales_reply(
  p_session_id uuid,
  p_content text
)
RETURNS public.chat_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_msg public.chat_messages;
  v_content text := btrim(COALESCE(p_content, ''));
BEGIN
  IF NOT public.is_chat_staff() THEN
    RAISE EXCEPTION 'Không có quyền gửi tin sales' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_content) = 0 THEN
    RAISE EXCEPTION 'Nội dung tin nhắn không được để trống' USING ERRCODE = '22023';
  END IF;

  -- Đảm bảo phiên tồn tại để FK insert không lỗi mơ hồ
  PERFORM 1 FROM public.chat_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy phiên chat' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.chat_messages (session_id, role, content_type, content)
  VALUES (p_session_id, 'sales', 'text', v_content)
  RETURNING * INTO v_msg;

  UPDATE public.chat_sessions
     SET last_activity_at = now()
   WHERE id = p_session_id;

  RETURN v_msg;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_sales_reply(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_sales_reply(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.send_sales_reply(uuid, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.send_sales_reply(uuid, text) IS
  'Sales gửi tin reply (role=sales, content_type=text). Validate content trim length > 0.';

-- =====================================================================
-- 4. close_chat_session
-- =====================================================================
CREATE OR REPLACE FUNCTION public.close_chat_session(
  p_session_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.is_chat_staff() THEN
    RAISE EXCEPTION 'Không có quyền đóng phiên' USING ERRCODE = '42501';
  END IF;

  UPDATE public.chat_sessions
     SET status           = 'closed',
         closed_at        = now(),
         last_activity_at = now()
   WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy phiên chat' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.chat_messages (session_id, role, content_type, content)
  VALUES (
    p_session_id,
    'system',
    'text',
    'Phiên đã được đóng. Cảm ơn anh chị.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.close_chat_session(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_chat_session(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.close_chat_session(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.close_chat_session(uuid) IS
  'Đóng phiên chat + insert system message "Phiên đã được đóng. Cảm ơn anh chị."';

-- =====================================================================
-- 5. return_chat_session_to_bot
-- =====================================================================
CREATE OR REPLACE FUNCTION public.return_chat_session_to_bot(
  p_session_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_current_status text;
BEGIN
  IF NOT public.is_chat_staff() THEN
    RAISE EXCEPTION 'Không có quyền trả phiên về bot' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_current_status
  FROM public.chat_sessions
  WHERE id = p_session_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy phiên chat' USING ERRCODE = 'P0002';
  END IF;

  IF v_current_status NOT IN ('human', 'handoff_pending') THEN
    RAISE EXCEPTION 'Chỉ trả về bot từ trạng thái human hoặc handoff_pending'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.chat_sessions
     SET status            = 'bot',
         assigned_sales_id = NULL,
         last_activity_at  = now()
   WHERE id = p_session_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.return_chat_session_to_bot(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.return_chat_session_to_bot(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.return_chat_session_to_bot(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.return_chat_session_to_bot(uuid) IS
  'Trả phiên về bot (clear assigned_sales_id). Chỉ khi đang ở human/handoff_pending.';

COMMIT;
