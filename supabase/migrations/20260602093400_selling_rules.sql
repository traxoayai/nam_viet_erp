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
  ('pharmacy','sc_restricted',    true,  false, true,  true,  'Gây nghiện/hướng thần/tiền chất/độc - nhà thuốc đủ điều kiện Điều 34'),
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
