# Thiết kế: Hoạt chất + Phân loại thuốc + Ma trận quyền bán (Phase 1)

> **Ngày:** 2026-06-01 · **Project:** `nam_viet_erp` · **Trạng thái:** Design (đã qua review đa góc) — chờ duyệt
> **Phase 2 (spec riêng sau):** Bảng "loại bệnh" + đơn thuốc mẫu (hạ tầng `prescription_templates` đã có sẵn).

## 0. Nhật ký review (đã sửa so với bản nháp đầu)

Spec này đã qua review 4 góc (pháp lý / thiết kế DB / khớp codebase / completeness). Các sửa chính:

- **Pháp lý:** tách thuốc kiểm soát đặc biệt thành 3 nhóm quyền bán (phối hợp / hạn chế / phóng xạ) thay vì gộp một; bỏ `essential` khỏi rule_key, thay bằng cờ `allowed_if_essential` để tránh rò sang tuyến khác; sửa mô tả TT 12/2025 và căn cứ điều luật (Điều 2 + 34, không phải 38).
- **Logic:** `resolve_rule_key` viết lại thành **bảng quyết định vét cạn**; thêm `rule_key = 'unclassified'` (không gộp NULL vào `otc`); sửa `requires_prescription` tham chiếu đúng `product_regulatory.prescription_class`.
- **DB:** chuẩn hóa PK = `GENERATED ALWAYS AS IDENTITY`; thêm trigger `handle_updated_at`; ràng buộc `rule_key` bằng CHECK; thêm index cột lọc; `classified_by` FK `auth.users`; CHECK chống chuỗi rỗng / hàm lượng âm / cờ kiểm soát chỉ áp cho thuốc; idempotent seed + policy.
- **Backfill:** bỏ backfill default row; dùng **lazy + trigger + LEFT JOIN COALESCE**.
- **Khớp codebase:** seed dạng bào chế khớp `product_dosage_label()`; form sản phẩm ở `src/pages/inventory/ProductFormPage.tsx`; chốt permission; thêm vào scope chỗ set `outlet_type` cho kho.
- **Scope:** tách Phase 1 thành **3 implementation plan** tuần tự.

## 1. Bối cảnh & mục tiêu

Yêu cầu nghiệp vụ (từ chủ đầu tư):

1. Tạo **bảng hoạt chất** để gán cho sản phẩm.
2. Hệ **phân loại thuốc** phục vụ quy định "cơ sở nào được bán loại nào" (nhà thuốc / quầy thuốc).
3. Điểm mấu chốt: *cùng hoạt chất nhưng khác **dạng bào chế / đường dùng / hàm lượng** thì có thể khác nhóm phân loại* (ví dụ Cefixim 100: tiêm = kê đơn → quầy không bán; viên nén / bột pha uống = quầy + nhà thuốc; thuốc hít = chỉ nhà thuốc).

**Mục tiêu Phase 1:** chuẩn hóa hoạt chất (M-N, có hàm lượng); đặt **cờ phân loại ở cấp sản phẩm/SKU** (theo số đăng ký), không ở hoạt chất; **ma trận quyền bán cấu hình được**; **UI gán hoạt chất + phân loại**. Đợt này **chỉ lưu + hiển thị**, chưa chặn POS (đã thiết kế sẵn hàm enforcement để bật sau).

## 2. Phạm vi

**Trong phạm vi (Phase 1):**

- Migrations: `active_ingredients`, `product_active_ingredients`, `dosage_forms`, `routes_of_administration`, `product_regulatory`, `selling_rules`; `ALTER warehouses ADD outlet_type`.
- Hàm Postgres: `resolve_selling_rule_key(product_id)` + `can_outlet_sell(outlet_type, product_id)` (Phase 1 chỉ dùng để **hiển thị**, chưa gắn vào POS).
- Trigger tạo row `product_regulatory` rỗng khi tạo product mới.
- Seed: `dosage_forms`, `routes_of_administration`, `selling_rules` (ma trận, nguyên tắc "thiếu row = cấm").
- RLS + policies (theo `.claude/rules/migrations.md`) + trigger `handle_updated_at`.
- Permission mới `catalog.classification.manage` cho cấu hình `selling_rules`/`outlet_type`.
- `npm run typegen` → cập nhật `src/shared/types/database.types.ts`.
- Data layer (`safeRpc`) + Admin UI: quản lý hoạt chất; gán hoạt chất/phân loại trong `src/pages/inventory/ProductFormPage.tsx`; set `outlet_type` cho kho/cơ sở; bảng hiển thị "cơ sở được bán".
- Tests: `test:rpc` + `test:unit`.
- Script tay (best-effort, review thủ công): tách `products.active_ingredient` (text) → bảng chuẩn hóa.

