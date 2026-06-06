-- Mapping chi tieu Bang can doi ke toan B01a-DNN (TT133) -> nhom tai khoan. 2026-06-08.
BEGIN;
CREATE TABLE IF NOT EXISTS public.bctc_line_mapping (
  id bigserial PRIMARY KEY,
  report text NOT NULL CHECK (report IN ('B01a')),
  ma_so text NOT NULL,
  ten_chi_tieu text NOT NULL,
  sort_order int NOT NULL,
  account_prefix text NOT NULL,
  sign int NOT NULL DEFAULT 1 CHECK (sign IN (1,-1)),
  side text NOT NULL DEFAULT 'net' CHECK (side IN ('debit','credit','net')),
  UNIQUE (report, ma_so, account_prefix)
);
ALTER TABLE public.bctc_line_mapping ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY bctc_map_read ON public.bctc_line_mapping FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT ON public.bctc_line_mapping TO authenticated; GRANT ALL ON public.bctc_line_mapping TO service_role;
INSERT INTO public.bctc_line_mapping (report, ma_so, ten_chi_tieu, sort_order, account_prefix, sign, side) VALUES
  ('B01a','110','Tien va cac khoan tuong duong tien',1,'111',1,'debit'),
  ('B01a','110','Tien va cac khoan tuong duong tien',1,'112',1,'debit'),
  ('B01a','130','Cac khoan phai thu',3,'131',1,'debit'),
  ('B01a','130','Cac khoan phai thu',3,'138',1,'debit'),
  ('B01a','140','Hang ton kho',5,'152',1,'debit'),
  ('B01a','140','Hang ton kho',5,'153',1,'debit'),
  ('B01a','140','Hang ton kho',5,'156',1,'debit'),
  ('B01a','140','Hang ton kho',5,'154',1,'debit'),
  ('B01a','150','Tai san co dinh',7,'211',1,'debit'),
  ('B01a','150','Tai san co dinh',7,'214',-1,'credit'),
  ('B01a','300','No phai tra',20,'331',1,'credit'),
  ('B01a','300','No phai tra',20,'333',1,'credit'),
  ('B01a','300','No phai tra',20,'334',1,'credit'),
  ('B01a','300','No phai tra',20,'338',1,'credit'),
  ('B01a','300','No phai tra',20,'341',1,'credit'),
  ('B01a','400','Von chu so huu',30,'411',1,'credit'),
  ('B01a','400','Von chu so huu',30,'421',1,'credit')
ON CONFLICT (report, ma_so, account_prefix) DO NOTHING;
COMMIT;
