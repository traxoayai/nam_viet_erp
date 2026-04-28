-- Bổ sung regex parser bank memo: hỗ trợ short form `SO{8-digit}` (no YYMMDD)
-- ============================================================================
-- BỐI CẢNH:
--   QR thanh toán mới generate memo dạng `SO00006840` / `POS00001234` —
--   chỉ giữ prefix + 8-digit suffix (drop YYMMDD-) để tiết kiệm ký tự
--   addInfo (max 25 EMVCo). Khi khách CK qua app banking, memo này không
--   chứa YYMMDD → regex full-form (20260428100000) không bắt được.
--
-- THIẾT KẾ:
--   1. Pattern 1 full: giữ nguyên `(SO|POS)[\s-]?(\d{6})[\s-]?(\d{8}|\d{4})`
--      cho memo có YYMMDD (legacy + khi user gõ tay full code).
--   2. Pattern 2 short: `(SO|POS)(\d{8})` chạy trên memo đã xóa Pattern 1
--      matches → resolve qua orders.code LIKE '%-' || suffix.
--   3. Đổi IMMUTABLE → STABLE: helper giờ phải SELECT từ orders.
--   4. Restrict short form CHỈ với 8-digit (format mới ≥ 2026-04-24). Format
--      cũ 4-digit short form quá ambiguous (trùng giữa các ngày) → không
--      support, khách phải dùng full form.
-- Date: 2026-04-28
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.extract_order_codes_from_memo(p_memo text)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_normalized text;
  v_remaining text;
  v_result text[] := ARRAY[]::text[];
  v_match text[];
  v_resolved text;
BEGIN
  IF p_memo IS NULL OR btrim(p_memo) = '' THEN
    RETURN ARRAY[]::text[];
  END IF;

  v_normalized := upper(p_memo);

  -- Pattern 1: full code có YYMMDD ở giữa (legacy + user gõ tay full)
  FOR v_match IN
    SELECT regexp_matches(v_normalized, '(SO|POS)[\s-]?(\d{6})[\s-]?(\d{8}|\d{4})', 'g')
  LOOP
    v_result := v_result || (v_match[1] || '-' || v_match[2] || '-' || v_match[3]);
  END LOOP;

  -- Loại bỏ Pattern 1 matches khỏi memo trước khi quét Pattern 2 — tránh
  -- short form bắt lại phần partial của full code (vd `SO260425000068` đầu
  -- của full `SO26042500006840`).
  v_remaining := regexp_replace(
    v_normalized,
    '(SO|POS)[\s-]?\d{6}[\s-]?(\d{8}|\d{4})',
    ' ',
    'g'
  );

  -- Pattern 2: short form `(SO|POS)(\d{8})` — không có YYMMDD.
  -- Resolve qua DB: tìm orders.code KẾT THÚC bằng '-{suffix}'. Sequence
  -- finance_tx_code_seq là global nextval → 8-digit suffix unique trên cả
  -- lifetime đơn → safe để resolve 1-1.
  FOR v_match IN
    SELECT regexp_matches(v_remaining, '(SO|POS)(\d{8})', 'g')
  LOOP
    SELECT code INTO v_resolved
    FROM public.orders
    WHERE code LIKE v_match[1] || '-%-' || v_match[2]
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_resolved IS NOT NULL THEN
      v_result := v_result || v_resolved;
    END IF;
  END LOOP;

  -- Dedupe preserve order
  SELECT COALESCE(ARRAY_AGG(c ORDER BY min_idx), ARRAY[]::text[]) INTO v_result
  FROM (
    SELECT c, MIN(idx) AS min_idx
    FROM unnest(v_result) WITH ORDINALITY AS t(c, idx)
    GROUP BY c
  ) u;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.extract_order_codes_from_memo(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
