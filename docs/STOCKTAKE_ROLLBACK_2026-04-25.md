# Rollback kiểm kê — Bug "Đủ/OK" không commit (2026-04-25)

## Tóm tắt bug

FE nút **"Đủ / OK"** và **"Bỏ qua (Next)"** trong `InventoryCheckDetail` trước đây chỉ `moveToNextItem` client-side, KHÔNG commit `actual_quantity` xuống DB.

Voice command `CONFIRM/NEXT` cũng cùng lỗi.

Kết quả: `inventory_check_items.actual_quantity = 0, counted_at = NULL` → khi `complete_inventory_check` chạy → tính `diff = 0 - system_quantity` → **XUẤT TRẮNG toàn bộ tồn** (insert `out_adjust -system_quantity` + trừ `inventory_batches`).

Đã đã phát hiện: phiếu **`KK-20260424-032754`** / SP **Salbutamol 4mg TW2 (10 vỉ x 10 viên)** — xuất oan -2900 viên (= 29 hộp × 100). Các SP khác cùng phiếu + các phiếu COMPLETED trước đó có thể cùng ảnh hưởng.

## Hotfix đã deploy

1. Migration `20260425030000_fix_complete_inventory_check_skip_uncounted.sql` — `complete_inventory_check` chỉ xử lý dòng `counted_at IS NOT NULL`. Dòng chưa đếm = giữ nguyên kho.
2. Migration `20260425040000_harden_update_check_item_uom_validation.sql` — `update_inventory_check_item_quantity` raise exception nếu user nhập `wholesale_qty > 0` mà SP thiếu `product_units` type='wholesale' (trước đây silent `rate=1`).
3. Migration `20260425050000_confirm_check_item_matching_rpc.sql` — RPC mới `confirm_check_item_matching(item_id)` set `actual=system, counted_at=NOW()`.
4. FE `InventoryCheckDetail.tsx` nút "Đủ/OK" + voice `CONFIRM/NEXT` call `confirmItemMatching(activeItemId)` trước `moveToNextItem`.

## Audit: liệt kê phiếu + item bị ảnh hưởng

Chạy trên **Supabase SQL Editor**:

### Query A — Phiếu có dòng chưa đếm nhưng đã finalize (xuất oan)

```sql
SELECT
  ic.id            AS check_id,
  ic.code          AS check_code,
  ic.completed_at,
  ic.warehouse_id,
  COUNT(ici.id)    AS affected_items,
  COALESCE(SUM(ici.system_quantity), 0) AS total_base_units_lost
FROM public.inventory_checks ic
JOIN public.inventory_check_items ici ON ici.check_id = ic.id
WHERE ic.status = 'COMPLETED'
  AND ic.completed_at >= NOW() - INTERVAL '60 days'
  AND ici.counted_at IS NULL
  AND COALESCE(ici.actual_quantity, 0) = 0
  AND COALESCE(ici.system_quantity, 0) > 0
GROUP BY ic.id, ic.code, ic.completed_at, ic.warehouse_id
HAVING COUNT(ici.id) > 0
ORDER BY ic.completed_at DESC;
```

Cột `total_base_units_lost` = tổng ĐVCS đã bị xuất oan.

### Query B — Liệt kê `inventory_transactions` xuất oan của 1 phiếu

```sql
SELECT it.id, it.product_id, p.name AS product_name, it.batch_id,
       b.batch_code, it.quantity, it.unit_price, it.description,
       it.created_at
FROM public.inventory_transactions it
JOIN public.products p ON p.id = it.product_id
LEFT JOIN public.batches b ON b.id = it.batch_id
WHERE it.ref_id = 'KK-20260424-032754'  -- ĐỔI code phiếu cần rollback
  AND it.type = 'out_adjust'
  AND it.action_group = 'ADJUST'
ORDER BY it.created_at;
```

Chỉ rollback các dòng `out_adjust` vì `in_adjust` (thừa) là user thực sự nhập số.

**Quan trọng:** Không rollback nếu user đã thực sự đếm + KHỚP 0 (ví dụ đếm được 0 vì hàng mất thật). Đối chiếu với Query A — chỉ rollback items có `counted_at IS NULL`. Nếu `counted_at` có giá trị thì user đã bấm đếm → không phải bug.

## Rollback SQL

Thực hiện trong **1 transaction** trên Supabase SQL Editor. **KHUYẾN CÁO backup DB snapshot trước** (Supabase Dashboard → Database → Backups).

