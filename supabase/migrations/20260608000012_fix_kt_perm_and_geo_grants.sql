-- Fix theo adversarial review 2026-06-08:
-- #3 Role 'Kế Toán' thieu 'finance.view_balance' -> bi route-gate chan khoi trang So
--    Nhat Ky + Bao Cao Tai Chinh, khien 3 quyen write (post/void/close cap o migration
--    20260608000006) thanh quyen CHET. Cap them finance.view_balance (idempotent).
-- #6 Bang lookup provinces/wards van con quyen INSERT/UPDATE/DELETE/TRUNCATE cho
--    authenticated/anon (tu default privileges Supabase) -> RLS khong phu TRUNCATE.
--    REVOKE quyen ghi, chi giu SELECT (defense in depth).
-- Ngay 2026-06-08.
BEGIN;

INSERT INTO public.role_permissions(role_id, permission_key)
SELECT r.id, 'finance.view_balance'
FROM public.roles r
WHERE r.name = 'Kế Toán'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_key = 'finance.view_balance'
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.provinces FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.wards FROM authenticated, anon;

COMMIT;
