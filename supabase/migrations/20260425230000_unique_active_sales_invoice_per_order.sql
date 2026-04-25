-- Prevent concurrent duplicate e-invoices for the same order.
-- A cancelled invoice can be replaced; every non-cancelled invoice reserves the order.
-- Date: 2026-04-25

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sales_invoices_active_order_id
ON public.sales_invoices(order_id)
WHERE order_id IS NOT NULL
  AND status <> 'cancelled';

COMMIT;
