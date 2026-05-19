-- Gap 4 Chatbot P2.5: RPC check_pending_cart — backend session-store gọi để biết
-- có nên inject "resume cart" prompt vào tin nhắn đầu trong ngày không.
--
-- Trả jsonb { has_pending: bool, item_count?: int, total?: numeric, last_added_at?: timestamptz }.
-- Threshold: chỉ trả has_pending=true khi giỏ đã đứng yên >= 6h (last cart item created/updated >= 6h trước).
-- Mục đích: tránh prompt resume khi khách vừa mới add giỏ trong cùng session.
--
-- Date: 2026-05-18

BEGIN;

CREATE OR REPLACE FUNCTION public.check_pending_cart(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_portal_user_id uuid;
  v_count int;
  v_total numeric;
  v_last timestamptz;
BEGIN
  -- Resolve portal_user từ auth uid
  SELECT id INTO v_portal_user_id
  FROM public.portal_users
  WHERE auth_user_id = p_user_id
  LIMIT 1;

  IF v_portal_user_id IS NULL THEN
    RETURN jsonb_build_object('has_pending', false);
  END IF;

  -- Aggregate items hiện có trong giỏ (portal_cart_items đã lưu unit_price khi add).
  SELECT
    COUNT(*),
    COALESCE(SUM(ci.quantity * ci.unit_price), 0),
    MAX(GREATEST(ci.created_at, ci.updated_at))
  INTO v_count, v_total, v_last
  FROM public.portal_cart_items ci
  WHERE ci.portal_user_id = v_portal_user_id;

  -- Không có item HOẶC giỏ vừa update gần đây (<6h) → không cần prompt resume.
  IF v_count = 0 OR v_last IS NULL OR v_last > now() - interval '6 hours' THEN
    RETURN jsonb_build_object('has_pending', false);
  END IF;

  RETURN jsonb_build_object(
    'has_pending', true,
    'item_count', v_count,
    'total', v_total,
    'last_added_at', v_last
  );
END;
$$;

COMMENT ON FUNCTION public.check_pending_cart(uuid) IS
  'Gap 4 P2.5: trả tóm tắt giỏ pending của portal_user nếu giỏ đứng yên >= 6h. Chỉ dùng cho chatbot resume prompt.';

REVOKE EXECUTE ON FUNCTION public.check_pending_cart(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_pending_cart(uuid) TO authenticated, service_role;

COMMIT;
