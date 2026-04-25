# Audit: Backfill product_units conversion_rate=1 — 2026-04-25

## Bối cảnh

Migration `20260425010000_backfill_missing_product_units.sql` tự động insert các row
`product_units` cho sản phẩm chưa có đơn vị `wholesale` / `retail`, với
`conversion_rate = 1` (giá trị mặc định an toàn).

**Vấn đề**: Nếu sản phẩm đã có `products.items_per_carton > 1` (ví dụ: 10 viên/hộp, hoặc
24 gói/thùng), thì `conversion_rate = 1` là **sai**. Hậu quả:
- `update_sales_order` / `create_sales_order` gọi `_resolve_conversion_factor_strict()`
  → lấy rate = 1 → `base_quantity_deducted = quantity * 1` thay vì `quantity * 10`
  → **xuất kho sai, tồn kho ảo, undersell âm thầm**.
- FEFO deduct trừ sai số lượng base → báo cáo tồn không khớp thực tế.

## Bước 1 — Audit: tìm row bị backfill sai

Chạy query sau trên **Supabase SQL Editor (prod)** để liệt kê các sản phẩm active có
`product_units.conversion_rate = 1` nhưng `products.items_per_carton > 1`:

```sql
SELECT
    p.id          AS product_id,
    p.sku,
    p.name,
    p.items_per_carton,
    pu.id         AS unit_id,
    pu.unit_name,
    pu.unit_type,
    pu.conversion_rate
FROM products p
JOIN product_units pu ON pu.product_id = p.id
WHERE pu.unit_type IN ('wholesale', 'retail')
  AND pu.conversion_rate = 1
  AND p.items_per_carton > 1
  AND p.status = 'active'
ORDER BY p.items_per_carton DESC, p.sku
LIMIT 200;
```

**Đọc kết quả**: Mỗi dòng là 1 SP bị backfill sai. Cột `items_per_carton` là hệ số
đúng mà `conversion_rate` (wholesale) nên có.

> Lưu ý: `retail` unit thường có `conversion_rate = 1` là đúng (1 viên = 1 base).
> Chỉ `wholesale` mới cần hệ số > 1. Lọc thêm `AND pu.unit_type = 'wholesale'` nếu
> muốn focus.

## Bước 2 — Fix: cập nhật conversion_rate từ items_per_carton

**Chạy DRY-RUN trước** (transaction rollback, không commit):

```sql
BEGIN;

UPDATE product_units pu
SET
    conversion_rate = p.items_per_carton,
    updated_at      = NOW()
FROM products p
WHERE pu.product_id = p.id
  AND pu.unit_type   = 'wholesale'
  AND pu.conversion_rate = 1
  AND p.items_per_carton > 1
  AND p.status = 'active'
RETURNING
    pu.product_id,
    p.sku,
    p.items_per_carton  AS new_factor,
    pu.unit_name;

ROLLBACK; -- đổi thành COMMIT khi đã review xong
```

Review danh sách `RETURNING` → xác nhận với team kinh doanh → đổi `ROLLBACK` thành
`COMMIT` để áp dụng.

## Bước 3 — Xác minh sau fix

```sql
-- Sau khi UPDATE/COMMIT, chạy lại query audit — kết quả phải rỗng (0 rows):
SELECT p.id, p.sku, p.items_per_carton, pu.unit_name, pu.conversion_rate
FROM products p
JOIN product_units pu ON pu.product_id = p.id
WHERE pu.unit_type = 'wholesale'
  AND pu.conversion_rate = 1
  AND p.items_per_carton > 1
  AND p.status = 'active';
```

## Ghi chú nghiệp vụ

- **Chốt với khách hàng B2B**: Nếu đơn hàng nào đã được đặt với SP bị backfill sai
  (trong window giữa apply 010000 và fix hôm nay), cần kiểm tra lại `order_items.conversion_factor`
  để xác định đơn có bị tính sai không.
- **Legacy constraint**: `products.wholesale_unit` (744 PO legacy) — không sửa trực tiếp
  field này, chỉ sửa `product_units.conversion_rate`.
- **Không cần migration**: Fix này thực hiện qua SQL Editor để có thể DRY-RUN và
  review từng SP trước khi commit.
