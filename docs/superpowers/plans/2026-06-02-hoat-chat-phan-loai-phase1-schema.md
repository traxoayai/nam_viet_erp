# Phase 1 — Schema: Hoạt chất + Phân loại thuốc + Ma trận quyền bán — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạo toàn bộ schema (6 bảng + ALTER warehouses + 2 hàm Postgres + trigger + RLS + seed + permission + typegen) cho hệ hoạt chất / phân loại thuốc / ma trận quyền bán, theo spec `docs/superpowers/specs/2026-06-01-hoat-chat-phan-loai-thuoc-design.md`. Đợt này **chỉ lưu + truy vấn**, chưa chặn POS.

**Architecture:** Hoạt chất chuẩn hóa M-N (`active_ingredients` + `product_active_ingredients`); phân loại đặt ở bảng 1-1 `product_regulatory` (theo SKU); 2 lookup `dosage_forms`/`routes_of_administration`; ma trận `selling_rules` cấu hình được + 2 hàm `resolve_selling_rule_key` / `can_outlet_sell` (chỉ dùng hiển thị). Mỗi bảng kèm RLS + trigger `handle_updated_at`. Khởi tạo `product_regulatory` **lazy** qua trigger `AFTER INSERT ON products` (không bulk backfill).

**Tech Stack:** Postgres (Supabase), SQL migrations (`supabase/migrations/`), Vitest integration (`test:rpc`, harness `tests/helpers/supabase.ts`), TypeScript types auto-gen (`npm run typegen`).

**Branch:** `feat/hoat-chat-phan-loai` (đã tạo, spec đã commit).

---

## File Structure

**Migrations tạo mới** (`nam_viet_erp/supabase/migrations/`):
- `20260602093000_active_ingredients.sql` — bảng `active_ingredients` + index + RLS + trigger.
- `20260602093100_product_active_ingredients.sql` — bảng nối M-N + constraints + RLS + trigger.
- `20260602093200_dosage_forms_routes.sql` — 2 lookup + seed + RLS + trigger.
- `20260602093300_product_regulatory.sql` — bảng 1-1 + CHECK + index + RLS + trigger `handle_updated_at` + trigger `AFTER INSERT ON products`.
- `20260602093400_selling_rules.sql` — `warehouses.outlet_type` + bảng `selling_rules` + seed ma trận + RLS + trigger.
- `20260602093500_selling_functions.sql` — `resolve_selling_rule_key()` + `can_outlet_sell()`.

**TypeScript:**
- Modify: `src/features/auth/constants/permissions.ts` — thêm group `CATALOG.CLASSIFICATION.MANAGE`.
- Regenerate: `src/shared/types/database.types.ts` (qua `npm run typegen`).

**Tests tạo mới:**
- `tests/rpc/drug-classification.test.ts` — test seed, constraints, resolution decision-table, can_outlet_sell matrix, RLS gate.

**Conventions bắt buộc** (theo `.claude/rules/migrations.md`): wrap `BEGIN; ... COMMIT;`; idempotent (`IF NOT EXISTS`, seed `ON CONFLICT DO NOTHING`, `DROP POLICY IF EXISTS` trước `CREATE POLICY`); `ENABLE ROW LEVEL SECURITY` + đủ policy; trigger `handle_updated_at` cho bảng có `updated_at`.

---

## Task 0: Chuẩn bị môi trường local

**Files:** none (chỉ chạy lệnh).

- [ ] **Step 1: Xác nhận đang ở đúng branch**

Run: `git -C nam_viet_erp branch --show-current`
Expected: `feat/hoat-chat-phan-loai`

- [ ] **Step 2: Khởi động Supabase local + reset DB sạch**

Run (trong `nam_viet_erp/`):
```bash
npx supabase start
npx supabase db reset
```
Expected: `supabase start` in ra API URL + keys; `db reset` áp toàn bộ migration hiện có + seed, kết thúc không lỗi.

- [ ] **Step 3: Set env cho test:rpc (local)**

Run (lấy key từ output `npx supabase status`):
```bash
export SUPABASE_LOCAL_SERVICE_ROLE_KEY="<service_role key từ supabase status>"
export SUPABASE_LOCAL_ANON_KEY="<anon key từ supabase status>"
```
Expected: 2 biến môi trường được set (test:rpc mặc định `TEST_TARGET=local`).

- [ ] **Step 4: Chạy thử test:rpc baseline để chắc harness OK**

Run: `npm run test:rpc`
Expected: các test hiện có PASS (hoặc skip do thiếu data) — xác nhận kết nối local DB hoạt động trước khi thêm migration.

---

## Task 1: Bảng `active_ingredients`

**Files:**
- Create: `nam_viet_erp/supabase/migrations/20260602093000_active_ingredients.sql`
- Test: `nam_viet_erp/tests/rpc/drug-classification.test.ts`

- [ ] **Step 1: Viết migration**

Create `nam_viet_erp/supabase/migrations/20260602093000_active_ingredients.sql`:
```sql
-- Bảng active_ingredients: danh mục hoạt chất (master). Ngày: 2026-06-02
BEGIN;

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

CREATE OR REPLACE TRIGGER on_updated_at BEFORE UPDATE ON public.active_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.active_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "active_ingredients_select" ON public.active_ingredients;
CREATE POLICY "active_ingredients_select" ON public.active_ingredients
  FOR SELECT USING (public.is_authenticated());
DROP POLICY IF EXISTS "active_ingredients_insert" ON public.active_ingredients;
CREATE POLICY "active_ingredients_insert" ON public.active_ingredients
  FOR INSERT WITH CHECK (public.user_has_permission('inventory.product.edit_info'));
DROP POLICY IF EXISTS "active_ingredients_update" ON public.active_ingredients;
CREATE POLICY "active_ingredients_update" ON public.active_ingredients
  FOR UPDATE USING (public.user_has_permission('inventory.product.edit_info'));
DROP POLICY IF EXISTS "active_ingredients_delete" ON public.active_ingredients;
CREATE POLICY "active_ingredients_delete" ON public.active_ingredients
  FOR DELETE USING (public.user_has_permission('inventory.product.edit_info'));

COMMIT;
```

