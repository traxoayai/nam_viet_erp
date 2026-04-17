-- Function to cancel unpaid orders after 24 hours
CREATE OR REPLACE FUNCTION public.cancel_unpaid_orders_after_24h()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'CANCELLED',
      updated_at = NOW(),
      note = COALESCE(note, '') || ' [Tự động hủy do chờ thanh toán quá 24h]'
  WHERE status = 'PENDING'
    AND payment_status = 'unpaid'
    AND created_at < (NOW() - INTERVAL '24 hours');
END;
$$;

-- Schedule the cron job (requires pg_cron extension)
-- Runs every hour at minute 0
SELECT cron.schedule(
  'cancel-unpaid-orders-hourly', -- name of the cron job
  '0 * * * *',                   -- every hour
  'SELECT public.cancel_unpaid_orders_after_24h()'
);
