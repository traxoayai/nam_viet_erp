-- Gan tai khoan doi ung (chart_of_accounts.account_code) mac dinh cho cac quy tien,
-- de create_invoice_payment / gen_journal_payment|receipt co the ghi so (truoc day
-- fund_accounts.account_id = NULL -> payInvoice khong chay duoc).
-- Idempotent: chi gan khi account_id dang NULL.
--   - Quy tien mat thuc  -> 111 (Tien mat)
--   - Quy ngan hang       -> 112 (Tien gui Ngan hang)
--   - Quy "Can tru cong no" (quy ao): KHONG gan o day — la quy net 131/331, ke toan
--     tu chon TK rieng qua UI (gan 111 se sai ban chat).
-- (Neu can tach tung NH: VCB->1121, OCB->1122... dung TK con — ke toan bo sung sau.)
-- Ngay 2026-06-08.
BEGIN;

UPDATE public.fund_accounts
SET account_id = '111', updated_at = now()
WHERE type = 'cash' AND account_id IS NULL AND name NOT ILIKE '%cấn trừ%';

UPDATE public.fund_accounts
SET account_id = '112', updated_at = now()
WHERE type = 'bank' AND account_id IS NULL;

COMMIT;