**Ngoài phạm vi:** bảng bệnh + đơn mẫu (Phase 2); **enforcement ở POS**; quản lý giấy phép kiểm soát đặc biệt theo cơ sở (bảng `warehouse_special_licenses` — Phase sau); đồng bộ ATC/hoạt chất từ nguồn ngoài; mở rộng `outlet_type` cho cơ sở tiêm chủng/CSKCB.

## 3. Phát hiện then chốt

### 3.1 Codebase

- `products` đã có: `active_ingredient` (text — **giữ nguyên**), `packing_spec` (**text** — dạng bào chế, hiển thị qua hàm `product_dosage_label()`, **không** phải dữ liệu cấu trúc), `registration_number`, `category_id`, `manufacturer_id`, `updated_by` (uuid). KHÔNG có cột `prescription_class`.
- Đã có `prescription_templates` + `prescription_template_items` (field `diagnosis`), `clinical_prescriptions` → nền Phase 2.
- `warehouses` có `type` (text, mặc định `'retail'`, mang nghĩa kho bán lẻ/sỉ) — **giữ nguyên**; thêm cột **mới** `outlet_type` (loại cơ sở theo luật). Hai cột độc lập, `outlet_type` là nguồn sự thật cho ma trận quyền bán.
- `categories` (file `20260406100000_categories_table.sql`) **trộn 2 trục** (nhóm điều trị + loại mặt hàng như "TPCN", "Thiết bị y tế", "Đông y") → **không** dùng `category` để suy loại mặt hàng; dùng `product_regulatory.item_type`.
- Convention: snake_case; PK lookup gần đây dùng `serial` (categories) nhưng spec này thống nhất `GENERATED ALWAYS AS IDENTITY` (xem 4.1); RLS dùng `public.is_authenticated()` + `public.user_has_permission('<code>')` (đã dùng thực tế ở `20260325000011_001b_infrastructure_policies.sql`); `updated_at` cập nhật qua trigger `on_updated_at` + `public.handle_updated_at()`; audit `*_by` FK `auth.users(id)`; RPC qua `safeRpc()`; types tại `src/shared/types/database.types.ts`.
- **Form sản phẩm hiện tại: `src/pages/inventory/ProductFormPage.tsx`** (không nằm trong `src/features/`). Permission sản phẩm: `inventory.product.edit_info`, `inv-product-view`. Settings hiện có `setting-users`, `setting-view` (chưa có `settings.manage`).

### 3.2 Khung pháp lý

| Nhóm | Căn cứ |
|---|---|
| Thuốc kê đơn (Rx) / không kê đơn (OTC) | Luật Dược 2016; **TT 26/2025/TT-BYT** (kê đơn ngoại trú, hiệu lực 1/7/2025, thay TT 52/2017). **TT 12/2025/TT-BYT** là TT *đăng ký lưu hành thuốc*, đặt **tiêu chí** xác định thuốc không kê đơn (Điều 15) và làm hết hiệu lực phần OTC của TT 07/2017 từ 1/7/2025 — **không** ban hành kèm "Danh mục OTC"; Danh mục OTC do Cục Quản lý Dược công bố/cập nhật riêng. |
| Thuốc kiểm soát đặc biệt (gây nghiện / hướng thần / tiền chất / **dạng phối hợp** / độc / phóng xạ) | Luật Dược 2016 **Điều 2** (định nghĩa) + **Điều 34** (điều kiện kinh doanh); NĐ 54/2017; TT 20/2017 |
| Thuốc thiết yếu | Luật Dược 2016; **TT 19/2018/TT-BYT** |
| Thuốc hạn chế bán lẻ | Luật Dược 2016 **Điều 34** |
| TPCN / thực phẩm bảo vệ sức khỏe | NĐ 15/2018/NĐ-CP (không phải thuốc) |
| Trang thiết bị y tế (A/B/C/D) | NĐ 98/2021/NĐ-CP |
| Phạm vi cơ sở bán lẻ | Luật Dược 2016 **Điều 47** (nhà thuốc), **Điều 48** (quầy thuốc), **Điều 49** (tủ thuốc TYT) |

