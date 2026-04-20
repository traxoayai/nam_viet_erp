-- =============================================================================
-- Migration: RLS policies cho portal_users
-- Date: 2026-04-20
--
-- Vấn đề: Table `portal_users` bật RLS nhưng không có policy nào
-- → Nếu có code query trực tiếp (không qua RPC SECURITY DEFINER) sẽ trống.
-- Defensive: thêm policy cho admin ERP có portal.view / portal.manage.
-- service_role vẫn bypass RLS như mặc định.
-- =============================================================================

BEGIN;

-- SELECT: user ERP có portal.view hoặc portal.manage
DROP POLICY IF EXISTS "portal_users_select_admin" ON public.portal_users;
CREATE POLICY "portal_users_select_admin"
  ON public.portal_users
  FOR SELECT
  TO authenticated
  USING (
    public.user_has_permission('portal.view')
    OR public.user_has_permission('portal.manage')
  );

-- UPDATE: user ERP có portal.manage
DROP POLICY IF EXISTS "portal_users_update_admin" ON public.portal_users;
CREATE POLICY "portal_users_update_admin"
  ON public.portal_users
  FOR UPDATE
  TO authenticated
  USING (public.user_has_permission('portal.manage'))
  WITH CHECK (public.user_has_permission('portal.manage'));

-- SELECT: portal user tự xem record của mình (khi login portal)
DROP POLICY IF EXISTS "portal_users_select_self" ON public.portal_users;
CREATE POLICY "portal_users_select_self"
  ON public.portal_users
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

COMMIT;
