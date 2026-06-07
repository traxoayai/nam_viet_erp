-- Idempotent dedup hoa don DAU VAO (inbound): chong trung khi quet/nhap lai cung
-- mot hoa don NCC. Khoa = (MST nguoi ban, ky hieu, so hoa don). Partial unique index
-- chi ap dung cho direction='inbound' va khi du ca 3 field dinh danh (HD thieu field
-- thi khong the dedup -> bo qua). Save path bao "trung lap" qua safeRpc (loi 23505).
-- (Nguon HD dau vao: giu luong quet Gemini hien co; Sepay KHONG co API dau vao.)
-- Ngay 2026-06-08.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_inbound_invoice
  ON public.finance_invoices (supplier_tax_code, invoice_symbol, invoice_number)
  WHERE direction = 'inbound'
    AND supplier_tax_code IS NOT NULL
    AND invoice_symbol IS NOT NULL
    AND invoice_number IS NOT NULL;
COMMIT;