**Kết luận:** phân loại Rx/OTC phụ thuộc tổ hợp **hoạt chất + hàm lượng + dạng bào chế + đường dùng** (tiêu chí TT 12/2025); thuốc tiêm gần như luôn Rx. → cờ phân loại **ở cấp SKU/số đăng ký**, do người nhập quyết định theo giấy đăng ký lưu hành (DB chỉ gợi ý, không tự suy).

**Đính chính so với mô tả ban đầu của chủ đầu tư:**

1. Không có nhóm độc lập "thuốc kê đơn thiết yếu mà quầy được bán". Quầy (Điều 48) bán **OTC + thuốc thuộc Danh mục thiết yếu**; chỉ được bán Rx khi thuốc đó **đồng thời thuộc Danh mục thiết yếu** (giao thoa, vẫn cần đơn).
2. **Vắc xin** bị loại khỏi phạm vi **bán lẻ** ở **cả** nhà thuốc lẫn quầy (Điều 47/48); việc cung ứng/sử dụng tại cơ sở tiêm chủng & CSKCB nằm ngoài ma trận bán lẻ này.
3. Thuốc kiểm soát đặc biệt **không** "cả hai cơ sở đều bán mọi loại". Phạm vi khác nhau theo **từng phân nhóm**: quầy thực tế chỉ bán **thuốc dạng phối hợp**; thuốc gây nghiện/hướng thần/tiền chất/độc nguyên chất chủ yếu thuộc nhà thuốc đủ điều kiện; thuốc phóng xạ **không** bán lẻ. Tất cả phụ thuộc văn bản chấp thuận của Sở Y tế theo từng cơ sở (Điều 34) — Phase sau mô hình hóa per-cơ-sở.

## 4. Mô hình dữ liệu

### 4.1 Quy ước chung

- PK: `bigint GENERATED ALWAYS AS IDENTITY` cho bảng nghiệp vụ (`active_ingredients`, `product_active_ingredients`); `integer GENERATED ALWAYS AS IDENTITY` cho lookup (`dosage_forms`, `routes_of_administration`, `selling_rules`). FK `dosage_form_id`/`route_id` là `integer` (khớp).
- Mọi bảng có `updated_at` → gắn trigger `CREATE OR REPLACE TRIGGER on_updated_at BEFORE UPDATE ON public.<t> FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();`
- `slug` kebab-case sinh từ `name`; UNIQUE; CHECK chống rỗng.
- Migration: `BEGIN/COMMIT`, idempotent (`IF NOT EXISTS`, seed `ON CONFLICT DO NOTHING`, `DROP POLICY IF EXISTS` trước `CREATE POLICY`).

### 4.2 Sơ đồ quan hệ

```
active_ingredients ──< product_active_ingredients >── products ──1:1── product_regulatory
   (hoạt chất)            (M-N + hàm lượng)                              │  item_type, prescription_class (rx/otc/NULL),
                                                                         │  special_control_type, is_essential,
dosage_forms ─────────────────────────────────────────────────────────►┤  is_vaccine, is_restricted_retail,
routes_of_administration ──────────────────────────────────────────────►┘  dosage_form_id, route_id, classified_by/at

warehouses (+outlet_type) ····· selling_rules (outlet_type × rule_key → is_allowed, allowed_if_essential,
                                               requires_prescription, requires_special_license)
resolve_selling_rule_key(product) → rule_key ; can_outlet_sell(outlet_type, product) → {allowed, requires_*}
```

### 4.3 `active_ingredients`

```sql
CREATE TABLE IF NOT EXISTS public.active_ingredients (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  name_intl   text,
  slug        text NOT NULL CHECK (length(btrim(slug)) > 0),
  atc_code    text,
  description text,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_ingredients_slug ON public.active_ingredients(lower(slug));
CREATE INDEX IF NOT EXISTS idx_active_ingredients_atc ON public.active_ingredients(atc_code) WHERE atc_code IS NOT NULL;
-- + trigger on_updated_at
```
Vòng đời: vô hiệu hóa bằng `status='inactive'`, **không** DELETE (xem FK RESTRICT ở 4.4). `atc_code` = mã ATC **cấp hoạt chất** (giả định Phase 1; ATC chi tiết theo dạng để Phase sau).

### 4.4 `product_active_ingredients` (M-N, có hàm lượng)

