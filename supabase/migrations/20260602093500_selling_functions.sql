-- Hàm phân giải rule_key + kiểm tra quyền bán (Phase 1 chỉ dùng hiển thị). Ngày: 2026-06-02
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
  SELECT * INTO r FROM public.selling_rules sr WHERE sr.outlet_type = p_outlet_type AND sr.rule_key = k;
  RETURN QUERY SELECT
    (COALESCE(r.is_allowed, false) OR (COALESCE(r.allowed_if_essential, false) AND v_essential)),
    (COALESCE(r.requires_prescription, false) OR v_rx),
    COALESCE(r.requires_special_license, false),
    k,
    CASE WHEN k = 'unclassified' THEN 'CHUA_PHAN_LOAI'::text ELSE NULL::text END;
END;
$$;

COMMIT;
