-- Chat rate-limit — persistent counter để chống cost-attack LLM khi chạy
-- serverless (mỗi Next.js instance giữ Map riêng + cold-start reset → bypass
-- in-memory limit). Bucket theo (user_id, window_start) — 1 row / user / phút.
-- Date: 2026-06-11

BEGIN;

-- =====================================================================
-- Table — 1 row đại diện 1 cửa sổ thời gian của 1 user.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.chat_rate_limit (
  user_id      uuid        NOT NULL,
  window_start timestamptz NOT NULL,
  count        int         NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, window_start)
);

-- Index hỗ trợ cleanup row cũ.
CREATE INDEX IF NOT EXISTS chat_rate_limit_window_start_idx
  ON public.chat_rate_limit (window_start);

ALTER TABLE public.chat_rate_limit ENABLE ROW LEVEL SECURITY;

-- Deny-all: chỉ service_role mới đi qua được (service_role bypass RLS).
-- Không cấp policy nào cho anon/authenticated → mọi truy cập từ client bị chặn.
-- (Cố ý không tạo SELECT/INSERT/UPDATE/DELETE policies cho public roles.)

REVOKE ALL ON public.chat_rate_limit FROM PUBLIC;
REVOKE ALL ON public.chat_rate_limit FROM anon;
REVOKE ALL ON public.chat_rate_limit FROM authenticated;
GRANT  ALL ON public.chat_rate_limit TO service_role;

COMMENT ON TABLE public.chat_rate_limit IS
  'Sliding-bucket counter cho chat rate-limit (60 msg/phút/user mặc định). '
  'Service-role only; deny-all RLS với client roles.';

-- =====================================================================
-- RPC — check + increment atomic trong 1 round-trip.
--   - Bucket = floor(epoch_now / window_sec) * window_sec (timestamptz).
--   - UPSERT row hiện tại; nếu count vượt max → trả ok=false KHÔNG tăng.
--   - Trả về (ok bool, remaining int): remaining = max - count sau khi inc.
-- Chỉ service_role được EXECUTE — route handler gọi qua supabase server client.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_chat_rate_limit(
  p_user_id    uuid,
  p_max        int DEFAULT 60,
  p_window_sec int DEFAULT 60
)
RETURNS TABLE (ok boolean, remaining int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_window_start timestamptz;
  v_new_count    int;
BEGIN
  IF p_user_id IS NULL THEN
    -- Defensive: caller phải pass uuid hợp lệ. Trả ok=false để không bị bypass.
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  -- Floor xuống đầu window_sec gần nhất → mọi request trong cùng phút share row.
  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_sec) * p_window_sec
  );

  -- Atomic check-then-increment: nếu row chưa tới max thì +1, ngược lại giữ
  -- nguyên. ON CONFLICT update có guard WHERE để không tăng quá max.
  INSERT INTO public.chat_rate_limit (user_id, window_start, count, updated_at)
  VALUES (p_user_id, v_window_start, 1, now())
  ON CONFLICT (user_id, window_start) DO UPDATE
    SET count      = public.chat_rate_limit.count + 1,
        updated_at = now()
    WHERE public.chat_rate_limit.count < p_max
  RETURNING public.chat_rate_limit.count INTO v_new_count;

  IF v_new_count IS NULL THEN
    -- ON CONFLICT update bị skip (count đã >= max) → đọc lại count hiện tại.
    SELECT c.count INTO v_new_count
    FROM public.chat_rate_limit c
    WHERE c.user_id = p_user_id
      AND c.window_start = v_window_start;
    RETURN QUERY SELECT false, GREATEST(p_max - v_new_count, 0);
    RETURN;
  END IF;

  RETURN QUERY SELECT (v_new_count <= p_max), GREATEST(p_max - v_new_count, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_chat_rate_limit(uuid, int, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_chat_rate_limit(uuid, int, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_chat_rate_limit(uuid, int, int) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.check_chat_rate_limit(uuid, int, int) TO service_role;

COMMENT ON FUNCTION public.check_chat_rate_limit(uuid, int, int) IS
  'Atomic check + increment chat rate-limit counter. Trả (ok, remaining). '
  'Service-role only; gọi từ route handler trước khi xử lý message.';

-- =====================================================================
-- Cleanup RPC — xoá row > 1 ngày để bảng không phình.
--   Gọi từ cron (pg_cron) hoặc supabase scheduled function.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.cleanup_chat_rate_limit()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM public.chat_rate_limit
  WHERE window_start < now() - interval '1 day';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_chat_rate_limit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_chat_rate_limit() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_chat_rate_limit() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.cleanup_chat_rate_limit() TO service_role;

COMMENT ON FUNCTION public.cleanup_chat_rate_limit() IS
  'Xoá bucket > 1 ngày. Gọi định kỳ từ cron để bảng không phình.';

COMMIT;
