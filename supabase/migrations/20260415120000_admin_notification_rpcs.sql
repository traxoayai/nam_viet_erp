-- =============================================================================
-- Admin Notification RPCs
-- Date: 2026-04-15
-- 1. get_my_notifications — paginated list for current user
-- 2. mark_all_my_notifications_read — bulk mark read for current user
-- =============================================================================

BEGIN;

-- 1. get_my_notifications
CREATE OR REPLACE FUNCTION public.get_my_notifications(
  p_category TEXT DEFAULT NULL,
  p_page     INT DEFAULT 1,
  p_page_size INT DEFAULT 20
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_offset INT := (GREATEST(p_page, 1) - 1) * p_page_size;
  v_total  INT;
  v_data   JSON;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM public.notifications n
  WHERE n.user_id = auth.uid()
    AND (p_category IS NULL OR n.category = p_category);

  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_data
  FROM (
    SELECT
      n.id,
      n.title,
      n.message,
      n.type,
      n.is_read,
      n.category,
      n.metadata,
      n.reference_id,
      n.created_at
    FROM public.notifications n
    WHERE n.user_id = auth.uid()
      AND (p_category IS NULL OR n.category = p_category)
    ORDER BY n.created_at DESC
    LIMIT p_page_size OFFSET v_offset
  ) t;

  RETURN json_build_object(
    'data', v_data,
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$$;

-- 2. mark_all_my_notifications_read
CREATE OR REPLACE FUNCTION public.mark_all_my_notifications_read()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = auth.uid()
    AND is_read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.get_my_notifications(TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_my_notifications_read() TO authenticated;

COMMIT;
