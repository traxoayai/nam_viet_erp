-- Seed inventory_batches cho 2,770 sản phẩm "ma" (product_inventory = 999, inventory_batches = trống)
-- Đổi stock từ 999 → 99 đơn vị cơ sở (base unit)
-- Tạo 1 lô mặc định "INIT-260413" cho mỗi sản phẩm
-- 2026-04-13

BEGIN;

-- A. Tạo batch (lô hàng) cho mỗi sản phẩm chưa có batch
INSERT INTO batches (product_id, batch_code, expiry_date, inbound_price, created_at)
SELECT
    pi.product_id,
    'INIT-260413',
    CURRENT_DATE + INTERVAL '1 year',
    COALESCE(p.actual_cost, 0),
    NOW()
FROM product_inventory pi
JOIN products p ON pi.product_id = p.id
WHERE pi.stock_quantity = 999
  AND pi.warehouse_id = 1
  AND NOT EXISTS (
      SELECT 1 FROM inventory_batches ib
      WHERE ib.product_id = pi.product_id AND ib.warehouse_id = pi.warehouse_id AND ib.quantity > 0
  )
  AND NOT EXISTS (
      SELECT 1 FROM batches b
      WHERE b.product_id = pi.product_id AND b.batch_code = 'INIT-260413'
  );

-- B. Tạo inventory_batches = 99 cho warehouse 1
INSERT INTO inventory_batches (warehouse_id, product_id, batch_id, quantity, updated_at)
SELECT
    1,
    b.product_id,
    b.id,
    99,
    NOW()
FROM batches b
JOIN product_inventory pi ON b.product_id = pi.product_id AND pi.warehouse_id = 1
WHERE b.batch_code = 'INIT-260413'
  AND pi.stock_quantity = 999
  AND NOT EXISTS (
      SELECT 1 FROM inventory_batches ib
      WHERE ib.warehouse_id = 1 AND ib.product_id = b.product_id AND ib.batch_id = b.id
  );

-- C. Update product_inventory: 999 → 99
UPDATE product_inventory pi
SET stock_quantity = 99, updated_at = NOW()
WHERE pi.stock_quantity = 999
  AND pi.warehouse_id = 1
  AND EXISTS (
      SELECT 1 FROM inventory_batches ib
      WHERE ib.product_id = pi.product_id AND ib.warehouse_id = pi.warehouse_id AND ib.quantity = 99
  );

COMMIT;
