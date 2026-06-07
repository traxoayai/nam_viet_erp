# Runbook Deploy Prod — Hệ Hạch Toán + BCTC + Bản đồ Hành chính

> **Nhánh**: `feat/he-hach-toan-backend` (HEAD `e81ef73`)
> **Ngày soạn**: 2026-06-08
> **Phạm vi**: 12 migration kế toán/BCTC/địa lý CHƯA deploy + 1 seed data + regen types
> **Risk**: TRUNG BÌNH — thêm bảng/function/index, sửa RLS grant, KHÔNG DROP/DELETE data.
> Có bút toán tiền (gen_journal) → smoke test kỹ. Đọc kèm [PRODUCTION_MIGRATION_PLAN.md](PRODUCTION_MIGRATION_PLAN.md) cho pattern backup/rollback chung.

> ⚠️ **ĐANG BỊ CHẶN** bởi migration drift (xem Bước 1). KHÔNG chạy `db push` cho tới khi gỡ xong drift. Mọi lệnh dưới đây để người có quyền prod thực thi — runbook KHÔNG tự chạy.

---

## 0. Prerequisites

```bash
# Trong thư mục nam_viet_erp
export SUPABASE_ACCESS_TOKEN="sbp_..."                 # PAT (Dashboard → Account → Access Tokens)
export PROD_DB_PASSWORD="..."                            # mật khẩu DB prod
export PROD_DB="postgresql://postgres:${PROD_DB_PASSWORD}@db.iudkexocalqdhxuyjacu.supabase.co:5432/postgres"
export SUPABASE_SERVICE_ROLE_KEY="..."                  # cho bước seed admin units
# Project ref: iudkexocalqdhxuyjacu
npx supabase link --project-ref iudkexocalqdhxuyjacu    # nếu chưa link
```

**Checklist trước khi bắt đầu:**
- [ ] Đã backup prod (Dashboard "Download backup" hoặc `pg_dump "$PROD_DB" --no-owner -f backup_pre_accounting.sql`)
- [ ] Đã báo team ngừng thao tác (~15 phút)
- [ ] Đã gỡ migration drift (Bước 1) — **bắt buộc, đang chặn**

---

## 1. ⚠️ GỠ MIGRATION DRIFT (blocker hiện tại)

`supabase db push --dry-run` báo **"Remote migration versions not found in local"**: prod ghi nhận ~15 version trong `supabase_migrations.schema_migrations` mà repo KHÔNG có file tương ứng (team apply qua cơ chế khác — MCP/Dashboard/squash). Push bị chặn cho tới khi lịch sử local↔remote khớp.

> Repo HIỆN CÓ 3 file team tháng 6: `20260604120000`, `20260604130000`, `20260606120000`. Các version remote bị thiếu là KHÁC những file này. **Phải xem phân kỳ thực tế trước, không đoán version.**

### 1.1 Xem phân kỳ thực
```bash
npx supabase migration list   # cột Local vs Remote — version nào chỉ có Remote = phantom
```

### 1.2 Chọn cách gỡ (theo thứ tự ưu tiên)

**Cách A — Lấy file thật từ team (AN TOÀN NHẤT).**
Xin 15 file `.sql` ứng với version remote-only → đặt vào `supabase/migrations/` → `migration list` khớp → sang Bước 2. Không repair, không mất lịch sử.

**Cách B — Repair lịch sử (chỉ khi không lấy được file).**
Với MỖI version chỉ-có-Remote, xác nhận schema nó tạo ĐÃ tồn tại trên prod (query `pg_proc`/`information_schema`), rồi đánh dấu để CLI bỏ qua:
```bash
npx supabase migration repair --status reverted <version_remote_only>
```
- `--status reverted` chỉ sửa BẢNG THEO DÕI, **KHÔNG** đụng schema thật → không mất data.
- ⚠️ KHÔNG dùng `--include-all`. KHÔNG `db pull` (tạo squash lớn, dễ xung đột file branch).
- Sau repair, chạy lại `migration list` xác nhận sạch.

**Cách C — KHÔNG làm**: `db reset`, `--no-backup`, xoá volume, `db pull` mù. (Vi phạm guard "tuyệt đối không xoá DB".)

### 1.3 Lưu ý đánh số
Có khoảng trống `20260608000001` (nhảy từ `20260607000008` → `20260608000002`). **Bình thường**, không thiếu file — đừng tưởng sót.