```sql
CREATE TABLE IF NOT EXISTS public.product_active_ingredients (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id           bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  active_ingredient_id bigint NOT NULL REFERENCES public.active_ingredients(id) ON DELETE RESTRICT,
  strength_value       numeric CHECK (strength_value IS NULL OR strength_value > 0),
  strength_unit        text,
  is_primary           boolean NOT NULL DEFAULT false,
  sort_order           integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK ((strength_value IS NULL) = (strength_unit IS NULL))   -- đi cặp
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_ingredient ON public.product_active_ingredients(product_id, active_ingredient_id);
CREATE INDEX IF NOT EXISTS idx_pai_ingredient ON public.product_active_ingredients(active_ingredient_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pai_primary ON public.product_active_ingredients(product_id) WHERE is_primary; -- tối đa 1 hoạt chất chính
-- + trigger on_updated_at
```

### 4.5 `dosage_forms` & `routes_of_administration` (lookup)

```sql
CREATE TABLE IF NOT EXISTS public.dosage_forms (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  slug        text NOT NULL CHECK (length(btrim(slug)) > 0),
  is_complex  boolean NOT NULL DEFAULT false,  -- tiêm/hít → GỢI Ý Rx (không tự quyết)
  sort_order  integer NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dosage_forms_slug ON public.dosage_forms(slug);
-- routes_of_administration: cấu trúc giống hệt (name, slug, is_complex, sort_order, status, timestamps)
-- + trigger on_updated_at cho cả hai
```

`dosage_forms` là **danh mục master** (superset). Hàm `product_dosage_label()` vẫn là helper hiển thị parse từ `packing_spec` text, **không** authoritative. Việc gán `product_regulatory.dosage_form_id` làm thủ công (hoặc best-effort map từ nhãn parser).

**Seed `dosage_forms`** — khớp output thật của `product_dosage_label()` + bổ sung dạng liên quan phân loại:
`Viên nén`, `Viên nang cứng`, `Viên nang mềm`, `Viên nang`, `Viên ngậm`, `Viên sủi`, `Dung dịch` (uống), `Dạng bột`, `Nhũ tương (Gel)`, `Xịt/Phun sương`, `Miếng dán`, **`Dung dịch tiêm`** (`is_complex`), **`Bột pha tiêm`** (`is_complex`), **`Thuốc hít/Bột hít`** (`is_complex`), `Siro`, `Thuốc nhỏ (mắt/mũi/tai)`, `Thuốc đặt`.

**Seed `routes_of_administration`:** `Uống`, **`Tiêm`** (`is_complex`), **`Hít`** (`is_complex`), `Bôi ngoài da`, `Nhỏ mắt`, `Nhỏ mũi`, `Nhỏ tai`, `Đặt (âm đạo/trực tràng)`, `Ngậm dưới lưỡi`, `Xịt mũi/họng`.

### 4.6 `product_regulatory` (1-1 với products) — phân loại pháp lý

```sql
CREATE TABLE IF NOT EXISTS public.product_regulatory (
  product_id           bigint PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  item_type            text NOT NULL DEFAULT 'drug'
                         CHECK (item_type IN ('drug','supplement','medical_device','herbal','cosmetic')),
  prescription_class   text CHECK (prescription_class IN ('rx','otc')),   -- NULL = chưa phân loại
  special_control_type text NOT NULL DEFAULT 'none'
                         CHECK (special_control_type IN
                           ('none','narcotic','psychotropic','precursor','combination','toxic','radioactive')),
  is_essential         boolean NOT NULL DEFAULT false,
  is_restricted_retail boolean NOT NULL DEFAULT false,
  is_vaccine           boolean NOT NULL DEFAULT false,
  dosage_form_id       integer REFERENCES public.dosage_forms(id) ON DELETE SET NULL,
  route_id             integer REFERENCES public.routes_of_administration(id) ON DELETE SET NULL,
  classified_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  classified_at        timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  -- cờ kiểm soát chỉ hợp lệ cho THUỐC:
  CHECK (item_type = 'drug' OR (special_control_type = 'none' AND is_vaccine = false AND is_restricted_retail = false))
);
CREATE INDEX IF NOT EXISTS idx_pr_dosage_form ON public.product_regulatory(dosage_form_id);
CREATE INDEX IF NOT EXISTS idx_pr_route ON public.product_regulatory(route_id);
CREATE INDEX IF NOT EXISTS idx_pr_item_type ON public.product_regulatory(item_type);
CREATE INDEX IF NOT EXISTS idx_pr_rx ON public.product_regulatory(prescription_class) WHERE prescription_class IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pr_sc ON public.product_regulatory(special_control_type) WHERE special_control_type <> 'none';
-- + trigger on_updated_at
```

