-- Gap A3: RPC get_chat_session_old_summary — hỗ trợ summarize lịch sử dài cho chatbot.
-- Date: 2026-05-18
-- Cách dùng từ route: load 30 message gần nhất; nếu session có >30 messages tổng,
-- gọi RPC này để biết has_old + cached_summary; nếu chưa có summary cached caller
-- gọi LLM router (Cerebras small) compress 30+ old messages → save vào context.summary
-- → prepend như system message vào history khi gọi LLM tiếp theo.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_chat_session_old_summary(
  p_session_id uuid,
  p_keep_recent int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_total int;
  v_summary text;
  v_user_id uuid;
BEGIN
  -- Verify quyền: phải là owner session hoặc chat_staff.
  SELECT user_id INTO v_user_id
  FROM public.chat_sessions
  WHERE id = p_session_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('has_old', false);
  END IF;

  IF v_user_id <> auth.uid() AND NOT public.is_chat_staff() THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.chat_messages
  WHERE session_id = p_session_id
    AND deleted_at IS NULL;

  IF v_total <= p_keep_recent THEN
    RETURN jsonb_build_object('has_old', false, 'total', v_total);
  END IF;

  -- Đọc context.summary nếu có (cached). Caller có trách nhiệm refresh khi cũ.
  SELECT context->>'summary'
    INTO v_summary
  FROM public.chat_sessions
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'has_old', true,
    'total', v_total,
    'old_count', v_total - p_keep_recent,
    'cached_summary', v_summary  -- nullable; null → caller phải gọi LLM compress
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_chat_session_old_summary(uuid, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_chat_session_old_summary(uuid, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_chat_session_old_summary(uuid, int)
  TO authenticated, service_role;

COMMIT;
