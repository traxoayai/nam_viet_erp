-- Scan đơn status='PENDING' mà đã có inventory_transactions sale (qty<0).
-- Read-only, an toàn chạy trên production.
-- Nếu có kết quả → cron cancel_unpaid_orders_after_24h sẽ cancel mà KHÔNG restock
-- → mất tồn kho thật. Cần thêm restock logic vào cron.

SELECT
  o.code,
  o.status,
  o.payment_status,
  o.created_at,
  o.customer_id,
  c.name AS customer_name,
  COUNT(it.id) AS deduct_txn_count,
  SUM(ABS(it.quantity)) AS total_deducted_qty,
  ROUND(EXTRACT(EPOCH FROM (NOW() - o.created_at))/3600.0, 1) AS age_hours
FROM public.orders o
LEFT JOIN public.customers_b2b c ON c.id = o.customer_id
JOIN public.inventory_transactions it
  ON it.ref_id = o.code
  AND it.action_group IN ('sale', 'SALE')
  AND it.quantity < 0
  AND COALESCE(it.description, '') NOT LIKE '[REVERTED%'
WHERE o.status = 'PENDING'
GROUP BY o.code, o.status, o.payment_status, o.created_at, o.customer_id, c.name
ORDER BY o.created_at DESC;