```sql
BEGIN;

-- 1. Chọn phiếu cần rollback (ĐỔI code)
WITH bad_check AS (
  SELECT id, code, warehouse_id
  FROM public.inventory_checks
  WHERE code = 'KK-20260424-032754'
),
-- 2. Lấy items chưa đếm thật nhưng đã bị finalize xuất (bug signature)
bad_items AS (
  SELECT ici.id, ici.product_id, ici.batch_code, ici.system_quantity
  FROM public.inventory_check_items ici
  JOIN bad_check bc ON bc.id = ici.check_id
  WHERE ici.counted_at IS NULL
    AND COALESCE(ici.actual_quantity, 0) = 0
    AND COALESCE(ici.system_quantity, 0) > 0
),
-- 3. Match với inventory_transactions out_adjust cùng ref + product
bad_tx AS (
  SELECT it.id, it.product_id, it.batch_id, it.quantity, it.warehouse_id
  FROM public.inventory_transactions it
  JOIN bad_check bc ON it.ref_id = bc.code
  WHERE it.type = 'out_adjust'
    AND it.action_group = 'ADJUST'
    AND it.product_id IN (SELECT product_id FROM bad_items)
)
-- 4. Cộng lại quantity vào inventory_batches (quantity của out_adjust là số âm)
UPDATE public.inventory_batches ib
SET quantity = ib.quantity + ABS(bt.quantity),
    updated_at = NOW()
FROM bad_tx bt
WHERE ib.warehouse_id = bt.warehouse_id
  AND ib.product_id = bt.product_id
  AND ib.batch_id = bt.batch_id;

-- 5. Xoá các transaction out_adjust oan
DELETE FROM public.inventory_transactions it
USING (
  SELECT it2.id
  FROM public.inventory_transactions it2
  JOIN public.inventory_checks ic ON it2.ref_id = ic.code
  JOIN public.inventory_check_items ici ON ici.check_id = ic.id
    AND ici.product_id = it2.product_id
  WHERE ic.code = 'KK-20260424-032754'  -- ĐỔI code
    AND it2.type = 'out_adjust'
    AND it2.action_group = 'ADJUST'
    AND ici.counted_at IS NULL
    AND COALESCE(ici.actual_quantity, 0) = 0
    AND COALESCE(ici.system_quantity, 0) > 0
) bad_tx_ids
WHERE it.id = bad_tx_ids.id;

-- 6. Re-sync product_inventory cho SP bị ảnh hưởng
UPDATE public.product_inventory pi
SET stock_quantity = COALESCE(batch_sum.total, 0),
    updated_at = NOW()
FROM (
  SELECT ib.product_id, ib.warehouse_id, SUM(ib.quantity) AS total
  FROM public.inventory_batches ib
  WHERE (ib.product_id, ib.warehouse_id) IN (
    SELECT ici.product_id, ic.warehouse_id
    FROM public.inventory_check_items ici
    JOIN public.inventory_checks ic ON ic.id = ici.check_id
    WHERE ic.code = 'KK-20260424-032754'  -- ĐỔI code
      AND ici.counted_at IS NULL
  )
  GROUP BY ib.product_id, ib.warehouse_id
) batch_sum
WHERE pi.product_id = batch_sum.product_id
  AND pi.warehouse_id = batch_sum.warehouse_id;

-- 7. Đánh dấu phiếu đã rollback (tùy chọn — thêm flag vào note)
UPDATE public.inventory_checks
SET note = COALESCE(note, '') || E'\n[ROLLBACK 2026-04-25] Đã hoàn kho ' ||
           (SELECT COUNT(*) FROM public.inventory_check_items
            WHERE check_id = inventory_checks.id AND counted_at IS NULL) ||
           ' dòng chưa đếm.',
    updated_at = NOW()
WHERE code = 'KK-20260424-032754';  -- ĐỔI code

-- Kiểm tra trước khi COMMIT:
--  SELECT code, (SELECT stock_quantity FROM product_inventory
--    WHERE product_id = 260413129 AND warehouse_id = inventory_checks.warehouse_id)
--    AS current_stock
--  FROM inventory_checks WHERE code = 'KK-20260424-032754';
-- Nếu số khớp expected → COMMIT. Ngược lại → ROLLBACK.

COMMIT;  -- hoặc ROLLBACK nếu sai
```

## Rollback multiple phiếu (batch)

Nếu Query A trả nhiều phiếu, lặp query rollback trên với `WHERE ic.code IN (...)` thay vì single code. Nên làm **từng phiếu một** để dễ verify.

## Verify sau rollback

```sql
-- Check thẻ kho SP đã đúng (ví dụ product_id=260413129 Salbutamol)
SELECT it.created_at, it.type, it.quantity, it.ref_id, it.description
FROM public.inventory_transactions it
WHERE it.product_id = 260413129
  AND it.warehouse_id = 1  -- kho B2B hoặc tương ứng
ORDER BY it.created_at DESC
LIMIT 20;

-- Tổng tồn hiện tại
SELECT p.id, p.name, pi.stock_quantity,
       (SELECT SUM(ib.quantity) FROM inventory_batches ib
        WHERE ib.product_id = p.id AND ib.warehouse_id = pi.warehouse_id) AS batch_sum
FROM products p
JOIN product_inventory pi ON pi.product_id = p.id
WHERE p.id = 260413129;
```

`stock_quantity` phải = `batch_sum`. Nếu lệch → re-run bước 6.

## Báo cho user sau rollback

Thông báo các phiếu đã rollback + số lượng hàng đã khôi phục. Yêu cầu:
1. Mở lại từng phiếu (đổi `status = 'DRAFT'` nếu muốn kiểm kê tiếp):
   ```sql
   UPDATE inventory_checks SET status = 'DRAFT', completed_at = NULL, verified_by = NULL
   WHERE code = 'KK-20260424-032754';
   ```
2. Đếm lại các SP bị bỏ sót, bấm "Đủ/OK" (giờ đã commit đúng với hotfix FE).
