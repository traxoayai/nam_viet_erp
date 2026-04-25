-- Add p_threshold_minutes param to check_idle_transactions
-- ============================================================================
-- Test integration cần fire RPC trên idle tx vừa tạo (vài giây) thay vì chờ
-- 10 phút. Refactor: param `p_threshold_minutes` default=10 (giữ nguyên cron
-- behavior). Test gọi với p_threshold_minutes=0 → fire ngay.
--
-- KHÔNG ĐỘNG kill threshold (60p) — auto-kill chỉ chạy khi tx_age > 60 phút.
-- Test chỉ verify notification logic, không trigger kill.
-- KHÔNG đụng cron (vẫn gọi không param → default=10).
--
-- Date: 2026-04-25
-- ============================================================================

BEGIN;

-- Drop overload no-param (legacy) trước khi tạo bản default-param.
-- Nếu CREATE OR REPLACE giữ overload no-param → cron mặc định resolve sai.
DROP FUNCTION IF EXISTS public.check_idle_transactions();

CREATE OR REPLACE FUNCTION public.check_idle_transactions(
  p_threshold_minutes INT DEFAULT 10
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tx RECORD;
  v_admin RECORD;
  v_age INTERVAL;
  v_killed BOOLEAN;
  v_threshold INTERVAL;
BEGIN
  v_threshold := make_interval(mins => GREATEST(p_threshold_minutes, 0));

  FOR v_tx IN
    SELECT
      pid,
      usename,
      NOW() - xact_start AS tx_age,
      LEFT(query, 200) AS query_preview
    FROM pg_stat_activity
    WHERE state = 'idle in transaction'
      AND xact_start IS NOT NULL
      AND NOW() - xact_start > v_threshold
      -- Loại trừ role hệ thống (có thể hợp lệ giữ tx lâu trong edge case)
      AND usename NOT IN ('supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin', 'supabase_replication_admin')
  LOOP
    v_age := v_tx.tx_age;
    v_killed := FALSE;
    -- Auto-kill zombie chắc chắn (> 60 phút)
    IF v_age > INTERVAL '60 minutes' THEN
      BEGIN
        PERFORM pg_terminate_backend(v_tx.pid);
        v_killed := TRUE;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[idle-tx-monitor] Failed to kill pid %: %', v_tx.pid, SQLERRM;
      END;
    END IF;
    -- Notify admin (dedup: 1 notification / pid / giờ)
    FOR v_admin IN
      SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON ur.role_id = rp.role_id
      WHERE rp.permission_key = 'admin-all'
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_admin.user_id
          AND n.category = 'idle_tx_zombie'
          AND (n.metadata ->> 'pid')::INT = v_tx.pid
          AND n.created_at > NOW() - INTERVAL '1 hour'
      ) THEN
        INSERT INTO public.notifications (user_id, title, message, type, category, metadata)
        VALUES (
          v_admin.user_id,
          CASE WHEN v_killed
            THEN '[Auto-killed] Idle transaction zombie'
            ELSE 'Idle transaction cảnh báo'
          END,
          'PID ' || v_tx.pid || ' (' || COALESCE(v_tx.usename, 'unknown')
            || ') idle ' || EXTRACT(EPOCH FROM v_age)::INT / 60 || ' phút. '
            || CASE WHEN v_killed THEN 'Đã tự động terminate.' ELSE 'Cần review.' END,
          CASE WHEN v_killed THEN 'warning' ELSE 'error' END,
          'idle_tx_zombie',
          jsonb_build_object(
            'pid', v_tx.pid,
            'usename', v_tx.usename,
            'tx_age_minutes', EXTRACT(EPOCH FROM v_age)::INT / 60,
            'query_preview', v_tx.query_preview,
            'auto_killed', v_killed
          )
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
