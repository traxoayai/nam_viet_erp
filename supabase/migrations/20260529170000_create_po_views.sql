-- View 1: supplier_debt_view
-- Tính công nợ hiện tại của nhà cung cấp từ purchase_orders
CREATE OR REPLACE VIEW supplier_debt_view AS
SELECT 
  s.id AS supplier_id,
  COALESCE(SUM(po.final_amount), 0) AS total_invoiced,
  COALESCE(SUM(po.total_paid), 0) AS total_paid,
  COALESCE(SUM(po.final_amount) - SUM(po.total_paid), 0) AS current_debt
FROM suppliers s
LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.status NOT IN ('CANCELLED', 'draft')
GROUP BY s.id;

-- View 2: product_monthly_sales_view
-- Tính tổng số lượng bán được của mỗi sản phẩm trong 30 ngày qua
CREATE OR REPLACE VIEW product_monthly_sales_view AS
SELECT 
  p.id AS product_id,
  COALESCE(SUM(oi.quantity), 0) AS monthly_sales_qty
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id 
LEFT JOIN orders o ON oi.order_id = o.id 
  AND o.created_at >= NOW() - INTERVAL '30 days'
  AND o.status NOT IN ('cancelled', 'draft')
GROUP BY p.id;
