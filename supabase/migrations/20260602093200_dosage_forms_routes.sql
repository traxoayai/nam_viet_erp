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