---

## 2. Apply Migrations

Sau khi drift sạch, push toàn bộ (CLI tự apply theo thứ tự version, mỗi file 1 transaction):
```bash
npx supabase db push          # chạy --dry-run trước để xác nhận đúng 12 file dưới
```

**Đúng 12 file sẽ apply (000001..000007 đã có trên prod từ trước):**

| # | Migration | Tạo gì |
|---|-----------|--------|
| 1 | `20260607000008_bctc_reports` | RPC `get_trial_balance`, `get_income_statement` |
| 2 | `20260608000002_bctc_line_mapping` | Bảng `bctc_line_mapping` (B01a) + seed chỉ tiêu |
| 3 | `20260608000003_get_balance_sheet` | RPC `get_balance_sheet` |
| 4 | `20260608000004_get_vat_declaration` | RPC `get_vat_declaration` |
| 5 | `20260608000005_get_cash_flow` | RPC `get_cash_flow` |
| 6 | `20260608000006_accounting_write_permissions` | Seed 3 key `finance.post_journal/void_journal/close_period` + grant Admin/Kế Toán + siết `rpc_access_rules` |
| 7 | `20260608000007_gen_journal_for_sales_order` | RPC `gen_journal_for_sales_order` (v1) |
| 8 | `20260608000008_seed_fund_account_codes` | UPDATE `fund_accounts.account_id` (cash→111, bank→112) |
| 9 | `20260608000009_administrative_units_2025` | Bảng `provinces`(34)+`wards`(3321) + `idx_wards_province` + `shipping_addresses.district_code` nullable |
| 10 | `20260608000010_inbound_invoice_dedup` | UNIQUE INDEX `uniq_inbound_invoice` |
| 11 | `20260608000011_gen_journal_sales_order_v2` | REPLACE `gen_journal_for_sales_order` (v2: advisory lock + status-gate + idempotent per doc_type + tách ship 5113) |
| 12 | `20260608000012_fix_kt_perm_and_geo_grants` | Grant Kế Toán `finance.view_balance` + REVOKE ghi `provinces`/`wards` |

