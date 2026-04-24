-- BLOCKER FIX: `promotion_usages.discount_amount` column thiếu trong schema gốc
-- (20260120000000_remote_schema.sql line 15688-15694 không có column này) nhưng
-- 20+ migration (bao gồm 20260408100000, 20260411*, 20260412*, 20260416*,
-- 20260417*, 20260423200200, 20260424000000/000100) đều INSERT vào
-- `(promotion_id, customer_id, order_id, discount_amount)`.
--
-- → Bất kỳ đơn B2B dùng voucher → RPC create_sales_order CRASH
--   "column discount_amount does not exist" trừ khi prod đã ALTER manual ngoài migration.
--
-- Migration idempotent: IF NOT EXISTS để no-op nếu prod đã có.
-- Date: 2026-04-24
-- ============================================================================

BEGIN;

ALTER TABLE public.promotion_usages
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0;

-- Index để lookup nhanh báo cáo voucher
CREATE INDEX IF NOT EXISTS idx_promotion_usages_order_id
  ON public.promotion_usages(order_id);

CREATE INDEX IF NOT EXISTS idx_promotion_usages_promotion_id
  ON public.promotion_usages(promotion_id);

NOTIFY pgrst, 'reload schema';

COMMIT;
