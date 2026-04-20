-- =============================================================================
-- Migration: RLS policies cho registration_requests
-- Date: 2026-04-20
--
-- Vấn đề: RLS bật nhưng không có policy nào cho `authenticated` role
-- → ERP client (React) query từ browser không thấy row nào
-- → Trang "Đăng ký Portal" trống dù DB có 52 pending + 1 approved + 11 rejected.
--
-- Giải pháp: thêm policy cho user có portal.view (SELECT) và portal.manage (UPDATE).
-- service_role vẫn bypass RLS như trước (dùng cho Next.js Portal API + Edge Functions).
-- =============================================================================

BEGIN;

-- SELECT: user có portal.view hoặc admin-all
DROP POLICY IF EXISTS "registration_requests_select_portal_view" ON public.registration_requests;
CREATE POLICY "registration_requests_select_portal_view"
  ON public.registration_requests
  FOR SELECT
  TO authenticated
  USING (
    public.user_has_permission('portal.view')
    OR public.user_has_permission('portal.manage')
  );

-- UPDATE: user có portal.manage (để reject/approve từ UI)
DROP POLICY IF EXISTS "registration_requests_update_portal_manage" ON public.registration_requests;
CREATE POLICY "registration_requests_update_portal_manage"
  ON public.registration_requests
  FOR UPDATE
  TO authenticated
  USING (public.user_has_permission('portal.manage'))
  WITH CHECK (public.user_has_permission('portal.manage'));

COMMIT;
