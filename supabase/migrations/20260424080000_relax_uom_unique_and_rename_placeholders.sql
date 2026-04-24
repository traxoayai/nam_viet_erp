-- Relax UNIQUE constraint (product_id, unit_name) → (product_id, unit_name,
-- unit_type) + enforce same conversion_rate per (product_id, unit_name).
-- Sau đó đổi placeholder "Lẻ"/"Thùng" (conv=1) cho SP phi-dược thành tên
-- trùng với base unit_name (vd Mũ bảo hiểm: 3 row "Cái" base/retail/wholesale).
--
-- User feedback: không thích thấy tên "Lẻ" lạ với SP phi-dược; muốn hiển
-- thị gọn "Cái/Cái/Cái".
--
-- Design an toàn:
-- 1. DROP UNIQUE cũ (product_id, unit_name)
-- 2. ADD UNIQUE (product_id, unit_name, unit_type) — cho phép 1 tên xuất
--    hiện tối đa 1 lần mỗi type (tối đa 3 lần/product)
-- 3. Trigger enforce conversion_rate phải giống nhau giữa các row cùng
--    (product_id, unit_name) → tránh ambiguous khi trigger order_items
--    lookup LIMIT 1
-- 4. Rename "Lẻ"/"Lẻ-<id>"/"Thùng"/"Thùng-<id>" (conv=1) thành base
--    unit_name cho các SP chưa có order ref (tất cả — vì placeholder mới
--    sinh từ 070000 chưa bán)
--
-- Date: 2026-04-24
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Drop old UNIQUE, add composite UNIQUE
-- ============================================================================
ALTER TABLE public.product_units
  DROP CONSTRAINT IF EXISTS product_units_product_id_unit_name_key;

ALTER TABLE public.product_units
  ADD CONSTRAINT product_units_pid_uname_utype_key
  UNIQUE (product_id, unit_name, unit_type);

-- ============================================================================
-- Step 2: Trigger enforce same conversion_rate per (product_id, unit_name)
-- ============================================================================
CREATE OR REPLACE FUNCTION public._enforce_same_conv_rate_per_uom()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
DECLARE v_other NUMERIC;
BEGIN
  SELECT conversion_rate INTO v_other
  FROM public.product_units
  WHERE product_id = NEW.product_id
    AND unit_name = NEW.unit_name
    AND id <> COALESCE(NEW.id, -1)
  LIMIT 1;

  IF v_other IS NOT NULL AND v_other <> NEW.conversion_rate THEN
    RAISE EXCEPTION
      'Đơn vị "%" cho SP % đã có conversion_rate=%; rate mới % sẽ gây ambiguous khi lookup. Dùng tên khác hoặc sync conv.',
      NEW.unit_name, NEW.product_id, v_other, NEW.conversion_rate;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_enforce_same_conv_rate_per_uom
  ON public.product_units;
CREATE TRIGGER trg_enforce_same_conv_rate_per_uom
  BEFORE INSERT OR UPDATE OF unit_name, conversion_rate
  ON public.product_units
  FOR EACH ROW
  EXECUTE FUNCTION public._enforce_same_conv_rate_per_uom();

-- ============================================================================
-- Step 3: Rename placeholder "Lẻ" / "Thùng" (conv=1) sang base unit_name
-- ============================================================================
-- Retail placeholder
UPDATE public.product_units r
SET unit_name = base.unit_name
FROM public.product_units base
WHERE r.product_id = base.product_id
  AND base.is_base = true
  AND r.unit_type = 'retail'
  AND r.conversion_rate = 1
  AND (r.unit_name = 'Lẻ' OR r.unit_name LIKE 'Lẻ-%')
  AND base.conversion_rate = 1
  -- chưa có row cùng (product_id, base.unit_name, retail) khác row này
  AND NOT EXISTS (
    SELECT 1 FROM public.product_units x
    WHERE x.product_id = r.product_id
      AND x.unit_name = base.unit_name
      AND x.unit_type = 'retail'
      AND x.id <> r.id
  );

-- Wholesale placeholder
UPDATE public.product_units w
SET unit_name = base.unit_name
FROM public.product_units base
WHERE w.product_id = base.product_id
  AND base.is_base = true
  AND w.unit_type = 'wholesale'
  AND w.conversion_rate = 1
  AND (w.unit_name = 'Thùng' OR w.unit_name LIKE 'Thùng-%')
  AND base.conversion_rate = 1
  AND NOT EXISTS (
    SELECT 1 FROM public.product_units x
    WHERE x.product_id = w.product_id
      AND x.unit_name = base.unit_name
      AND x.unit_type = 'wholesale'
      AND x.id <> w.id
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
