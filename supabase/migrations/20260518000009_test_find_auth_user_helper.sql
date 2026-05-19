-- 20260518000009_test_find_auth_user_helper.sql
-- Test helper RPC: lookup auth.users by email cho integration tests setup.
-- Khắc phục giới hạn `auth.admin.listUsers` SDK (paginate cap 500 user) +
-- PostgREST không expose schema 'auth' qua REST.
-- Chỉ grant service_role; REVOKE anon/PUBLIC để không lộ email PII qua API.
-- Date: 2026-05-18

BEGIN;

CREATE OR REPLACE FUNCTION public._test_find_auth_user_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, pg_catalog
AS $$
  SELECT id FROM auth.users WHERE email = p_email LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public._test_find_auth_user_by_email(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._test_find_auth_user_by_email(text) FROM anon;
GRANT EXECUTE ON FUNCTION public._test_find_auth_user_by_email(text) TO service_role;

COMMENT ON FUNCTION public._test_find_auth_user_by_email(text) IS
  'Test helper: lookup auth.users by email, dùng trong __tests__/helpers/seed.ts khi listUsers SDK miss user > 500. service_role only.';

COMMIT;
