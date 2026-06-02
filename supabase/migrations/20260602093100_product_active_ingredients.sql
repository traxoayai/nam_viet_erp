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
