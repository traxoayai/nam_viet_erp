-- 20260430100100_add_orders_shipping_fee.sql
-- Phase 1 — Quick Order Mobile Redesign
-- Lưu phí ship snapshot tại thời điểm đặt đơn. Đơn cũ default 0 (không break view).

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_fee numeric NOT NULL DEFAULT 0
  CHECK (shipping_fee >= 0);

COMMENT ON COLUMN public.orders.shipping_fee IS 'Phí ship snapshot lúc đặt đơn. Đơn cũ = 0 (default).';

COMMIT;
