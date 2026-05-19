-- 20260518000008_compliance_audit_rpcs.sql
-- Plan 2 — Agent G3: RPCs cho Compliance Audit Dashboard chatbot.
-- Date: 2026-05-18
--
-- 3 RPC SECURITY DEFINER (gate qua public.is_chat_staff()):
--   1. list_chat_compliance_audits(p_from, p_to, p_severity, p_limit, p_offset)
--        → TABLE: paginated audit rows + customer info (auth.users + portal_users).
--   2. get_compliance_audit_detail(p_audit_id uuid)
--        → jsonb: audit + 3 message before/after trong session để hiểu context.
--   3. get_compliance_audit_stats(p_from, p_to)
--        → jsonb: {total, by_severity, by_day}
--
-- IMPORTANT — schema reality:
--   - chat_compliance_audits.id là uuid (KHÔNG phải bigint).
--   - chat_compliance_audits.audited_at là timestamp dữ liệu chính (alias
--     `audit_created_at` ở RPC để FE đọc rõ ý nghĩa).
--   - chat_sessions.user_id FK auth.users.id; tên hiển thị lấy từ
--     portal_users.display_name (LEFT JOIN, có thể NULL).
--   - Không có cột severity 'critical' — chỉ low/medium/high.
--
-- RLS đã có chat_compliance_select cho is_chat_staff(), nhưng RPC vẫn dùng
-- SECURITY DEFINER + check is_chat_staff() để đồng bộ với pattern analytics
-- (tránh edge case staff hết quyền nhưng RPC vẫn chạy).

BEGIN;

-- =====================================================================
-- 1. list_chat_compliance_audits
-- =====================================================================
DROP FUNCTION IF EXISTS public.list_chat_compliance_audits(date, date, text, int, int);

