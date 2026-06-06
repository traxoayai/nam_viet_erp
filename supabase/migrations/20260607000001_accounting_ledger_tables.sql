-- Hệ hạch toán: bảng sổ cái kép (journal) + kỳ + số dư. TT133, 2 sổ (INTERNAL/TAX).
-- Ngày 2026-06-07. Idempotent. RLS bật. KHÔNG đụng dữ liệu giao dịch hiện có.
BEGIN;

-- 1. Kỳ kế toán (tháng), theo sổ
CREATE TABLE IF NOT EXISTS public.accounting_periods (
  id          bigserial PRIMARY KEY,
  book        text NOT NULL CHECK (book IN ('INTERNAL','TAX')),
  year        int  NOT NULL,
  month       int  NOT NULL CHECK (month BETWEEN 1 AND 12),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_at   timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz,
  UNIQUE (book, year, month)
);

-- 2. Đầu bút toán
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id              bigserial PRIMARY KEY,
  book            text NOT NULL CHECK (book IN ('INTERNAL','TAX')),
  entry_date      date NOT NULL,
  period_id       bigint NOT NULL REFERENCES public.accounting_periods(id),
  doc_type        text NOT NULL CHECK (doc_type IN ('purchase','sale','cogs','receipt','payment','closing')),
  source_ref_type text,
  source_ref_id   text,
  description     text,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','void')),
  total_debit     numeric NOT NULL DEFAULT 0,
  total_credit    numeric NOT NULL DEFAULT 0,
  created_by      uuid,
  posted_by       uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  posted_at       timestamptz
);
CREATE INDEX IF NOT EXISTS idx_je_book_period ON public.journal_entries(book, period_id);
CREATE INDEX IF NOT EXISTS idx_je_source     ON public.journal_entries(source_ref_type, source_ref_id);
CREATE INDEX IF NOT EXISTS idx_je_status     ON public.journal_entries(status);

-- 3. Dòng bút toán
CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id          bigserial PRIMARY KEY,
  entry_id    bigint NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id  uuid NOT NULL REFERENCES public.chart_of_accounts(id),
  debit       numeric NOT NULL DEFAULT 0 CHECK (debit  >= 0),
  credit      numeric NOT NULL DEFAULT 0 CHECK (credit >= 0),
  partner_id  text,
  description text,
  line_no     int NOT NULL DEFAULT 1,
  CHECK (NOT (debit > 0 AND credit > 0))
);
CREATE INDEX IF NOT EXISTS idx_jel_entry   ON public.journal_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account ON public.journal_entry_lines(account_id);

-- 4. Số dư tài khoản theo kỳ
CREATE TABLE IF NOT EXISTS public.account_balances (
  id              bigserial PRIMARY KEY,
  book            text NOT NULL CHECK (book IN ('INTERNAL','TAX')),
  account_id      uuid NOT NULL REFERENCES public.chart_of_accounts(id),
  period_id       bigint NOT NULL REFERENCES public.accounting_periods(id),
  opening_debit   numeric NOT NULL DEFAULT 0,
  opening_credit  numeric NOT NULL DEFAULT 0,
  period_debit    numeric NOT NULL DEFAULT 0,
  period_credit   numeric NOT NULL DEFAULT 0,
  closing_debit   numeric NOT NULL DEFAULT 0,
  closing_credit  numeric NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (book, account_id, period_id)
);

-- 5. Sửa bảng có sẵn (idempotent)
ALTER TABLE public.fund_accounts
  ADD COLUMN IF NOT EXISTS account_id text REFERENCES public.chart_of_accounts(account_code);
-- payment_status: UNPAID/PARTIAL/PAID (cột MỚI, chưa deploy prod → đổi an toàn)
-- Nếu cột chưa tồn tại: ADD với CHECK mới luôn
-- Nếu đã tồn tại với CHECK cũ: drop constraint cũ, migrate values, add CHECK mới
DO $$
BEGIN
  -- Thêm cột nếu chưa có (lần đầu apply)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='finance_invoices' AND column_name='payment_status'
  ) THEN
    ALTER TABLE public.finance_invoices
      ADD COLUMN payment_status text NOT NULL DEFAULT 'UNPAID'
        CHECK (payment_status IN ('UNPAID','PARTIAL','PAID'));
  ELSE
    -- Xóa CHECK constraint cũ (nếu có)
    ALTER TABLE public.finance_invoices
      DROP CONSTRAINT IF EXISTS finance_invoices_payment_status_check;
    -- Migrate giá trị cũ sang mới
    UPDATE public.finance_invoices SET payment_status = 'UNPAID'   WHERE payment_status = 'chua_tt';
    UPDATE public.finance_invoices SET payment_status = 'PARTIAL'  WHERE payment_status = 'tt_mot_phan';
    UPDATE public.finance_invoices SET payment_status = 'PAID'     WHERE payment_status = 'da_tt';
    -- Thêm CHECK mới
    ALTER TABLE public.finance_invoices
      ADD CONSTRAINT finance_invoices_payment_status_check
        CHECK (payment_status IN ('UNPAID','PARTIAL','PAID'));
    -- Đổi DEFAULT
    ALTER TABLE public.finance_invoices
      ALTER COLUMN payment_status SET DEFAULT 'UNPAID';
  END IF;
END $$;
ALTER TABLE public.finance_invoices
  ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;

-- 6. RLS
ALTER TABLE public.accounting_periods   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_balances     ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY acc_periods_read ON public.accounting_periods  FOR SELECT TO authenticated USING (true);
  CREATE POLICY acc_je_read      ON public.journal_entries     FOR SELECT TO authenticated USING (true);
  CREATE POLICY acc_jel_read     ON public.journal_entry_lines FOR SELECT TO authenticated USING (true);
  CREATE POLICY acc_bal_read     ON public.account_balances    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT ON public.accounting_periods, public.journal_entries,
               public.journal_entry_lines, public.account_balances TO authenticated;
GRANT ALL    ON public.accounting_periods, public.journal_entries,
               public.journal_entry_lines, public.account_balances TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

COMMIT;
