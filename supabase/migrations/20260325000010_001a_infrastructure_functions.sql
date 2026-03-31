-- =====================================================
-- Migration 001: Infrastructure (RLS + RPC Guards + Audit + Auth)
-- Merged from: 001, 002, 003, 004
-- Date: 2026-03-31
-- Safe for production: YES (idempotent, no destructive data changes)
-- =====================================================

-- Note: Supabase CLI wraps each migration in a transaction automatically

-- =============================================================
-- SECTION 1: Helper Functions (is_admin, is_authenticated, user_has_permission)
-- =============================================================

-- 1a. is_admin - Check if current user has admin-all permission
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET "search_path" TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND rp.permission_key = 'admin-all'
  );
$$;

-- 1b. is_authenticated - Check if current user is logged in
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET "search_path" TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL;
$$;

-- 1c. user_has_permission - Check if current user has a specific permission
CREATE OR REPLACE FUNCTION public.user_has_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET "search_path" TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role_id = rp.role_id
    WHERE ur.user_id = auth.uid()
      AND (rp.permission_key = p_permission OR rp.permission_key = 'admin-all')
  );
$$;

COMMENT ON FUNCTION public.user_has_permission IS 'Check if current user has a specific permission. Returns true for admin-all.';


-- =============================================================
-- SECTION 2: New Tables (rpc_access_rules, rpc_rate_log)
-- =============================================================

-- 2a. Config table: which permission each RPC needs, rate limit
CREATE TABLE IF NOT EXISTS public.rpc_access_rules (
  function_name TEXT PRIMARY KEY,
  required_permission TEXT,          -- NULL = only authenticated required
  max_calls_per_minute INT DEFAULT 60,
  is_write BOOLEAN DEFAULT false,    -- true = CUD operations
  description TEXT
);

-- 2b. Rate limit log table (auto-cleanup)
CREATE TABLE IF NOT EXISTS public.rpc_rate_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  called_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rpc_rate_log_lookup
  ON public.rpc_rate_log (user_id, function_name, called_at DESC);

-- 2c. RLS for new tables
ALTER TABLE public.rpc_access_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rpc_rules_read" ON public.rpc_access_rules;
CREATE POLICY "rpc_rules_read" ON public.rpc_access_rules FOR SELECT USING (true);

DROP POLICY IF EXISTS "rpc_rules_admin" ON public.rpc_access_rules;
CREATE POLICY "rpc_rules_admin" ON public.rpc_access_rules FOR ALL
  USING (public.user_has_permission('admin-all'));

ALTER TABLE public.rpc_rate_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_log_system" ON public.rpc_rate_log;
CREATE POLICY "rate_log_system" ON public.rpc_rate_log FOR ALL
  USING (public.user_has_permission('admin-all'));


-- =============================================================
-- SECTION 3: Schema Changes (users.work_state)
-- =============================================================

-- 3a. Add work_state column
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS work_state TEXT DEFAULT 'working';

-- 3b. Add constraint for valid values
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_work_state_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_work_state_check
  CHECK (work_state IN ('working', 'on_leave', 'resigned', 'test'));

-- 3c. Safe data migration (no test user manipulation)
UPDATE public.users SET work_state = 'working'  WHERE status = 'active'   AND (work_state IS NULL OR work_state = 'working');
UPDATE public.users SET work_state = 'resigned' WHERE status = 'inactive' AND (work_state IS NULL OR work_state = 'working');

-- 3d. Index for filtering
CREATE INDEX IF NOT EXISTS idx_users_work_state ON public.users(work_state);


-- =============================================================
-- SECTION 4: RPC Guard Function (check_rpc_access with audit logging + search_path)
-- Final version: combines rate limiting, permission check, and audit logging
-- =============================================================