**Khởi tạo (chốt — lazy, KHÔNG bulk backfill):**
- **Không** INSERT default row cho toàn bộ products (tránh full-table write trên prod; tránh đoán sai `item_type` cho TPCN/thiết bị).
- Row tạo khi: (a) nhân viên phân loại sản phẩm lần đầu (UPSERT), hoặc (b) **trigger `AFTER INSERT ON products`** tạo row rỗng (`item_type='drug'`, `prescription_class=NULL`) cho product mới.
- Mọi truy vấn đọc dùng **LEFT JOIN + COALESCE** phòng product cũ chưa có row → coi như `item_type='drug'`, `prescription_class=NULL` (= `unclassified`).

### 4.7 `warehouses.outlet_type` + `selling_rules`

```sql
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS outlet_type text
  CHECK (outlet_type IN ('pharmacy','drug_counter','health_station','wholesale','warehouse'));
-- nullable (kho cũ = NULL = chưa phân loại cơ sở); set qua UI quản lý kho (mục 8). KHÔNG backfill đoán.

CREATE TABLE IF NOT EXISTS public.selling_rules (
  id                       integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_type              text NOT NULL
                             CHECK (outlet_type IN ('pharmacy','drug_counter','health_station','wholesale','warehouse')),
  rule_key                 text NOT NULL
                             CHECK (rule_key IN ('rx','otc','unclassified','sc_combination','sc_restricted',
                                                 'sc_radioactive','restricted_retail','vaccine',
                                                 'supplement','medical_device','herbal','cosmetic')),
  is_allowed               boolean NOT NULL,
  allowed_if_essential     boolean NOT NULL DEFAULT false,  -- mở Rx cho quầy nếu product thuộc DM thiết yếu
  requires_prescription    boolean NOT NULL DEFAULT false,
  requires_special_license boolean NOT NULL DEFAULT false,
  note                     text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_selling_rule ON public.selling_rules(outlet_type, rule_key);
-- + trigger on_updated_at
```

> **Quan hệ `type` ↔ `outlet_type`:** `warehouses.type` (retail/wholesale — vai trò kho) giữ nguyên; `outlet_type` là **nguồn sự thật về loại cơ sở pháp lý** cho ma trận quyền bán. `outlet_type = NULL` → `can_outlet_sell` trả `allowed=NULL/unknown` (Phase store-only: hiển thị "chưa xác định cơ sở", **không** chặn).

### 4.8 `resolve_selling_rule_key` — bảng quyết định vét cạn

Hàm Postgres `resolve_selling_rule_key(pr product_regulatory) → text`, xét **top-down, first match** (các CHECK ở 4.6 đảm bảo cờ kiểm soát chỉ tồn tại khi `item_type='drug'`, nên các nhánh không chồng chéo):

| # | Điều kiện | rule_key |
|---|---|---|
| 1 | `is_vaccine = true` | `vaccine` |
| 2 | `special_control_type = 'radioactive'` | `sc_radioactive` |
| 3 | `special_control_type IN ('narcotic','psychotropic','precursor','toxic')` | `sc_restricted` |
| 4 | `special_control_type = 'combination'` | `sc_combination` |
| 5 | `is_restricted_retail = true` | `restricted_retail` |
| 6 | `item_type = 'supplement'` | `supplement` |
| 7 | `item_type = 'medical_device'` | `medical_device` |
| 8 | `item_type = 'herbal'` | `herbal` |
| 9 | `item_type = 'cosmetic'` | `cosmetic` |
| 10 | `item_type='drug' AND prescription_class='rx'` | `rx` |
| 11 | `item_type='drug' AND prescription_class='otc'` | `otc` |
| 12 | `item_type='drug' AND prescription_class IS NULL` | `unclassified` |

> `is_essential` **không** vào rule_key (tránh rò sang `health_station`); xử lý qua cờ `allowed_if_essential` trong `selling_rules`.

**Hàm `can_outlet_sell(outlet_type, product_id) → {allowed, requires_prescription, requires_special_license, reason}`:**

```
pr    := product_regulatory của product (LEFT JOIN COALESCE nếu thiếu → unclassified)
if outlet_type IS NULL → return {allowed: null, reason: 'CHUA_XAC_DINH_CO_SO'}
k     := resolve_selling_rule_key(pr)
r     := selling_rules[outlet_type, k]          -- thiếu row = cấm
allowed := COALESCE(r.is_allowed, false)
          OR (COALESCE(r.allowed_if_essential, false) AND pr.is_essential)
requires_prescription    := COALESCE(r.requires_prescription, false) OR (pr.prescription_class = 'rx')
requires_special_license := COALESCE(r.requires_special_license, false)
if k = 'unclassified' → allowed=false, reason='CHUA_PHAN_LOAI'
```

