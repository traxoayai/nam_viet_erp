# BCTC (Báo Cáo Tài Chính) — Hoàn Thiện Hệ Thống

> Hoàn tất ngày 2026-06-14. TT133 (DNNVV), B01a-DNN format.

## Tổng Quan

**Hệ thống báo cáo tài chính Nam Việt ERP hoàn tất 100%** bao gồm:

1. **Kế toán 2 sổ (Dual-ledger)** — Thực tế (INTERNAL) + Thuế (TAX)
2. **Bảng Cân Đối B01a-DNN** — Balance Sheet theo TT133
3. **Khai Báo VAT** — Tính theo suất thuế (0%, 5%, 10%)
4. **Lưu Chuyển Tiền Tệ** — Tổng hợp dòng tiền
5. **Sự Hòa Trộn (Reconciliation)** — So sánh GL vs BS

---

## Kiến Trúc

### Database Layer (Supabase PostgreSQL)

**Bảng Chính:**
- `journal_entries` — Bút toán (sale, COGS, payment, expense)
- `journal_entry_lines` — Chi tiết từng bút (account_code, debit, credit, book_type)
- `account_balances` — Số dư tài khoản (closing_debit, closing_credit, book_type)
- `accounting_periods` — Kỳ kế toán (allow_posting, allow_editing, is_closed)

**RPC Functions (Hạt nhân Kế toán):**

| RPC | Mục Đích | Input | Output |
|-----|----------|-------|--------|
| `gen_journal_for_sales_order` | Tự động tạo bút toán từ đơn bán | order_id | journal_entries.id |
| `post_journal_entry` | Ghi bút toán vào GL + cập nhật số dư | journal_entry_id | success boolean |
| `close_accounting_period` | Khóa kỳ, tính P&L, chuyển số dư | period_year, month | summary JSON |
| `get_balance_sheet` | Trích xuất Bảng cân đối | period_year, month | array BalanceSheetRow |
| `get_reconciliation_report` | So sánh GL balance vs BS balance | period_year, month, book | array ReconciliationReportRow |

**Định Nghĩa:**
- **GL balance** = SUM(debit - credit) từ journal_entry_lines posted
- **BS balance** = closing_debit - closing_credit từ account_balances
- **Hòa trộn** = GL balance = BS balance → is_reconciled = TRUE

---

### Frontend Layer (React 19 + Ant Design 5)

**Component:** `src/features/finance/components/BctcReportTab.tsx`

**4 Tabs:**

1. **Bảng Cân Đối** (Balance Sheet)
   - Hiển thị tài sản, nợ, vốn theo TT133
   - Verified: Assets = Liabilities + Equity
   - Export PDF

2. **Khai Báo VAT**
   - Tính tổng trước thuế + VAT theo suất (0%, 5%, 10%)
   - Dòng từ sales_invoices

3. **Lưu Chuyển Tiền Tệ**
   - Dòng tiền vào, tiền ra, lưu chuyển thuần

4. **Sự Hòa Trộn** ✨ (Mới)
   - So sánh GL vs BS per account
   - Tag trạng thái: Hòa Trộn (xanh) / Chênh Lệch (đỏ)
   - Cho phép chọn sổ (INTERNAL/TAX)
   - Thống kê tóm tắt (tổng TK, số hòa trộn, chênh lệch)

---

## Quy Trình Kế Toán

### Phát Sinh Bút Toán

**Tự động (RPC gen_journal_for_sales_order):**
```
Sales Order
  ↓
gen_journal_for_sales_order(order_id)
  → journal_entry { entry_date, reference_id, status='draft' }
  → journal_entry_lines {
      {account: 1121 (AR), debit: 1000, book_type: BOTH}
      {account: 511 (Revenue), credit: 1000, book_type: BOTH}
      {account: 632 (COGS), debit: 700, book_type: INTERNAL}
      {account: 1511 (Inventory), credit: 700, book_type: INTERNAL}
    }
  ↓
DRAFT status → chờ approval
```

**Ghi Sổ (post_journal_entry):**
```
Nhân viên: "Ghi sổ" button
  → post_journal_entry(journal_entry_id)
  → INSERT journal_entry_lines → GL
  → UPDATE account_balances (closing_debit/credit)
  → status = 'posted'
```

**Khóa Kỳ (close_accounting_period):**
```
close_accounting_period(year, month)
  → Tính P&L entry (Revenue - Expense → Profit/Loss)
  → Chuyển số dư BS accounts → năm tới
  → period.is_closed = TRUE → cấm posting
```

---

## Test Coverage

### RPC Integration Tests

**File:** `tests/rpc/bctc-complete-flow.test.ts` (989 lines)

**9 tests PASS:**

**Suite 1: Balance Sheet (5 tests)**
1. ✅ Gen journal từ sales order → revenue 511, COGS 632
2. ✅ Post journal entry → GL cập nhật, số dư account_balances thay đổi
3. ✅ Assets = Liabilities + Equity (verify công thức)
4. ✅ Period lock → cấm posting bút toán đã closed
5. ✅ BCTC export → numbers match expected (revenue ≈1.33B, COGS ≈1.07B)

**Suite 2: Reconciliation (4 tests)**
6. ✅ GL = BS → reconciled status TRUE
7. ✅ GL ≠ BS → detected unreconciled, show difference
8. ✅ Multi-account recon (partial reconciled, partial unreconciled)
9. ✅ Reconciliation summary stats (total, reconciled count)

---

## Dữ Liệu Seed (TT133 Chart of Accounts)

**Tài Sản (Assets: 1xxx):**
- 1121: Phải thu tiền bán hàng (AR)
- 1511: Kho hàng (Inventory)

**Nợ (Liabilities: 2xxx):**
- 2131: Phải trả tiền mua hàng (AP)

**Vốn (Equity: 3xxx):**
- 3100: Vốn chủ sở hữu (Retained Earnings)

**Doanh Thu (Revenue: 5xxx):**
- 511: Doanh thu bán hàng

**Chi Phí (Expense: 6xxx):**
- 632: Giá vốn hàng bán (COGS)

---

## Kế Hoạch Tiếp Theo (Phase 2+)

Công ty có thể mở rộng:
1. **Sử dụng TT99/2025** — Nếu cần chế độ "đầy đủ" thay vì TT133
2. **Báo cáo nâng cao** — Cash flow statement dạng间接法, 5-year trend
3. **Tích hợp SePay** — Tự động match bank transactions vs payment GL entries
4. **Quản lý Tax** — Tính nợ/mạn thuế, tờ khai điện tử
5. **Audit Trail** — Lưu log ai/khi/gì thay đổi report numbers

---

## Tài Liệu Liên Quan

- `ARCHITECTURE.md` — Cấu trúc folder, patterns chung
- `BUSINESS_LOGIC.md` — Chi tiết nghiệp vụ, RPC gotchas
- `docs/PRODUCTION_MIGRATION_PLAN.md` — Chuyển dữ liệu prod

---

**Status:** ✅ PRODUCTION READY — Ready deploy 2026-06-14
