-- =============================================================================
-- Migration: Loại Portal users khỏi get_users_with_roles + gán quyền Portal
-- Date: 2026-04-20
--
-- Vấn đề:
-- 1. `get_users_with_roles()` trả về TẤT CẢ auth.users (bao gồm Portal users
--    đã duyệt và auth user orphan từ registration_requests còn pending/rejected)
--    → lẫn vào trang "Quản Lý Phân Quyền" ERP.
-- 2. Các role quản trị (Admin, Giám Đốc, Phó Giám Đốc) chưa có quyền
--    `portal.view` / `portal.manage` → menu "Đăng ký Portal" + "Portal User"
--    bị ẩn với user không có `admin-all`.
-- =============================================================================

BEGIN;

-- 1. Fix get_users_with_roles: Loại auth users thuộc luồng Portal
CREATE OR REPLACE FUNCTION public.get_users_with_roles()
RETURNS TABLE("key" text, "id" uuid, "name" text, "email" text, "avatar" text, "status" text, "assignments" jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a_user.id::TEXT AS key,
    a_user.id,
    p_user.full_name AS name,
    a_user.email::TEXT AS email,
    p_user.avatar_url AS avatar,
    p_user.status::TEXT AS status,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'branchId', w.id,
        'branchName', w.name,
        'roleId', r.id,
        'roleName', r.name
      ))
      FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      JOIN public.warehouses w ON ur.branch_id = w.id
      WHERE ur.user_id = a_user.id
    ) AS assignments
  FROM auth.users AS a_user
  LEFT JOIN public.users AS p_user ON a_user.id = p_user.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.portal_users pu WHERE pu.auth_user_id = a_user.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.registration_requests rr WHERE rr.auth_user_id = a_user.id
  );
END;
$$;

ALTER FUNCTION public.get_users_with_roles() OWNER TO postgres;

-- 2. Gán quyền Portal cho các role quản trị
-- Áp dụng cho:
--   (a) Mọi role đã có 'admin-all' (Admin, Giám Đốc, ...)
--   (b) Role tên chứa 'Giám Đốc' hoặc 'Admin' (case-insensitive) để bắt cả Phó Giám Đốc
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM public.roles r
CROSS JOIN (VALUES ('portal.view'), ('portal.manage')) AS p(permission_key)
WHERE EXISTS (
        SELECT 1 FROM public.role_permissions rp2
        WHERE rp2.role_id = r.id AND rp2.permission_key = 'admin-all'
      )
   OR r.name ILIKE '%giám đốc%'
   OR r.name ILIKE '%admin%'
ON CONFLICT (role_id, permission_key) DO NOTHING;

COMMIT;