### 4.9 Seed `selling_rules` — nguyên tắc "thiếu row = cấm"

Chỉ seed các dòng **được phép** (và dòng `rx` của quầy/TYT mang cờ `allowed_if_essential`). Mọi tổ hợp `(outlet_type, rule_key)` không có trong bảng → mặc định **cấm** (do `COALESCE(is_allowed,false)`). Bỏ ký hiệu `*`.

| outlet_type | rule_key | is_allowed | allowed_if_essential | req_prescription | req_special_license |
|---|---|:--:|:--:|:--:|:--:|
| pharmacy | rx | ✅ | | ✅ | |
| pharmacy | otc | ✅ | | | |
| pharmacy | sc_combination | ✅ | | ✅ | ✅ |
| pharmacy | sc_restricted | ✅ | | ✅ | ✅ |
| pharmacy | restricted_retail | ✅ | | | ✅ |
| pharmacy | supplement / medical_device / herbal / cosmetic | ✅ | | | |
| drug_counter | otc | ✅ | | | |
| drug_counter | rx | ❌ | ✅ | ✅ | |
| drug_counter | sc_combination | ✅ | | ✅ | ✅ |
| drug_counter | restricted_retail | ✅ | | | ✅ |
| drug_counter | supplement / medical_device / herbal / cosmetic | ✅ | | | |
| health_station | otc | ✅ | | | |
| health_station | rx | ❌ | ✅ | ✅ | |
| health_station | supplement / medical_device | ✅ | | | |

**Không seed (⇒ cấm):** `vaccine` (mọi cơ sở bán lẻ); `sc_radioactive` (mọi cơ sở); `sc_restricted` & `sc_radioactive` ở `drug_counter`/`health_station`; `unclassified` (mọi cơ sở → buộc phân loại); `wholesale`/`warehouse` (không bán lẻ). `note` ghi rõ căn cứ + "cấm tại cơ sở **bán lẻ**" cho vaccine.

> **Giả định Phase 1 (cần cậu xác nhận):** (a) gộp `narcotic/psychotropic/precursor/toxic` vào `sc_restricted` (pharmacy bán được khi đủ điều kiện, quầy không) — đủ an toàn, chưa tách từng loại; (b) `requires_special_license` ở mức rule chỉ là *nhãn cảnh báo* — quyền bán KSĐB/hạn chế bán lẻ thực tế phụ thuộc **văn bản chấp thuận theo từng cơ sở** (Điều 34), sẽ mô hình hóa bằng bảng `warehouse_special_licenses` ở Phase enforcement; (c) `health_station` seed tối thiểu, dòng `rx/allowed_if_essential` là đơn giản hóa của "DM thiết yếu theo phân tuyến".

## 5. Migration & backfill

Tách file (`20260601HHMMSS_*.sql`, `BEGIN/COMMIT`, idempotent, mỗi bảng kèm `ENABLE RLS` + policies + trigger):

1. `..._active_ingredients.sql`
2. `..._product_active_ingredients.sql`
3. `..._dosage_forms_routes.sql` (+ seed)
4. `..._product_regulatory.sql` (+ trigger `AFTER INSERT ON products`)
5. `..._selling_rules.sql` (`warehouses.outlet_type` + bảng + seed ma trận)
6. `..._selling_functions.sql` (`resolve_selling_rule_key` + `can_outlet_sell`)
7. *(script tay, ngoài migration)* tách `products.active_ingredient` text → bảng chuẩn hóa: best-effort, tạo bản nháp cho người review, **không** xóa cột text, **không** chạy tự động trên prod.

Giữ nguyên `products.active_ingredient`, `products.packing_spec`, `warehouses.type`.

## 6. RLS & permissions

`ENABLE ROW LEVEL SECURITY` + policy đủ SELECT/INSERT/UPDATE/DELETE (`DROP POLICY IF EXISTS` trước `CREATE`). Helper: `public.is_authenticated()`, `public.user_has_permission()`.

| Bảng | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `active_ingredients`, `dosage_forms`, `routes_of_administration` | `is_authenticated()` | `user_has_permission('inventory.product.edit_info')` |
| `product_active_ingredients`, `product_regulatory` | `is_authenticated()` | `user_has_permission('inventory.product.edit_info')` |
| `selling_rules` | `is_authenticated()` | `user_has_permission('catalog.classification.manage')` ← **permission mới** |