CREATE OR REPLACE FUNCTION public.check_rpc_access(p_function_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_rule RECORD;
  v_call_count INT;
  v_uid UUID;
BEGIN
  v_uid := auth.uid();

  -- Must be authenticated
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Chưa đăng nhập.';
  END IF;

  -- Lookup rule
  SELECT * INTO v_rule FROM public.rpc_access_rules WHERE function_name = p_function_name;

  -- No rule = allow authenticated (backward compatible)
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Permission check
  IF v_rule.required_permission IS NOT NULL THEN
    IF NOT public.user_has_permission(v_rule.required_permission)
       AND NOT public.user_has_permission('admin-all') THEN
      RAISE EXCEPTION 'Forbidden: Bạn không có quyền gọi %.', p_function_name;
    END IF;
  END IF;

  -- Rate limit check
  IF v_rule.max_calls_per_minute > 0 THEN
    SELECT COUNT(*) INTO v_call_count
    FROM public.rpc_rate_log
    WHERE user_id = v_uid
      AND function_name = p_function_name
      AND called_at > now() - interval '1 minute';

    IF v_call_count >= v_rule.max_calls_per_minute THEN
      RAISE EXCEPTION 'Rate limit exceeded: Vượt quá % lần/phút cho %.', v_rule.max_calls_per_minute, p_function_name;
    END IF;
  END IF;

  -- Log call to rate_log
  INSERT INTO public.rpc_rate_log (user_id, function_name) VALUES (v_uid, p_function_name);

  -- Auto-log WRITE operations to system_logs for audit trail
  IF v_rule.is_write THEN
    PERFORM public._log_rpc_call(
      SPLIT_PART(COALESCE(v_rule.required_permission, 'system'), '.', 1),
      p_function_name,
      jsonb_build_object('user_id', v_uid)
    );
  END IF;
END;
$$;


-- =============================================================
-- SECTION 5: Audit Logging Function (_log_rpc_call)
-- =============================================================

CREATE OR REPLACE FUNCTION public._log_rpc_call(
  p_module TEXT,
  p_action TEXT,
  p_data JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT := 'Hệ thống';
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL THEN
    SELECT COALESCE(full_name, email, 'Unknown')
    INTO v_user_name
    FROM public.users WHERE id = v_user_id;
  END IF;

  INSERT INTO public.system_logs (
    user_id, user_name, module, action,
    record_id, new_data, created_at
  ) VALUES (
    v_user_id, v_user_name, p_module, p_action,
    COALESCE(p_data->>'ref_id', ''),
    p_data,
    NOW()
  );
END;
$$;


-- =============================================================
-- SECTION 6: Auth Functions (approve_user, cleanup_rpc_rate_log)
-- =============================================================

-- 6a. approve_user - with RPC guard, self-approve block, pending check
CREATE OR REPLACE FUNCTION public.approve_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
BEGIN
  PERFORM public.check_rpc_access('approve_user');

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Không thể tự duyệt chính mình.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = p_user_id AND status = 'pending_approval'
  ) THEN
    RAISE EXCEPTION 'User không tồn tại hoặc không ở trạng thái chờ duyệt.';
  END IF;

  UPDATE public.users
  SET status = 'active', profile_updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- 6b. cleanup_rpc_rate_log - purge entries older than 5 minutes
CREATE OR REPLACE FUNCTION public.cleanup_rpc_rate_log()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
  DELETE FROM public.rpc_rate_log WHERE called_at < now() - interval '5 minutes';
$$;


-- =============================================================
-- SECTION 7: Permission Functions (update_permissions_for_role, get_my_permissions_for_user)
-- =============================================================

-- 7a. update_permissions_for_role - with RPC guard
CREATE OR REPLACE FUNCTION public.update_permissions_for_role(
  p_role_id UUID,
  p_permission_keys TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
BEGIN
  PERFORM public.check_rpc_access('update_permissions_for_role');

  DELETE FROM public.role_permissions WHERE role_id = p_role_id;

  INSERT INTO public.role_permissions (role_id, permission_key)
  SELECT p_role_id, unnest(p_permission_keys);
END;
$$;

-- 7b. get_my_permissions_for_user - for Edge Functions (no auth.uid())
CREATE OR REPLACE FUNCTION public.get_my_permissions_for_user(p_user_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET "search_path" TO 'public'
AS $$
DECLARE
  v_perms TEXT[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT rp.permission_key)
  INTO v_perms
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  WHERE ur.user_id = p_user_id;

  RETURN COALESCE(v_perms, ARRAY[]::TEXT[]);
END;
$$;

COMMENT ON FUNCTION public.get_my_permissions_for_user IS 'Get permission keys for a specific user. Used by Edge Functions where auth.uid() is not available.';


-- =============================================================
