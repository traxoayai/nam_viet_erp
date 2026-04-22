-- Scan đơn hàng bị trừ kho nhiều hơn quantity đặt hàng.
-- Read-only, an toàn chạy trên production.
-- Context: sau fix double-deduct migration 20260417160000 + 20260418030000.
-- Output: nếu trả 0 rows → không còn case, skip backfill.
--         nếu > 0 rows → cần review với user + revert similar.

WITH order_sums AS (
  SELECT
    oi.order_id,
    o.code AS order_code,
    o.status AS order_status,
    o.created_at,
    oi.product_id,
    SUM(oi.quantity * COALESCE(oi.conversion_factor, 1)) AS ordered_base_qty
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.status IN ('CONFIRMED', 'PACKED', 'SHIPPING', 'DELIVERED', 'COMPLETED')
  GROUP BY oi.order_id, o.code, o.status, o.created_at, oi.product_id
),
txn_sums AS (
  SELECT
    it.ref_id AS order_code,
    it.product_id,
    SUM(ABS(it.quantity)) AS deducted_qty,
    COUNT(*) AS txn_count
  FROM public.inventory_transactions it
  WHERE it.action_group IN ('sale', 'SALE')
    AND it.quantity < 0
    AND COALESCE(it.description, '') NOT LIKE '[REVERTED-DOUBLE-DEDUCT%'
  GROUP BY it.ref_id, it.product_id
)
SELECT
  os.order_code,
  os.order_status,
  os.created_at,
  os.product_id,
  os.ordered_base_qty,
  ts.deducted_qty,
  ts.txn_count,
  (ts.deducted_qty - os.ordered_base_qty) AS overshoot
FROM order_sums os
JOIN txn_sums ts
  ON ts.order_code = os.order_code
  AND ts.product_id = os.product_id
WHERE ts.deducted_qty > os.ordered_base_qty
ORDER BY overshoot DESC;
