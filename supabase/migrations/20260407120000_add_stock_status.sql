-- ============================================================
-- Thêm stock_status vào products
-- Admin có thể set: in_stock / out_of_stock
-- Mặc định: in_stock
-- ============================================================

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS stock_status text DEFAULT 'in_stock'
CHECK (stock_status IN ('in_stock', 'out_of_stock'));

-- Tất cả SP hiện tại = còn hàng
UPDATE products SET stock_status = 'in_stock' WHERE stock_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_stock_status ON public.products(stock_status);

-- Thêm low_stock vào constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_stock_status_check;
ALTER TABLE products ADD CONSTRAINT products_stock_status_check
  CHECK (stock_status IN ('in_stock', 'low_stock', 'out_of_stock'));

-- Seed product_inventory: mặc định 999 cho tất cả SP active vào warehouse chính
INSERT INTO product_inventory (product_id, warehouse_id, stock_quantity, min_stock)
SELECT p.id, 1, 999, 10
FROM products p
WHERE p.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM product_inventory pi WHERE pi.product_id = p.id AND pi.warehouse_id = 1)
ON CONFLICT DO NOTHING;
