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