**Chốt:** thêm permission mới `catalog.classification.manage` vào `src/features/auth/constants/permissions.ts` (cho cấu hình ma trận + `outlet_type`), vì đây là cấu hình chính sách hệ thống, không phải sửa thông tin sản phẩm thông thường. (Trước khi viết migration: xác nhận lại sự tồn tại/chữ ký `is_authenticated()` & `user_has_permission(text)` bằng grep toàn `migrations/`.)

## 7. Type & data layer

- `npm run typegen` → cập nhật `src/shared/types/database.types.ts`.
- Truy vấn qua `safeRpc()`; tạo RPC tổng hợp `get_product_regulatory(product_id)` trả phân loại + danh sách hoạt chất + nhãn dạng bào chế + kết quả `can_outlet_sell` cho từng `outlet_type` (1 lần gọi cho UI).
- Quy tắc kiểu PG (CLAUDE.md): tham số `bigint/uuid/timestamptz/date` truyền `|| null`, **không** `|| ""`.

## 8. UI (Ant Design)

1. **Trang quản lý hoạt chất** — CRUD `active_ingredients` (tên, name_intl, atc_code, status), search theo `slug`/`name`.
2. **`src/pages/inventory/ProductFormPage.tsx`** — thêm 2 khối:
   - *Hoạt chất:* thêm/xóa nhiều hoạt chất + `strength_value`/`strength_unit`, đánh dấu hoạt chất chính (chỉ 1).
   - *Phân loại:* `item_type`, `dosage_form_id`, `route_id`, `prescription_class`, `special_control_type`, các cờ `is_essential/is_restricted_retail/is_vaccine`. Disable cờ kiểm soát khi `item_type<>'drug'` (theo CHECK).
   - *Gợi ý (không ép):* nếu `dosage_form`/`route` có `is_complex=true` mà `prescription_class` chưa set → nhắc "dạng này thường là kê đơn".
   - *Bảng "Cơ sở được bán" (read-only):* gọi `can_outlet_sell` cho từng `outlet_type` → hiển thị được/không + cần đơn + ghi chú; trạng thái `unclassified`/`outlet_type=NULL` hiển thị cảnh báo.
3. **Set `outlet_type` cho kho/cơ sở** — bổ sung field `outlet_type` vào trang quản lý kho hiện có (warehouses), để ma trận có dữ liệu cơ sở.
4. *(tùy chọn)* Trang admin xem/sửa `selling_rules` (gated `catalog.classification.manage`).

## 9. Quy tắc nghiệp vụ & edge cases

- Thuốc phối hợp nhiều hoạt chất → nhiều dòng `product_active_ingredients`; tối đa **1** `is_primary` (partial unique).
- `prescription_class = NULL` ⇒ rule_key `unclassified` ⇒ **cấm bán** (khi enforcement) + cảnh báo; đợt store-only chỉ hiển thị cảnh báo.
- TPCN / thiết bị / mỹ phẩm: `item_type<>'drug'`, cờ kiểm soát bắt buộc rỗng (CHECK); resolve theo `item_type` → bán được ở pharmacy & drug_counter.
- **`herbal`** chỉ dùng cho **dược liệu / vị thuốc cổ truyền KHÔNG phải thành phẩm**. **Thuốc cổ truyền (đông dược) có số đăng ký** vẫn là `item_type='drug'` và phân loại Rx/OTC như thuốc thường — không gán `herbal`.
- Thuốc vừa Rx vừa thiết yếu: resolve = `rx`; ở quầy/TYT, `allowed_if_essential=true` + `is_essential=true` ⇒ được bán, vẫn `requires_prescription=true`.
- Vắc xin: `is_vaccine=true` ⇒ rule_key `vaccine` ⇒ cấm **bán lẻ** mọi cơ sở (ưu tiên cao nhất). Cơ sở tiêm chủng/CSKCB ngoài phạm vi.
- KSĐB & hạn chế bán lẻ: `requires_special_license` chỉ là nhãn; điều kiện thật theo **văn bản chấp thuận per-cơ-sở** (Điều 34) — Phase enforcement.
- DB không tự suy phân loại từ dạng bào chế (chỉ gợi ý UI); quyết định cuối theo số đăng ký, do người nhập.

## 10. Testing