- [ ] **Step 2: Áp migration local**

Run: `npx supabase migration up`
Expected: áp `20260602093000_active_ingredients.sql` không lỗi.

- [ ] **Step 3: Viết test (tạo file mới)**

Create `nam_viet_erp/tests/rpc/drug-classification.test.ts`:
```typescript
import { describe, it, expect, afterAll } from "vitest";
import { adminClient } from "../helpers/supabase";

// Dọn dữ liệu test theo prefix để chạy lặp được
const TEST_PREFIX = "__dctest__";
afterAll(async () => {
  // products xóa TRƯỚC (cascade product_active_ingredients + product_regulatory),
  // rồi active_ingredients (vì FK active_ingredient_id là ON DELETE RESTRICT)
  await adminClient.from("products").delete().like("name", `${TEST_PREFIX}%`);
  await adminClient.from("active_ingredients").delete().like("slug", `${TEST_PREFIX}%`);
});

describe("active_ingredients", () => {
  it("insert + select bằng admin client (bypass RLS)", async () => {
    const slug = `${TEST_PREFIX}cefixim`;
    const { data, error } = await adminClient
      .from("active_ingredients")
      .insert({ name: "Cefixim", slug, atc_code: "J01DD08" })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.name).toBe("Cefixim");
    expect(data?.status).toBe("active");
  });

  it("CHECK chặn name rỗng", async () => {
    const { error } = await adminClient
      .from("active_ingredients")
      .insert({ name: "   ", slug: `${TEST_PREFIX}blank` });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 4: Chạy test**

Run: `npm run test:rpc -- tests/rpc/drug-classification.test.ts`
Expected: 2 test PASS.

- [ ] **Step 5: Commit**

```bash
git -C nam_viet_erp add supabase/migrations/20260602093000_active_ingredients.sql tests/rpc/drug-classification.test.ts
git -C nam_viet_erp commit -m "feat(db): bảng active_ingredients + RLS + test"
```

---

## Task 2: Bảng `product_active_ingredients` (M-N + hàm lượng)

**Files:**
- Create: `nam_viet_erp/supabase/migrations/20260602093100_product_active_ingredients.sql`
- Test: `nam_viet_erp/tests/rpc/drug-classification.test.ts` (thêm describe)

- [ ] **Step 1: Viết migration**

Create `nam_viet_erp/supabase/migrations/20260602093100_product_active_ingredients.sql`:
```sql
-- Bảng nối product <-> active_ingredient (M-N, có hàm lượng). Ngày: 2026-06-02
BEGIN;

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
  CONSTRAINT chk_pai_strength_pair CHECK ((strength_value IS NULL) = (strength_unit IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_ingredient
  ON public.product_active_ingredients(product_id, active_ingredient_id);
CREATE INDEX IF NOT EXISTS idx_pai_ingredient
  ON public.product_active_ingredients(active_ingredient_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pai_primary
  ON public.product_active_ingredients(product_id) WHERE is_primary;

CREATE OR REPLACE TRIGGER on_updated_at BEFORE UPDATE ON public.product_active_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.product_active_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pai_select" ON public.product_active_ingredients;
CREATE POLICY "pai_select" ON public.product_active_ingredients
  FOR SELECT USING (public.is_authenticated());
DROP POLICY IF EXISTS "pai_insert" ON public.product_active_ingredients;
CREATE POLICY "pai_insert" ON public.product_active_ingredients
  FOR INSERT WITH CHECK (public.user_has_permission('inventory.product.edit_info'));
DROP POLICY IF EXISTS "pai_update" ON public.product_active_ingredients;
CREATE POLICY "pai_update" ON public.product_active_ingredients
  FOR UPDATE USING (public.user_has_permission('inventory.product.edit_info'));
DROP POLICY IF EXISTS "pai_delete" ON public.product_active_ingredients;
CREATE POLICY "pai_delete" ON public.product_active_ingredients
  FOR DELETE USING (public.user_has_permission('inventory.product.edit_info'));

COMMIT;
```

- [ ] **Step 2: Áp migration local**

Run: `npx supabase migration up`
Expected: áp không lỗi.

- [ ] **Step 3: Thêm test vào `tests/rpc/drug-classification.test.ts`**

Thêm helper tạo product tạm + describe (đặt sau import, dùng chung cho các task sau):
```typescript
// --- helper: tạo product tạm để test FK/regulatory ---
async function createTempProduct(label: string): Promise<number> {
  const { data, error } = await adminClient
    .from("products")
    .insert({ name: `${TEST_PREFIX}${label}`, actual_cost: 0, status: "active" })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as number;
}
// (cleanup product test đã gộp ở afterAll đầu file — products xóa trước, rồi active_ingredients)

describe("product_active_ingredients", () => {
  it("gán nhiều hoạt chất cho 1 product, tối đa 1 is_primary", async () => {
    const productId = await createTempProduct("combo");
    const { data: ing } = await adminClient
      .from("active_ingredients")
      .insert([
        { name: "Amoxicillin", slug: `${TEST_PREFIX}amox` },
        { name: "Clavulanic acid", slug: `${TEST_PREFIX}clav` },
      ])
      .select("id");
    const [a, b] = ing!;
    const { error: e1 } = await adminClient.from("product_active_ingredients").insert([
      { product_id: productId, active_ingredient_id: a.id, strength_value: 875, strength_unit: "mg", is_primary: true },
      { product_id: productId, active_ingredient_id: b.id, strength_value: 125, strength_unit: "mg", is_primary: false },
    ]);
    expect(e1).toBeNull();

    // is_primary thứ 2 cho cùng product -> vi phạm partial unique
    const { error: e2 } = await adminClient
      .from("product_active_ingredients")
      .update({ is_primary: true })
      .eq("product_id", productId)
      .eq("active_ingredient_id", b.id);
    expect(e2).not.toBeNull();
  });

  it("CHECK chặn hàm lượng <= 0", async () => {
    const productId = await createTempProduct("badstrength");
    const { data: ing } = await adminClient
      .from("active_ingredients")
      .insert({ name: "Paracetamol", slug: `${TEST_PREFIX}para` })
      .select("id")
      .single();
    const { error } = await adminClient.from("product_active_ingredients").insert({
      product_id: productId, active_ingredient_id: ing!.id, strength_value: 0, strength_unit: "mg",
    });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 4: Chạy test**

Run: `npm run test:rpc -- tests/rpc/drug-classification.test.ts`
Expected: các test mới PASS.

- [ ] **Step 5: Commit**

```bash
git -C nam_viet_erp add supabase/migrations/20260602093100_product_active_ingredients.sql tests/rpc/drug-classification.test.ts
git -C nam_viet_erp commit -m "feat(db): bảng product_active_ingredients (M-N hàm lượng) + test"
```

---

## Task 3: Lookup `dosage_forms` + `routes_of_administration` (+ seed)

**Files:**
- Create: `nam_viet_erp/supabase/migrations/20260602093200_dosage_forms_routes.sql`
- Test: `nam_viet_erp/tests/rpc/drug-classification.test.ts` (thêm describe)

- [ ] **Step 1: Viết migration**

Create `nam_viet_erp/supabase/migrations/20260602093200_dosage_forms_routes.sql`:
```sql
-- Lookup dạng bào chế + đường dùng (+ seed). Ngày: 2026-06-02
BEGIN;

CREATE TABLE IF NOT EXISTS public.dosage_forms (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  slug        text NOT NULL CHECK (length(btrim(slug)) > 0),
  is_complex  boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dosage_forms_slug ON public.dosage_forms(slug);

CREATE TABLE IF NOT EXISTS public.routes_of_administration (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  slug        text NOT NULL CHECK (length(btrim(slug)) > 0),
  is_complex  boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_routes_slug ON public.routes_of_administration(slug);

CREATE OR REPLACE TRIGGER on_updated_at BEFORE UPDATE ON public.dosage_forms
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE OR REPLACE TRIGGER on_updated_at BEFORE UPDATE ON public.routes_of_administration
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed dosage_forms (khớp output product_dosage_label() + bổ sung dạng liên quan phân loại)
INSERT INTO public.dosage_forms (name, slug, is_complex, sort_order) VALUES
  ('Viên nén','vien-nen',false,1),
  ('Viên nang cứng','vien-nang-cung',false,2),
  ('Viên nang mềm','vien-nang-mem',false,3),
  ('Viên nang','vien-nang',false,4),
  ('Viên ngậm','vien-ngam',false,5),
  ('Viên sủi','vien-sui',false,6),
  ('Dung dịch','dung-dich',false,7),
  ('Siro','siro',false,8),
  ('Dạng bột','dang-bot',false,9),
  ('Nhũ tương (Gel)','nhu-tuong-gel',false,10),
  ('Xịt/Phun sương','xit-phun-suong',false,11),
  ('Miếng dán','mieng-dan',false,12),
  ('Thuốc nhỏ (mắt/mũi/tai)','thuoc-nho',false,13),
  ('Thuốc đặt','thuoc-dat',false,14),
  ('Dung dịch tiêm','dung-dich-tiem',true,15),
  ('Bột pha tiêm','bot-pha-tiem',true,16),
  ('Thuốc hít/Bột hít','thuoc-hit',true,17)
ON CONFLICT (slug) DO NOTHING;

-- Seed routes_of_administration
INSERT INTO public.routes_of_administration (name, slug, is_complex, sort_order) VALUES
  ('Uống','uong',false,1),
  ('Tiêm','tiem',true,2),
  ('Hít','hit',true,3),
  ('Bôi ngoài da','boi-ngoai-da',false,4),
  ('Nhỏ mắt','nho-mat',false,5),
  ('Nhỏ mũi','nho-mui',false,6),
  ('Nhỏ tai','nho-tai',false,7),
  ('Đặt (âm đạo/trực tràng)','dat',false,8),
  ('Ngậm dưới lưỡi','ngam-duoi-luoi',false,9),
  ('Xịt mũi/họng','xit-mui-hong',false,10)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.dosage_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes_of_administration ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dosage_forms_select" ON public.dosage_forms;
CREATE POLICY "dosage_forms_select" ON public.dosage_forms FOR SELECT USING (public.is_authenticated());
DROP POLICY IF EXISTS "dosage_forms_insert" ON public.dosage_forms;
CREATE POLICY "dosage_forms_insert" ON public.dosage_forms FOR INSERT WITH CHECK (public.user_has_permission('inventory.product.edit_info'));
DROP POLICY IF EXISTS "dosage_forms_update" ON public.dosage_forms;
CREATE POLICY "dosage_forms_update" ON public.dosage_forms FOR UPDATE USING (public.user_has_permission('inventory.product.edit_info'));
DROP POLICY IF EXISTS "dosage_forms_delete" ON public.dosage_forms;
CREATE POLICY "dosage_forms_delete" ON public.dosage_forms FOR DELETE USING (public.user_has_permission('inventory.product.edit_info'));

DROP POLICY IF EXISTS "routes_select" ON public.routes_of_administration;
CREATE POLICY "routes_select" ON public.routes_of_administration FOR SELECT USING (public.is_authenticated());
DROP POLICY IF EXISTS "routes_insert" ON public.routes_of_administration;
CREATE POLICY "routes_insert" ON public.routes_of_administration FOR INSERT WITH CHECK (public.user_has_permission('inventory.product.edit_info'));
DROP POLICY IF EXISTS "routes_update" ON public.routes_of_administration;
CREATE POLICY "routes_update" ON public.routes_of_administration FOR UPDATE USING (public.user_has_permission('inventory.product.edit_info'));
DROP POLICY IF EXISTS "routes_delete" ON public.routes_of_administration;
CREATE POLICY "routes_delete" ON public.routes_of_administration FOR DELETE USING (public.user_has_permission('inventory.product.edit_info'));

COMMIT;
```

- [ ] **Step 2: Áp migration local**

Run: `npx supabase migration up`
Expected: áp không lỗi.

- [ ] **Step 3: Thêm test**

Thêm vào `tests/rpc/drug-classification.test.ts`:
```typescript
describe("lookup dosage_forms / routes", () => {
  it("seed đủ dạng bào chế + cờ is_complex cho tiêm/hít", async () => {
    const { data, error } = await adminClient.from("dosage_forms").select("slug,is_complex");
    expect(error).toBeNull();
    const bySlug = Object.fromEntries((data ?? []).map((r) => [r.slug, r.is_complex]));
    expect(bySlug["vien-nen"]).toBe(false);
    expect(bySlug["dung-dich-tiem"]).toBe(true);
    expect(bySlug["thuoc-hit"]).toBe(true);
  });
  it("seed routes có Tiêm/Hít = complex", async () => {
    const { data } = await adminClient.from("routes_of_administration").select("slug,is_complex");
    const bySlug = Object.fromEntries((data ?? []).map((r) => [r.slug, r.is_complex]));
    expect(bySlug["uong"]).toBe(false);
    expect(bySlug["tiem"]).toBe(true);
    expect(bySlug["hit"]).toBe(true);
  });
});
```

- [ ] **Step 4: Chạy test**

Run: `npm run test:rpc -- tests/rpc/drug-classification.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C nam_viet_erp add supabase/migrations/20260602093200_dosage_forms_routes.sql tests/rpc/drug-classification.test.ts
git -C nam_viet_erp commit -m "feat(db): lookup dosage_forms + routes_of_administration + seed + test"
```

---

## Task 4: Bảng `product_regulatory` (1-1) + trigger auto-create

**Files:**
- Create: `nam_viet_erp/supabase/migrations/20260602093300_product_regulatory.sql`
- Test: `nam_viet_erp/tests/rpc/drug-classification.test.ts` (thêm describe)

- [ ] **Step 1: Viết migration**

Create `nam_viet_erp/supabase/migrations/20260602093300_product_regulatory.sql`:
```sql
-- Bảng phân loại pháp lý 1-1 với products + trigger auto-create lazy. Ngày: 2026-06-02
BEGIN;

CREATE TABLE IF NOT EXISTS public.product_regulatory (
  product_id           bigint PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  item_type            text NOT NULL DEFAULT 'drug'
                         CHECK (item_type IN ('drug','supplement','medical_device','herbal','cosmetic')),
  prescription_class   text CHECK (prescription_class IN ('rx','otc')),
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
  CONSTRAINT chk_pr_control_only_drug CHECK (
    item_type = 'drug'
    OR (special_control_type = 'none' AND is_vaccine = false AND is_restricted_retail = false)
  )
);

CREATE INDEX IF NOT EXISTS idx_pr_dosage_form ON public.product_regulatory(dosage_form_id);
CREATE INDEX IF NOT EXISTS idx_pr_route ON public.product_regulatory(route_id);
CREATE INDEX IF NOT EXISTS idx_pr_item_type ON public.product_regulatory(item_type);
CREATE INDEX IF NOT EXISTS idx_pr_rx ON public.product_regulatory(prescription_class) WHERE prescription_class IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pr_sc ON public.product_regulatory(special_control_type) WHERE special_control_type <> 'none';

CREATE OR REPLACE TRIGGER on_updated_at BEFORE UPDATE ON public.product_regulatory
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Lazy auto-create: product mới -> tạo 1 row regulatory rỗng.
-- SECURITY DEFINER: trigger chạy như owner (postgres) để bỏ qua RLS pr_insert,
-- tránh chặn việc tạo product của user (kể cả user không có quyền ghi product_regulatory).
CREATE OR REPLACE FUNCTION public.create_product_regulatory_row() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
BEGIN
  INSERT INTO public.product_regulatory(product_id) VALUES (NEW.id)
  ON CONFLICT (product_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER on_product_created_regulatory
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.create_product_regulatory_row();

ALTER TABLE public.product_regulatory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pr_select" ON public.product_regulatory;
CREATE POLICY "pr_select" ON public.product_regulatory FOR SELECT USING (public.is_authenticated());
DROP POLICY IF EXISTS "pr_insert" ON public.product_regulatory;
CREATE POLICY "pr_insert" ON public.product_regulatory FOR INSERT WITH CHECK (public.user_has_permission('inventory.product.edit_info'));
DROP POLICY IF EXISTS "pr_update" ON public.product_regulatory;
CREATE POLICY "pr_update" ON public.product_regulatory FOR UPDATE USING (public.user_has_permission('inventory.product.edit_info'));
DROP POLICY IF EXISTS "pr_delete" ON public.product_regulatory;
CREATE POLICY "pr_delete" ON public.product_regulatory FOR DELETE USING (public.user_has_permission('inventory.product.edit_info'));

COMMIT;
```

> **Vì sao `SECURITY DEFINER`:** hàm trigger mặc định (SECURITY INVOKER) chạy dưới role người tạo product nên vẫn chịu RLS `pr_insert` — sẽ chặn nếu user thiếu `inventory.product.edit_info`. `SECURITY DEFINER` + `SET search_path = public` cho trigger chạy như owner (bỏ qua RLS), đảm bảo mọi product mới đều có row regulatory. Row tạo ra rỗng (chỉ `product_id`) nên không có rủi ro leo thang quyền.

- [ ] **Step 2: Áp migration local**

Run: `npx supabase migration up`
Expected: áp không lỗi.

- [ ] **Step 3: Thêm test**

Thêm vào `tests/rpc/drug-classification.test.ts`:
```typescript
describe("product_regulatory", () => {
  it("trigger tự tạo row regulatory khi tạo product mới", async () => {
    const productId = await createTempProduct("autoreg");
    const { data, error } = await adminClient
      .from("product_regulatory")
      .select("item_type,prescription_class")
      .eq("product_id", productId)
      .single();
    expect(error).toBeNull();
    expect(data?.item_type).toBe("drug");
    expect(data?.prescription_class).toBeNull();
  });

  it("CHECK chặn cờ kiểm soát khi item_type != 'drug'", async () => {
    const productId = await createTempProduct("badtpcn");
    const { error } = await adminClient
      .from("product_regulatory")
      .update({ item_type: "supplement", is_vaccine: true })
      .eq("product_id", productId);
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 4: Chạy test**

Run: `npm run test:rpc -- tests/rpc/drug-classification.test.ts`
Expected: PASS (trigger SECURITY DEFINER nên tạo product không bị RLS chặn).

- [ ] **Step 5: Commit**

```bash
git -C nam_viet_erp add supabase/migrations/20260602093300_product_regulatory.sql tests/rpc/drug-classification.test.ts
git -C nam_viet_erp commit -m "feat(db): bảng product_regulatory 1-1 + trigger auto-create + CHECK + test"
```

---

## Task 5: `warehouses.outlet_type` + `selling_rules` (+ seed ma trận)

**Files:**
- Create: `nam_viet_erp/supabase/migrations/20260602093400_selling_rules.sql`
- Test: `nam_viet_erp/tests/rpc/drug-classification.test.ts` (thêm describe)

- [ ] **Step 1: Viết migration**

Create `nam_viet_erp/supabase/migrations/20260602093400_selling_rules.sql`:
```sql
-- warehouses.outlet_type + ma trận selling_rules (+ seed). Ngày: 2026-06-02
BEGIN;

ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS outlet_type text
  CHECK (outlet_type IN ('pharmacy','drug_counter','health_station','wholesale','warehouse'));

CREATE TABLE IF NOT EXISTS public.selling_rules (
  id                       integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outlet_type              text NOT NULL
                             CHECK (outlet_type IN ('pharmacy','drug_counter','health_station','wholesale','warehouse')),
  rule_key                 text NOT NULL
                             CHECK (rule_key IN ('rx','otc','unclassified','sc_combination','sc_restricted',
                                                 'sc_radioactive','restricted_retail','vaccine',
                                                 'supplement','medical_device','herbal','cosmetic')),
  is_allowed               boolean NOT NULL,
  allowed_if_essential     boolean NOT NULL DEFAULT false,
  requires_prescription    boolean NOT NULL DEFAULT false,
  requires_special_license boolean NOT NULL DEFAULT false,
  note                     text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_selling_rule ON public.selling_rules(outlet_type, rule_key);

CREATE OR REPLACE TRIGGER on_updated_at BEFORE UPDATE ON public.selling_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed ma trận: chỉ seed dòng ĐƯỢC PHÉP (+ dòng rx mang allowed_if_essential). Thiếu row = cấm.
INSERT INTO public.selling_rules
  (outlet_type, rule_key, is_allowed, allowed_if_essential, requires_prescription, requires_special_license, note) VALUES
  ('pharmacy','rx',               true,  false, true,  false, 'Nhà thuốc bán thuốc kê đơn (Điều 47)'),
  ('pharmacy','otc',              true,  false, false, false, NULL),
  ('pharmacy','sc_combination',   true,  false, true,  true,  'KSĐB dạng phối hợp, đủ điều kiện Điều 34'),
  ('pharmacy','sc_restricted',    true,  false, true,  true,  'Gây nghiện/hướng thần/tiền chất/độc — nhà thuốc đủ điều kiện Điều 34'),
  ('pharmacy','restricted_retail',true,  false, false, true,  'Hạn chế bán lẻ, cần chấp thuận Điều 34'),
  ('pharmacy','supplement',       true,  false, false, false, NULL),
  ('pharmacy','medical_device',   true,  false, false, false, NULL),
  ('pharmacy','herbal',           true,  false, false, false, NULL),
  ('pharmacy','cosmetic',         true,  false, false, false, NULL),
  ('drug_counter','otc',          true,  false, false, false, NULL),
  ('drug_counter','rx',           false, true,  true,  false, 'Quầy chỉ bán Rx nếu thuốc thuộc DM thiết yếu (Điều 48)'),
  ('drug_counter','sc_combination',true, false, true,  true,  'KSĐB dạng phối hợp'),
  ('drug_counter','restricted_retail',true,false,false, true, 'Cần chấp thuận Điều 34'),
  ('drug_counter','supplement',   true,  false, false, false, NULL),
  ('drug_counter','medical_device',true, false, false, false, NULL),
  ('drug_counter','herbal',       true,  false, false, false, NULL),
  ('drug_counter','cosmetic',     true,  false, false, false, NULL),
  ('health_station','otc',        true,  false, false, false, 'Tủ thuốc TYT theo phân tuyến (Điều 49)'),
  ('health_station','rx',         false, true,  true,  false, 'Rx thuộc DM thiết yếu theo phân tuyến'),
  ('health_station','supplement', true,  false, false, false, NULL),
  ('health_station','medical_device',true,false,false, false, NULL)
ON CONFLICT (outlet_type, rule_key) DO NOTHING;

ALTER TABLE public.selling_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "selling_rules_select" ON public.selling_rules;
CREATE POLICY "selling_rules_select" ON public.selling_rules FOR SELECT USING (public.is_authenticated());
DROP POLICY IF EXISTS "selling_rules_insert" ON public.selling_rules;
CREATE POLICY "selling_rules_insert" ON public.selling_rules FOR INSERT WITH CHECK (public.user_has_permission('catalog.classification.manage'));
DROP POLICY IF EXISTS "selling_rules_update" ON public.selling_rules;
CREATE POLICY "selling_rules_update" ON public.selling_rules FOR UPDATE USING (public.user_has_permission('catalog.classification.manage'));
DROP POLICY IF EXISTS "selling_rules_delete" ON public.selling_rules;
CREATE POLICY "selling_rules_delete" ON public.selling_rules FOR DELETE USING (public.user_has_permission('catalog.classification.manage'));

COMMIT;
```

- [ ] **Step 2: Áp migration local**

Run: `npx supabase migration up`
Expected: áp không lỗi.

- [ ] **Step 3: Thêm test**

Thêm vào `tests/rpc/drug-classification.test.ts`:
```typescript
describe("selling_rules seed", () => {
  it("nhà thuốc bán rx, quầy KHÔNG bán rx (chỉ allowed_if_essential)", async () => {
    const { data: pharm } = await adminClient
      .from("selling_rules").select("is_allowed,allowed_if_essential")
      .eq("outlet_type", "pharmacy").eq("rule_key", "rx").single();
    expect(pharm?.is_allowed).toBe(true);

    const { data: counter } = await adminClient
      .from("selling_rules").select("is_allowed,allowed_if_essential")
      .eq("outlet_type", "drug_counter").eq("rule_key", "rx").single();
    expect(counter?.is_allowed).toBe(false);
    expect(counter?.allowed_if_essential).toBe(true);
  });
  it("không seed vaccine/sc_radioactive (=> cấm mặc định)", async () => {
    const { data } = await adminClient
      .from("selling_rules").select("id")
      .in("rule_key", ["vaccine", "sc_radioactive"]);
    expect((data ?? []).length).toBe(0);
  });
});
```

- [ ] **Step 4: Chạy test**

Run: `npm run test:rpc -- tests/rpc/drug-classification.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C nam_viet_erp add supabase/migrations/20260602093400_selling_rules.sql tests/rpc/drug-classification.test.ts
git -C nam_viet_erp commit -m "feat(db): warehouses.outlet_type + selling_rules + seed ma trận + test"
```

---

## Task 6: Hàm `resolve_selling_rule_key` + `can_outlet_sell`

**Files:**
- Create: `nam_viet_erp/supabase/migrations/20260602093500_selling_functions.sql`
- Test: `nam_viet_erp/tests/rpc/drug-classification.test.ts` (thêm describe)

- [ ] **Step 1: Viết migration (2 hàm)**

Create `nam_viet_erp/supabase/migrations/20260602093500_selling_functions.sql`:
```sql
-- Hàm phân giải rule_key + kiểm tra quyền bán (chỉ dùng hiển thị Phase 1). Ngày: 2026-06-02
BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_selling_rule_key(p_product_id bigint)
RETURNS text
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE pr public.product_regulatory;
BEGIN
  SELECT * INTO pr FROM public.product_regulatory WHERE product_id = p_product_id;
  IF COALESCE(pr.is_vaccine, false) THEN RETURN 'vaccine'; END IF;
  IF pr.special_control_type = 'radioactive' THEN RETURN 'sc_radioactive'; END IF;
  IF pr.special_control_type IN ('narcotic','psychotropic','precursor','toxic') THEN RETURN 'sc_restricted'; END IF;
  IF pr.special_control_type = 'combination' THEN RETURN 'sc_combination'; END IF;
  IF COALESCE(pr.is_restricted_retail, false) THEN RETURN 'restricted_retail'; END IF;
  CASE COALESCE(pr.item_type, 'drug')
    WHEN 'supplement'     THEN RETURN 'supplement';
    WHEN 'medical_device' THEN RETURN 'medical_device';
    WHEN 'herbal'         THEN RETURN 'herbal';
    WHEN 'cosmetic'       THEN RETURN 'cosmetic';
    ELSE NULL;  -- item_type = 'drug' (hoặc thiếu row)
  END CASE;
  IF pr.prescription_class = 'rx'  THEN RETURN 'rx';  END IF;
  IF pr.prescription_class = 'otc' THEN RETURN 'otc'; END IF;
  RETURN 'unclassified';
END;
$$;

CREATE OR REPLACE FUNCTION public.can_outlet_sell(p_outlet_type text, p_product_id bigint)
RETURNS TABLE(allowed boolean, requires_prescription boolean, requires_special_license boolean, rule_key text, reason text)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  k text;
  r public.selling_rules;
  v_essential boolean;
  v_rx boolean;
BEGIN
  IF p_outlet_type IS NULL THEN
    RETURN QUERY SELECT NULL::boolean, false, false, NULL::text, 'CHUA_XAC_DINH_CO_SO'::text;
    RETURN;
  END IF;
  k := public.resolve_selling_rule_key(p_product_id);
  SELECT COALESCE(pr.is_essential, false), COALESCE(pr.prescription_class = 'rx', false)
    INTO v_essential, v_rx
    FROM public.product_regulatory pr WHERE pr.product_id = p_product_id;
  v_essential := COALESCE(v_essential, false);
  v_rx := COALESCE(v_rx, false);
  SELECT * INTO r FROM public.selling_rules WHERE outlet_type = p_outlet_type AND rule_key = k;
  RETURN QUERY SELECT
    (COALESCE(r.is_allowed, false) OR (COALESCE(r.allowed_if_essential, false) AND v_essential)),
    (COALESCE(r.requires_prescription, false) OR v_rx),
    COALESCE(r.requires_special_license, false),
    k,
    CASE WHEN k = 'unclassified' THEN 'CHUA_PHAN_LOAI'::text ELSE NULL::text END;
END;
$$;

COMMIT;
```

- [ ] **Step 2: Áp migration local**

Run: `npx supabase migration up`
Expected: áp không lỗi.

- [ ] **Step 3: Thêm test (bảng quyết định + ma trận)**

Thêm vào `tests/rpc/drug-classification.test.ts`:
```typescript
describe("resolve_selling_rule_key (bảng quyết định)", () => {
  // helper: tạo product + set regulatory, trả product_id
  async function regProduct(label: string, fields: Record<string, unknown>): Promise<number> {
    const productId = await createTempProduct(label);
    await adminClient.from("product_regulatory").update(fields).eq("product_id", productId);
    return productId;
  }
  async function ruleKey(productId: number): Promise<string> {
    const { data, error } = await adminClient.rpc("resolve_selling_rule_key", { p_product_id: productId });
    expect(error).toBeNull();
    return data as unknown as string;
  }

  it("vắc xin > mọi cờ khác", async () => {
    const id = await regProduct("vax", { item_type: "drug", is_vaccine: true, prescription_class: "rx" });
    expect(await ruleKey(id)).toBe("vaccine");
  });
  it("phóng xạ -> sc_radioactive", async () => {
    const id = await regProduct("rad", { special_control_type: "radioactive" });
    expect(await ruleKey(id)).toBe("sc_radioactive");
  });
  it("gây nghiện -> sc_restricted", async () => {
    const id = await regProduct("narc", { special_control_type: "narcotic" });
    expect(await ruleKey(id)).toBe("sc_restricted");
  });
  it("phối hợp -> sc_combination", async () => {
    const id = await regProduct("combo2", { special_control_type: "combination" });
    expect(await ruleKey(id)).toBe("sc_combination");
  });
  it("hạn chế bán lẻ -> restricted_retail", async () => {
    const id = await regProduct("restr", { is_restricted_retail: true });
    expect(await ruleKey(id)).toBe("restricted_retail");
  });
  it("TPCN -> supplement", async () => {
    const id = await regProduct("supp", { item_type: "supplement" });
    expect(await ruleKey(id)).toBe("supplement");
  });
  it("thiết bị -> medical_device", async () => {
    const id = await regProduct("dev", { item_type: "medical_device" });
    expect(await ruleKey(id)).toBe("medical_device");
  });
  it("thuốc Rx -> rx", async () => {
    const id = await regProduct("rx1", { item_type: "drug", prescription_class: "rx" });
    expect(await ruleKey(id)).toBe("rx");
  });
  it("thuốc OTC -> otc", async () => {
    const id = await regProduct("otc1", { item_type: "drug", prescription_class: "otc" });
    expect(await ruleKey(id)).toBe("otc");
  });
  it("chưa phân loại (NULL) -> unclassified", async () => {
    const id = await createTempProduct("unclass"); // giữ default: drug + prescription_class NULL
    expect(await ruleKey(id)).toBe("unclassified");
  });
});

describe("can_outlet_sell (ma trận)", () => {
  async function regProduct(label: string, fields: Record<string, unknown>): Promise<number> {
    const productId = await createTempProduct(label);
    await adminClient.from("product_regulatory").update(fields).eq("product_id", productId);
    return productId;
  }
  async function check(outlet: string | null, productId: number) {
    const { data, error } = await adminClient.rpc("can_outlet_sell", {
      p_outlet_type: outlet, p_product_id: productId,
    });
    expect(error).toBeNull();
    return (data as unknown as Array<{ allowed: boolean; requires_prescription: boolean; rule_key: string; reason: string | null }>)[0];
  }

  it("nhà thuốc bán Rx (cần đơn)", async () => {
    const id = await regProduct("rxsell", { prescription_class: "rx" });
    const res = await check("pharmacy", id);
    expect(res.allowed).toBe(true);
    expect(res.requires_prescription).toBe(true);
  });
  it("quầy KHÔNG bán Rx thường", async () => {
    const id = await regProduct("rxcounter", { prescription_class: "rx", is_essential: false });
    const res = await check("drug_counter", id);
    expect(res.allowed).toBe(false);
  });
  it("quầy bán Rx nếu thuộc DM thiết yếu", async () => {
    const id = await regProduct("rxess", { prescription_class: "rx", is_essential: true });
    const res = await check("drug_counter", id);
    expect(res.allowed).toBe(true);
    expect(res.requires_prescription).toBe(true);
  });
  it("vắc xin cấm bán lẻ mọi cơ sở", async () => {
    const id = await regProduct("vaxsell", { is_vaccine: true });
    expect((await check("pharmacy", id)).allowed).toBe(false);
    expect((await check("drug_counter", id)).allowed).toBe(false);
  });
  it("quầy không bán thuốc gây nghiện (sc_restricted không seed cho quầy)", async () => {
    const id = await regProduct("narccounter", { special_control_type: "narcotic" });
    expect((await check("drug_counter", id)).allowed).toBe(false);
    expect((await check("pharmacy", id)).allowed).toBe(true);
  });
  it("chưa xác định cơ sở -> reason CHUA_XAC_DINH_CO_SO", async () => {
    const id = await createTempProduct("nooutlet");
    const res = await check(null, id);
    expect(res.allowed).toBeNull();
    expect(res.reason).toBe("CHUA_XAC_DINH_CO_SO");
  });
  it("chưa phân loại -> reason CHUA_PHAN_LOAI", async () => {
    const id = await createTempProduct("unclass2");
    const res = await check("pharmacy", id);
    expect(res.rule_key).toBe("unclassified");
    expect(res.reason).toBe("CHUA_PHAN_LOAI");
    expect(res.allowed).toBe(false);
  });
});
```

- [ ] **Step 4: Chạy test**

Run: `npm run test:rpc -- tests/rpc/drug-classification.test.ts`
Expected: tất cả PASS.

- [ ] **Step 5: Commit**

```bash
git -C nam_viet_erp add supabase/migrations/20260602093500_selling_functions.sql tests/rpc/drug-classification.test.ts
git -C nam_viet_erp commit -m "feat(db): hàm resolve_selling_rule_key + can_outlet_sell + test bảng quyết định"
```

---

## Task 7: Thêm permission `catalog.classification.manage`

**Files:**
- Modify: `nam_viet_erp/src/features/auth/constants/permissions.ts`

- [ ] **Step 1: Thêm group CATALOG vào object PERMISSIONS**

Trong `src/features/auth/constants/permissions.ts`, thêm group mới (đặt cạnh các group khác trong object `PERMISSIONS`, giữ đúng style hiện có):
```typescript
  CATALOG: {
    CLASSIFICATION: {
      MANAGE: "catalog.classification.manage",
    },
  },
```

- [ ] **Step 2: Typecheck + lint**

Run:
```bash
npm run test:types
npm run lint
```
Expected: không lỗi type, không lỗi lint cho file vừa sửa.

- [ ] **Step 3: Commit**

```bash
git -C nam_viet_erp add src/features/auth/constants/permissions.ts
git -C nam_viet_erp commit -m "feat(auth): thêm permission catalog.classification.manage cho cấu hình ma trận quyền bán"
```

> **Ghi chú vận hành (ngoài code):** permission `catalog.classification.manage` cần được gán cho role admin trong dữ liệu `role_permissions` (qua UI phân quyền hoặc seed riêng) để người cấu hình `selling_rules` ghi được. Đây là bước data, không thuộc migration schema.

---

## Task 8: Regenerate TypeScript types

**Files:**
- Regenerate: `nam_viet_erp/src/shared/types/database.types.ts`

- [ ] **Step 1: Đảm bảo local DB đã áp đủ migration**

Run: `npx supabase db reset`
Expected: áp toàn bộ migration (gồm 6 file mới) + seed, không lỗi → xác nhận luôn tính idempotent của seed/policy.

- [ ] **Step 2: Generate types**

Run: `npm run typegen`
Expected: cập nhật `src/shared/types/database.types.ts`.

- [ ] **Step 3: Xác nhận các bảng mới có trong types**

Run: `grep -E "active_ingredients|product_regulatory|selling_rules|dosage_forms|routes_of_administration|product_active_ingredients" src/shared/types/database.types.ts | head`
Expected: thấy tên 6 bảng mới.

- [ ] **Step 4: Typecheck**

Run: `npm run test:types`
Expected: không lỗi.

- [ ] **Step 5: Commit**

```bash
git -C nam_viet_erp add src/shared/types/database.types.ts
git -C nam_viet_erp commit -m "chore(types): regenerate database.types.ts sau migration hoạt chất/phân loại"
```

---

## Task 9: Verify toàn bộ Phase 1 Schema

**Files:** none (chỉ chạy verify).

- [ ] **Step 1: RLS smoke test — user thiếu permission KHÔNG ghi được selling_rules**

Thêm vào `tests/rpc/drug-classification.test.ts` (chỉ chạy local — bỏ qua khi prod):
```typescript
import { createTestAuthedClient, isProduction } from "../helpers/supabase";

describe("RLS selling_rules", () => {
  it("user đăng nhập đọc được selling_rules, nhưng KHÔNG ghi (thiếu catalog.classification.manage)", async () => {
    if (isProduction) return; // authed client local-only
    let authed;
    try { authed = await createTestAuthedClient(); } catch { return; }
    // SELECT được (is_authenticated)
    const { data, error } = await authed.from("selling_rules").select("id").limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    // INSERT bị chặn (thiếu permission mới, chưa gán cho test user)
    const { error: insErr } = await authed
      .from("selling_rules")
      .insert({ outlet_type: "pharmacy", rule_key: "otc", is_allowed: true });
    expect(insErr).not.toBeNull();
  });
});
```

> Đảm bảo `isProduction` được export từ `tests/helpers/supabase.ts` (đã xác nhận có). Nếu tên khác (`isProd`), sửa import cho khớp helper thật.

- [ ] **Step 2: Chạy full test:rpc**

Run: `npm run test:rpc`
Expected: toàn bộ test (gồm `drug-classification.test.ts`) PASS, không làm hỏng test cũ.

- [ ] **Step 3: Chạy unit + lint + build**

Run:
```bash
npm run test:unit
npm run lint
npm run build
```
Expected: tất cả PASS (build = `tsc && vite build` không lỗi type).

- [ ] **Step 4: Verify idempotency lần cuối**

Run: `npx supabase db reset`
Expected: áp lại toàn bộ migration + seed không lỗi, không nhân đôi row seed (nhờ `ON CONFLICT`).

- [ ] **Step 5: Commit phần test RLS + tổng kết**

```bash
git -C nam_viet_erp add tests/rpc/drug-classification.test.ts
git -C nam_viet_erp commit -m "test(rpc): RLS gate selling_rules + hoàn tất Phase 1 schema"
```

---

## Definition of Done (Phase 1 — Schema)

- [ ] 6 migration áp sạch qua `npx supabase db reset` (idempotent).
- [ ] 6 bảng + `warehouses.outlet_type` + 2 hàm tồn tại, có RLS đủ 4 policy + trigger `handle_updated_at`.
- [ ] Trigger `AFTER INSERT ON products` tự tạo row `product_regulatory`.
- [ ] Seed `dosage_forms`/`routes`/`selling_rules` đúng; ma trận khớp spec mục 4.9.
- [ ] `resolve_selling_rule_key` đúng cả 12 nhánh bảng quyết định; `can_outlet_sell` đúng các ca trọng yếu.
- [ ] `permissions.ts` có `catalog.classification.manage`; `database.types.ts` đã regenerate.
- [ ] `test:rpc`, `test:unit`, `lint`, `build` đều xanh.

## Plan kế tiếp (ngoài phạm vi file này)
- **Plan 2 — Backfill** (`docs/superpowers/plans/...-phase1-backfill.md`): script tay tách `products.active_ingredient` text → `active_ingredients` + `product_active_ingredients`, review thủ công.
- **Plan 3 — Data layer + UI** (`...-phase1-data-ui.md`): `safeRpc` + RPC `get_product_regulatory`; UI quản lý hoạt chất, khối hoạt chất/phân loại trong `src/pages/inventory/ProductFormPage.tsx`, set `outlet_type` cho kho, bảng "cơ sở được bán". (Cần đọc kỹ `ProductFormPage.tsx` + store liên quan trước khi viết plan này.)
