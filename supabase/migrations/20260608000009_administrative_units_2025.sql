-- Ban do hanh chinh VN theo cai cach 2025 (Nghi quyet 2025): MO HINH 2 CAP
-- tinh (provinces, 34) + xa/phuong (wards, ~3321), BO cap huyen. Lookup table read-all.
-- Ngay 2026-06-08.
BEGIN;
CREATE TABLE IF NOT EXISTS public.provinces (
  code        text PRIMARY KEY,
  name        text NOT NULL,
  full_name   text,
  code_name   text,
  created_at  timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.wards (
  code           text PRIMARY KEY,
  name           text NOT NULL,
  full_name      text,
  code_name      text,
  province_code  text NOT NULL REFERENCES public.provinces(code),
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wards_province ON public.wards(province_code);

ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wards     ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY provinces_read ON public.provinces FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY wards_read ON public.wards FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT ON public.provinces TO authenticated; GRANT ALL ON public.provinces TO service_role;
GRANT SELECT ON public.wards     TO authenticated; GRANT ALL ON public.wards     TO service_role;

-- Mo hinh 2 cap: dia chi moi khong con cap huyen -> district_code khong con bat buoc.
ALTER TABLE public.shipping_addresses ALTER COLUMN district_code DROP NOT NULL;
COMMIT;
