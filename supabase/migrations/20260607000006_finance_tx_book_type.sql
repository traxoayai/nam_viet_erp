-- finance_transactions.book_type: ghi nhận sổ áp dụng cho phiếu.
-- Ngày 2026-06-07. Idempotent.
BEGIN;

ALTER TABLE public.finance_transactions
  ADD COLUMN IF NOT EXISTS book_type text NOT NULL DEFAULT 'BOTH'
    CHECK (book_type IN ('INTERNAL','TAX','BOTH'));

COMMENT ON COLUMN public.finance_transactions.book_type IS
  'Sổ ghi nhận phiếu: INTERNAL (nội bộ) | TAX (thuế) | BOTH (cả 2). Mặc định BOTH.';

COMMIT;