> **Fallback** nếu `db push` vẫn vướng: apply từng file `psql "$PROD_DB" -f supabase/migrations/<file>.sql` THEO ĐÚNG THỨ TỰ trên (đặc biệt #11 phải sau #7).

---

## 3. Verify SQL (sau apply)

```sql
-- Tables + index mới
SELECT to_regclass('public.bctc_line_mapping') IS NOT NULL AS bctc_ok,
       to_regclass('public.provinces')        IS NOT NULL AS provinces_ok,
       to_regclass('public.wards')            IS NOT NULL AS wards_ok;
SELECT (SELECT count(*) FROM provinces) AS n_prov,        -- mong: 0 (seed ở Bước 4) hoặc 34 nếu đã seed
       (SELECT count(*) FROM bctc_line_mapping) AS n_bctc; -- mong: > 0
SELECT indexname FROM pg_indexes WHERE indexname IN ('uniq_inbound_invoice','idx_wards_province');

-- RPC mới (mong 7 dòng)
SELECT proname FROM pg_proc WHERE proname IN
 ('get_trial_balance','get_income_statement','get_balance_sheet',
  'get_vat_declaration','get_cash_flow','gen_journal_for_sales_order') ORDER BY 1;

-- gen_journal_for_sales_order PHẢI là v2 (có advisory lock + status-gate)
SELECT pg_get_functiondef('public.gen_journal_for_sales_order(uuid)'::regprocedure) LIKE '%pg_advisory_xact_lock%' AS has_lock,
       pg_get_functiondef('public.gen_journal_for_sales_order(uuid)'::regprocedure) LIKE '%5113%' AS has_ship_split;

-- Phân quyền: 3 key write tồn tại + Kế Toán có view_balance
SELECT key FROM public.permissions WHERE key IN
 ('finance.post_journal','finance.void_journal','finance.close_period') ORDER BY 1;  -- 3 dòng
SELECT r.name FROM role_permissions rp JOIN roles r ON r.id=rp.role_id
 WHERE r.name='Kế Toán' AND rp.permission_key='finance.view_balance';                 -- 1 dòng

-- fund_accounts đã gán TK
SELECT type, account_id FROM fund_accounts WHERE account_id IS NOT NULL LIMIT 5;

-- Geo tables: authenticated/anon CHỈ còn SELECT (đã REVOKE ghi)
SELECT grantee, privilege_type FROM information_schema.role_table_grants
 WHERE table_schema='public' AND table_name='provinces'
   AND grantee IN ('authenticated','anon') AND privilege_type<>'SELECT';              -- 0 dòng
```

---

## 4. Seed dữ liệu bản đồ hành chính (prod)

`provinces`/`wards` là **dữ liệu tham chiếu công khai** (KHÔNG phải data khách) → seed an toàn. Chạy 1 lần:
```bash
node scripts/seed-admin-units.mjs        # đọc SUPABASE_SERVICE_ROLE_KEY; upsert 34 tỉnh + 3321 xã
```
Verify: `SELECT count(*) FROM provinces;` → 34, `SELECT count(*) FROM wards;` → 3321.

---

## 5. Regen types (canonical từ prod) + deploy FE

```bash
npm run typegen          # supabase gen types --local; sau deploy local==prod nên output khớp prod
npm run build            # tsc + vite build — phải xanh
# Deploy FE theo pipeline hiện hành (Vercel/host của team)
```

---

## 6. Smoke Test (sau deploy)

| # | Test | Expected |
|---|------|----------|
| 1 | Mở **Báo cáo TC** → 5 tab (KQKD, CĐTK, **CĐKT B01a**, **Bảng kê thuế**, **LCTT**) | Load số liệu, không lỗi RPC |
| 2 | POS bán 1 đơn tiền mặt | Đơn DELIVERED; có bút toán NHÁP INTERNAL: Nợ131/Có5111 + Nợ632/Có156 |
| 3 | B2B: đơn → đóng gói (PACKED) | Sinh bút toán bán+giá vốn (status-gate cho qua) |
| 4 | B2B: đơn QUOTE/DRAFT | KHÔNG sinh bút toán (status-gate chặn) |
| 5 | Đóng gói lại đơn cũ / gọi lại | KHÔNG nhân đôi bút toán (idempotent + advisory lock) |
| 6 | Đơn có phí ship | DT vào 5111 (final−ship), phí ship vào **5113** |
| 7 | User **Kế Toán** mở Sổ Nhật ký + BCTC | Vào được (có `finance.view_balance`) |
| 8 | User **Kế Toán** bấm Post bút toán | OK (có `finance.post_journal`) |
| 9 | User KHÔNG có quyền journal bấm Post | "Forbidden" (không silent) |
| 10 | Nhập trùng HĐ đầu vào (cùng MST+ký hiệu+số) | Bị chặn bởi `uniq_inbound_invoice` |
| 11 | Form chọn địa chỉ (nếu đã wire) | Tỉnh→Xã load từ DB |

---

## 7. Rollback

- **1 file fail**: tự rollback trong transaction → DB nguyên trạng, sửa file rồi push lại.
- **Sai sau deploy**: restore backup (Bước 0) hoặc Dashboard → Restore.
- **Chỉ 1 function sai**: `CREATE OR REPLACE` lại version cũ từ backup schema (vd hạ `gen_journal_for_sales_order` v2→v1 nếu cần).
- Bút toán đã sinh sai: bút toán ở trạng thái **NHÁP**, dùng `void_journal_entry` (không xoá cứng) — KHÔNG DELETE thẳng `journal_entries`.

---

## 8. Việc CÒN CHẶN / chờ quyết định (KHÔNG nằm trong deploy này)

- **PR**: gh hiện không phải collaborator `traxoayai/nam_viet_erp` → mở tay. Nội dung soạn sẵn ở `d:/tmp/nv/pr_body.md` (ngoài repo). Link: `https://github.com/traxoayai/nam_viet_erp/pull/new/feat/he-hach-toan-backend`.
- **Viettel Post**: chờ token + bảng mapping gov-code↔VTP (VTP 3 cấp, ID nội bộ riêng).
- **GDT auto-fetch HĐ đầu vào**: chờ credential thuế (Sepay KHÔNG hỗ trợ HĐ vào).
- **Quyết định PM/kế toán**: hàng tặng (is_gift) COGS 632 vs 641 · base thuế cho `get_vat_declaration` (hiện dùng `items_json.unit_price`, **chưa khai thuế thật được**) · wire địa chỉ free-text→structured + FK + migrate địa chỉ cũ · dedup HĐ lọt khi thiếu 1/3 field · outbox/retry khi kỳ đã khoá.
