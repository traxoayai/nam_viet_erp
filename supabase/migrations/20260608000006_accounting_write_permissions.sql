-- Tach quyen GHI but toan ke toan ra khoi quyen XEM (finance.view_balance).
-- FE da tham chieu san 3 key finance.post_journal / void_journal / close_period
-- (JournalEntryDrawer, ClosePeriodModal, JournalLedgerPage) nhung backend con
-- dung chung finance.view_balance -> lo hong: user chi co quyen xem van goi
-- duoc RPC ghi qua API. Migration nay dong bo backend voi FE. Ngay 2026-06-08.
BEGIN;

-- 1) Seed 3 quyen write vao catalog `permissions` (idempotent, khong gia dinh constraint)
INSERT INTO public.permissions(key, name, module)
SELECT v.key, v.name, 'finance'
FROM (VALUES
  ('finance.post_journal', 'Kế toán: Ghi sổ (duyệt bút toán)'),
  ('finance.void_journal', 'Kế toán: Hủy bút toán'),
  ('finance.close_period', 'Kế toán: Khóa kỳ kế toán')
) AS v(key, name)
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.key = v.key);

-- 2) Gan 3 quyen cho role Admin + Ke Toan (Giam Doc da co admin-all nen bypass)
INSERT INTO public.role_permissions(role_id, permission_key)
SELECT r.id, v.key
FROM public.roles r
CROSS JOIN (VALUES
  ('finance.post_journal'),
  ('finance.void_journal'),
  ('finance.close_period')
) AS v(key)
WHERE r.name IN ('Admin', 'Kế Toán')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_key = v.key
  );

-- 3) Siet rpc_access_rules: cac RPC ghi but toan doi quyen rieng
UPDATE public.rpc_access_rules SET required_permission = 'finance.post_journal'
  WHERE function_name IN ('post_journal_entry', 'create_invoice_payment');
UPDATE public.rpc_access_rules SET required_permission = 'finance.void_journal'
  WHERE function_name = 'void_journal_entry';
UPDATE public.rpc_access_rules SET required_permission = 'finance.close_period'
  WHERE function_name = 'acc_close_period';
-- acc_create_journal_entry GIU finance.view_balance: tao but toan NHAP (draft) it
-- rui ro hon, chi post/void/close moi tac dong so du -> chi siet 4 RPC tren.

COMMIT;
