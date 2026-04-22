# Audit Scripts

Read-only SQL queries để scan production tìm data integrity issues. An toàn chạy trên prod.

## `scan_double_deduct.sql`
Tìm đơn có tổng `inventory_transactions.quantity` (action_group sale, qty<0, không bị REVERTED) lớn hơn tổng `order_items.quantity × conversion_factor`. Dấu hiệu double-deduct.

**Chạy:**
```bash
npx supabase db query --linked -f scripts/audit/scan_double_deduct.sql
```

**Nếu rows > 0:** Xem pattern txn (type+action_group), quyết định revert migration theo mẫu `20260417160000` hoặc `20260423200300`.

## `scan_pending_with_deduction.sql`
Tìm đơn `status='PENDING'` đã có txn sale (trừ kho sớm). Nếu > 0, cron `cancel_unpaid_orders_after_24h` sẽ cancel mà KHÔNG restock → mất tồn.

**Chạy:**
```bash
npx supabase db query --linked -f scripts/audit/scan_pending_with_deduction.sql
```

## Output snapshots
- `double_deduct_scan_20260422.json`, `pending_with_deduction_scan_20260422.json` — kết quả lúc audit lần đầu.

## Khi nào rerun?
- Sau mọi thay đổi flow create_sales_order / confirm_outbound_packing.
- Mỗi 2 tuần để sanity check regression.
- Nếu nhân viên kho báo chênh lệch tồn kho bất thường.
