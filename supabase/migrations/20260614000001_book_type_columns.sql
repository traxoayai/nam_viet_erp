-- Add book_type column to account_balances for dual-ledger tracking (INTERNAL | TAX | BOTH)
ALTER TABLE account_balances
ADD COLUMN IF NOT EXISTS book_type VARCHAR(20) DEFAULT 'BOTH'
  CHECK (book_type IN ('INTERNAL', 'TAX', 'BOTH'));

-- Add book_type column to finance_transactions if not exists
-- (may already exist in remote schema)
ALTER TABLE finance_transactions
ADD COLUMN IF NOT EXISTS book_type VARCHAR(20) DEFAULT 'BOTH'
  CHECK (book_type IN ('INTERNAL', 'TAX', 'BOTH'));

-- Create UNIQUE index for account_balances per book_type
-- Ensures one balance per account/period/book combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_balances_unique_per_book
ON account_balances(account_id, period_id, book_type);

-- Update RLS policies to support book_type filtering (if any)
-- Current implementation: auth.uid() IS NOT NULL checks remain valid
DROP POLICY IF EXISTS "Users view account balances" ON account_balances;
CREATE POLICY "Users view balances per book" ON account_balances
  FOR SELECT USING (auth.uid() IS NOT NULL);
