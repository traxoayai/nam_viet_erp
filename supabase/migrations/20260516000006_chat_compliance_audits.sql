-- 20260516000006_chat_compliance_audits.sql
-- Plan 2 Task 16: bảng chat_compliance_audits + heuristic detector R-04.
-- Date: 2026-05-16
--
-- Mục đích:
--   - Lưu kết quả audit compliance cho các tin nhắn chatbot có dấu hiệu
--     "tư vấn thuốc" (R-04). Staff CRM có quyền review/đánh giá.
--   - Cung cấp hàm public.detect_medical_advice(text) → jsonb để phát hiện
--     keyword tư vấn thuốc; dùng cho cả realtime (route gửi tin) lẫn batch
--     audit (Task 17).
--
-- RLS: chỉ staff CRM (public.is_chat_staff()) mới SELECT/UPDATE được. INSERT
-- thực hiện bởi service_role (job nền + RPC SECURITY DEFINER) nên không cần
-- INSERT policy cho authenticated.

BEGIN;

CREATE TABLE IF NOT EXISTS public.chat_compliance_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  rule_code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  matched_keywords text[],
  excerpt text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewed_ok', 'reviewed_violation')),
  reviewer_id uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  reviewer_note text,
  audited_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, rule_code)
);

CREATE INDEX IF NOT EXISTS chat_compliance_audits_status_idx
  ON public.chat_compliance_audits (status, audited_at DESC);

ALTER TABLE public.chat_compliance_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_compliance_select ON public.chat_compliance_audits;
CREATE POLICY chat_compliance_select ON public.chat_compliance_audits
  FOR SELECT
  USING (public.is_chat_staff());

DROP POLICY IF EXISTS chat_compliance_update ON public.chat_compliance_audits;
CREATE POLICY chat_compliance_update ON public.chat_compliance_audits
  FOR UPDATE
  USING (public.is_chat_staff())
  WITH CHECK (public.is_chat_staff());

-- =====================================================================
-- Heuristic detector: R-04 (tư vấn thuốc / dosing / chống chỉ định)
-- =====================================================================
-- Trả về jsonb { matched: bool, severity: text, matches: text[] }
-- - matched=false khi content null/empty hoặc không có keyword.
-- - severity: low (mặc định khi không match), medium (1-2 match), high (>=3).
-- IMMUTABLE: chỉ phụ thuộc input, không truy cập bảng.
CREATE OR REPLACE FUNCTION public.detect_medical_advice(p_content text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_matches text[] := ARRAY[]::text[];
  v_severity text := 'low';
  v_kw text;
BEGIN
  IF p_content IS NULL OR length(p_content) = 0 THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  FOR v_kw IN
    SELECT unnest(ARRAY[
      'liều dùng', 'liều lượng', 'liều cao', 'liều thấp',
      'tác dụng phụ', 'phản ứng phụ',
      'chỉ định', 'chống chỉ định',
      'tương tác thuốc', 'kết hợp với',
      'bà bầu', 'phụ nữ có thai', 'cho con bú',
      'trẻ em', 'trẻ sơ sinh',
      'điều trị', 'chữa khỏi', 'chữa được',
      'dùng bao lâu', 'uống mấy viên', 'mấy lần một ngày',
      'thay thế', 'thay cho'
    ])
  LOOP
    IF position(lower(v_kw) in lower(p_content)) > 0 THEN
      v_matches := array_append(v_matches, v_kw);
    END IF;
  END LOOP;

  -- array_length của empty array trả NULL → bọc COALESCE để branching và
  -- giá trị 'matched' không bị NULL khi không match keyword nào.
  IF COALESCE(array_length(v_matches, 1), 0) >= 3 THEN
    v_severity := 'high';
  ELSIF COALESCE(array_length(v_matches, 1), 0) >= 1 THEN
    v_severity := 'medium';
  END IF;

  RETURN jsonb_build_object(
    'matched', COALESCE(array_length(v_matches, 1), 0) > 0,
    'severity', v_severity,
    'matches', to_jsonb(v_matches)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.detect_medical_advice(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.detect_medical_advice(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.detect_medical_advice(text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.detect_medical_advice(text) IS
  'Heuristic detector R-04 (tư vấn thuốc). Trả jsonb {matched, severity, matches}.';

COMMIT;