**`test:rpc`:**
- Bảng quyết định `resolve_selling_rule_key`: 1 case cho **mỗi** dòng 1–12 (gồm `unclassified` khi `prescription_class=NULL`; ưu tiên `sc_*` > `restricted_retail` > `item_type` > `rx/otc`).
- `can_outlet_sell` cho ma trận trọng yếu: pharmacy×{rx,otc,sc_combination,sc_restricted,vaccine,sc_radioactive}; drug_counter×{rx (không essential → cấm; có essential → cho), otc, sc_restricted (cấm), vaccine (cấm)}; `outlet_type=NULL` → unknown.
- CHECK constraints: gán cờ kiểm soát khi `item_type<>'drug'` → bị từ chối; `is_primary` thứ 2 → bị từ chối; `strength_value<=0` → từ chối.
- RLS: SELECT bị chặn khi chưa đăng nhập (anon); INSERT/UPDATE/DELETE bị chặn khi thiếu `inventory.product.edit_info`; `selling_rules` ghi bị chặn khi thiếu `catalog.classification.manage`.
- Idempotent: chạy lại từng migration + seed (`ON CONFLICT`) không lỗi, không nhân đôi row.
- Trigger: tạo product mới → tự sinh 1 row `product_regulatory` rỗng.

**`test:unit`:** helper UI hiển thị "cơ sở được bán"; gợi ý `is_complex`.

## 11. Quyết định đã chốt

Đã chốt trong spec: lazy product_regulatory (không bulk backfill); permission mới `catalog.classification.manage` cho `selling_rules`; resolve/can_outlet_sell là hàm Postgres; nguyên tắc "thiếu row = cấm"; tách 3 implementation plan (mục 14).

**Đã xác nhận với chủ đầu tư (2026-06):**
1. **Gộp** `narcotic/psychotropic/precursor/toxic` thành 1 nhóm `sc_restricted` (đơn giản, an toàn); tách chi tiết để Phase enforcement.
2. **Giữ** `health_station` (tủ thuốc TYT) trong đợt này, seed tối thiểu (`otc` + `rx` theo `allowed_if_essential`).
3. Script tách `products.active_ingredient` text → chuẩn hóa: **chạy ở Plan 2 riêng, review tay**, không tự động trong migration.

## 12. Tham chiếu pháp lý

- Luật Dược 2016 (105/2016/QH13) — Điều 2 (định nghĩa), 34 (điều kiện kinh doanh thuốc KSĐB / hạn chế bán lẻ), 47/48/49 (phạm vi nhà thuốc / quầy / tủ thuốc TYT).
- TT 12/2025/TT-BYT (đăng ký lưu hành thuốc; tiêu chí OTC tại Điều 15; làm hết hiệu lực phần OTC của TT 07/2017 từ 1/7/2025). Danh mục OTC do Cục Quản lý Dược công bố riêng.
- TT 26/2025/TT-BYT (kê đơn ngoại trú; thay TT 52/2017).
- TT 19/2018/TT-BYT (Danh mục thuốc thiết yếu).
- NĐ 54/2017/NĐ-CP + TT 20/2017/TT-BYT (thuốc kiểm soát đặc biệt).
- NĐ 15/2018/NĐ-CP (TPCN/thực phẩm bảo vệ sức khỏe). NĐ 98/2021/NĐ-CP (trang thiết bị y tế A/B/C/D).
- Mã ATC — Dược thư Quốc gia VN 2022.

## 13. Phase 2 (phác thảo — spec riêng)

- `diseases` (loại bệnh): id, name, slug, `icd10_code` (tùy chọn), nhóm bệnh.
- Đơn thuốc mẫu: dùng `prescription_templates` sẵn có, thêm FK `disease_id`; mỗi template nhiều `prescription_template_items` (product_id, quantity, liều dùng).
- `product_indications` (product ↔ disease) gợi ý sản phẩm theo bệnh.

## 14. Tách implementation plan (đề xuất writing-plans)

- **Plan 1 — Schema:** 6 migration (bảng + ALTER + seed + RLS + trigger `handle_updated_at` & `AFTER INSERT products` + 2 hàm Postgres) + permission mới + `npm run typegen`. Test `test:rpc` (resolution, RLS, idempotent).
- **Plan 2 — Backfill (rủi ro, review tay):** script tách `products.active_ingredient` → chuẩn hóa; chạy/review riêng, không chặn Plan 3.
- **Plan 3 — Data layer + UI:** `safeRpc` + RPC `get_product_regulatory`; UI quản lý hoạt chất, khối hoạt chất/phân loại trong `ProductFormPage`, set `outlet_type` cho kho, bảng "cơ sở được bán". Test `test:unit` + e2e nhẹ.
