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
-- SECURITY DEFINER: chạy như owner để bỏ qua RLS pr_insert, tránh chặn việc tạo product
-- của user không có quyền ghi product_regulatory. Row tạo ra rỗng (chỉ product_id).
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