CREATE OR REPLACE FUNCTION public.list_chat_compliance_audits(
  p_from     date,
  p_to       date,
  p_severity text DEFAULT NULL,
  p_limit    int  DEFAULT 100,
  p_offset   int  DEFAULT 0
)
RETURNS TABLE (
  audit_id           uuid,
  message_id         uuid,
  session_id         uuid,
  rule_code          text,
  severity           text,
  matched_keywords   text[],
  excerpt            text,
  status             text,
  customer_email     text,
  customer_name      text,
  audit_created_at   timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    a.id                AS audit_id,
    a.message_id        AS message_id,
    a.session_id        AS session_id,
    a.rule_code         AS rule_code,
    a.severity          AS severity,
    a.matched_keywords  AS matched_keywords,
    a.excerpt           AS excerpt,
    a.status            AS status,
    u.email::text       AS customer_email,
    pu.display_name::text AS customer_name,
    a.audited_at        AS audit_created_at
  FROM public.chat_compliance_audits a
  JOIN public.chat_sessions s ON s.id = a.session_id
  LEFT JOIN auth.users      u  ON u.id  = s.user_id
  LEFT JOIN public.portal_users pu ON pu.auth_user_id = s.user_id
  WHERE public.is_chat_staff()
    AND a.audited_at::date BETWEEN p_from AND p_to
    AND (p_severity IS NULL OR a.severity = p_severity)
  ORDER BY a.audited_at DESC
  LIMIT  GREATEST(COALESCE(p_limit, 100), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE EXECUTE ON FUNCTION public.list_chat_compliance_audits(date, date, text, int, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_chat_compliance_audits(date, date, text, int, int) FROM anon;
GRANT  EXECUTE ON FUNCTION public.list_chat_compliance_audits(date, date, text, int, int)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.list_chat_compliance_audits(date, date, text, int, int) IS
  'G3 Compliance dashboard: list audit rows trong khoảng date, có severity filter + pagination.';

-- =====================================================================
-- 2. get_compliance_audit_detail
-- =====================================================================
DROP FUNCTION IF EXISTS public.get_compliance_audit_detail(uuid);

CREATE OR REPLACE FUNCTION public.get_compliance_audit_detail(
  p_audit_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_audit       public.chat_compliance_audits;
  v_anchor      public.chat_messages;
  v_before      jsonb;
  v_after       jsonb;
  v_customer    jsonb;
BEGIN
  IF NOT public.is_chat_staff() THEN
    RAISE EXCEPTION 'Không có quyền xem audit chatbot' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_audit
  FROM public.chat_compliance_audits
  WHERE id = p_audit_id;

  IF v_audit.id IS NULL THEN
    RETURN jsonb_build_object('not_found', true);
  END IF;

  -- Anchor message bị flag
  SELECT * INTO v_anchor
  FROM public.chat_messages
  WHERE id = v_audit.message_id;

  -- 3 message TRƯỚC anchor trong cùng session (theo created_at DESC, đảo lại)
  SELECT COALESCE(jsonb_agg(row_to_json(m_before) ORDER BY (m_before->>'created_at') ASC), '[]'::jsonb)
  INTO v_before
  FROM (
    SELECT
      m.id,
      m.session_id,
      m.role,
      m.content_type,
      m.content,
      m.created_at
    FROM public.chat_messages m
    WHERE m.session_id = v_audit.session_id
      AND m.deleted_at IS NULL
      AND m.created_at < v_anchor.created_at
    ORDER BY m.created_at DESC
    LIMIT 3
  ) m_before;

  -- 3 message SAU anchor trong cùng session
  SELECT COALESCE(jsonb_agg(row_to_json(m_after) ORDER BY (m_after->>'created_at') ASC), '[]'::jsonb)
  INTO v_after
  FROM (
    SELECT
      m.id,
      m.session_id,
      m.role,
      m.content_type,
      m.content,
      m.created_at
    FROM public.chat_messages m
    WHERE m.session_id = v_audit.session_id
      AND m.deleted_at IS NULL
      AND m.created_at > v_anchor.created_at
    ORDER BY m.created_at ASC
    LIMIT 3
  ) m_after;

  -- Customer info (email + display_name)
  SELECT jsonb_build_object(
    'user_id', s.user_id,
    'email',   u.email,
    'display_name', pu.display_name,
    'platform', s.platform,
    'session_status', s.status
  )
  INTO v_customer
  FROM public.chat_sessions s
  LEFT JOIN auth.users          u  ON u.id  = s.user_id
  LEFT JOIN public.portal_users pu ON pu.auth_user_id = s.user_id
  WHERE s.id = v_audit.session_id;

  RETURN jsonb_build_object(
    'audit',           to_jsonb(v_audit),
    'anchor_message',  to_jsonb(v_anchor),
    'messages_before', COALESCE(v_before, '[]'::jsonb),
    'messages_after',  COALESCE(v_after,  '[]'::jsonb),
    'customer',        COALESCE(v_customer, '{}'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_compliance_audit_detail(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_compliance_audit_detail(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_compliance_audit_detail(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_compliance_audit_detail(uuid) IS
  'G3 Compliance dashboard: detail 1 audit + 3 msg trước/sau anchor message để hiểu context.';

-- =====================================================================
-- 3. get_compliance_audit_stats
-- =====================================================================
DROP FUNCTION IF EXISTS public.get_compliance_audit_stats(date, date);

CREATE OR REPLACE FUNCTION public.get_compliance_audit_stats(
  p_from date,
  p_to   date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  WITH gate AS (
    SELECT public.is_chat_staff() AS ok
  ),
  base AS (
    SELECT
      a.id,
      a.severity,
      a.audited_at::date AS day
    FROM public.chat_compliance_audits a, gate
    WHERE gate.ok
      AND a.audited_at::date BETWEEN p_from AND p_to
  ),
  totals AS (
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE severity = 'high')::int   AS sev_high,
      COUNT(*) FILTER (WHERE severity = 'medium')::int AS sev_med,
      COUNT(*) FILTER (WHERE severity = 'low')::int    AS sev_low
    FROM base
  ),
  d AS (
    SELECT generate_series(p_from, p_to, '1 day'::interval)::date AS day
  ),
  per_day AS (
    SELECT b.day, COUNT(*)::int AS cnt
    FROM base b
    GROUP BY b.day
  ),
  series AS (
    SELECT d.day, COALESCE(per_day.cnt, 0)::int AS cnt
    FROM d
    LEFT JOIN per_day USING (day)
    ORDER BY d.day
  )
  SELECT jsonb_build_object(
    'total',  (SELECT total FROM totals),
    'by_severity', jsonb_build_object(
      'high',   (SELECT sev_high FROM totals),
      'medium', (SELECT sev_med  FROM totals),
      'low',    (SELECT sev_low  FROM totals)
    ),
    'by_day', COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('day', s.day, 'count', s.cnt) ORDER BY s.day)
        FROM series s
      ),
      '[]'::jsonb
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_compliance_audit_stats(date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_compliance_audit_stats(date, date) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_compliance_audit_stats(date, date)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_compliance_audit_stats(date, date) IS
  'G3 Compliance dashboard: KPI tổng + by_severity + by_day series (generate_series fill 0).';

COMMIT;
