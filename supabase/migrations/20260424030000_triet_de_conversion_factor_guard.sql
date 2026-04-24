-- FIX TRIỆT ĐỂ oversell conversion_factor. 3 layer bảo vệ:
--
-- Root cause audit:
-- 1. order_items.conversion_factor column có DEFAULT 1 → nếu FE/RPC không
--    set explicit, DB auto điền 1 bất kể UOM thật có factor=500.
-- 2. _resolve_conversion_factor_strict (migration 20260424020000) tin hint
--    bất cứ khi nào hint > 0 → FE hardcode 1 vẫn qua được.
-- 3. Không có trigger sync → bất kỳ INSERT order_items trực tiếp đều có thể
--    lách qua helper.
--
-- Layer 1: DROP DEFAULT 1 trên order_items.conversion_factor → FE buộc
--   phải explicit OR trigger phải compute.
-- Layer 2: Trigger BEFORE INSERT OR UPDATE trên order_items → tự lookup
--   product_units.conversion_rate và OVERRIDE NEW.conversion_factor. DB =
--   single source of truth, FE không thể nhiễm độc.
-- Layer 3: Harden helper strict V2 — raise khi hint > 0 và khác DB (catch
--   FE bug từ RPC layer, báo lỗi rõ cho dev trước khi vào trigger).
--
-- Audit 25 orders 30 ngày qua đã oversell với stored_factor=1. Migration
-- này KHÔNG fix data quá khứ (cần stock adjustment manual), chỉ ngăn
-- tương lai.
-- Date: 2026-04-24
-- ============================================================================

BEGIN;

-- ============================================================================
-- Layer 1: DROP DEFAULT trên order_items.conversion_factor
-- ============================================================================
ALTER TABLE public.order_items ALTER COLUMN conversion_factor DROP DEFAULT;

-- ============================================================================
-- Layer 2: Trigger sync conversion_factor từ product_units
-- ============================================================================
CREATE OR REPLACE FUNCTION public._sync_order_item_conversion_factor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
  v_rate NUMERIC;
  v_valid_units TEXT;
BEGIN
  -- UOM rỗng → reject
  IF NEW.uom IS NULL OR btrim(NEW.uom) = '' THEN
    RAISE EXCEPTION 'order_items.uom không được rỗng (product ID=%)', NEW.product_id;
  END IF;

  -- Lookup conversion_rate từ product_units (trim để an toàn với whitespace)
  SELECT conversion_rate INTO v_rate
  FROM public.product_units
  WHERE product_id = NEW.product_id
    AND btrim(unit_name) = btrim(NEW.uom)
  LIMIT 1;

  IF v_rate IS NULL OR v_rate <= 0 THEN
    SELECT string_agg(unit_name, ', ' ORDER BY conversion_rate)
      INTO v_valid_units
    FROM public.product_units
    WHERE product_id = NEW.product_id;

    RAISE EXCEPTION
      'UOM "%" không tồn tại trong product_units cho sản phẩm ID=%. Đơn vị hợp lệ: %.',
      NEW.uom, NEW.product_id, COALESCE(v_valid_units, '(chưa cấu hình)');
  END IF;

  -- Override conversion_factor: DB = single source of truth
  NEW.conversion_factor := v_rate;

  RETURN NEW;
END;
$fn$;

-- Trigger firing: trước mọi INSERT hoặc UPDATE của product_id/uom
DROP TRIGGER IF EXISTS trg_sync_order_item_conv_factor ON public.order_items;
CREATE TRIGGER trg_sync_order_item_conv_factor
  BEFORE INSERT OR UPDATE OF product_id, uom, conversion_factor
  ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public._sync_order_item_conversion_factor();

-- ============================================================================
-- Layer 3: Harden _resolve_conversion_factor_strict — raise nếu hint ≠ DB
-- ============================================================================
-- Hint > 0 chỉ dùng để XÁC NHẬN (catch FE bug). Nếu khác DB → raise báo
-- FE bug. Nếu hint = 0 hoặc NULL → lookup DB như cũ (strict raise khi UOM
-- không tồn tại).
CREATE OR REPLACE FUNCTION public._resolve_conversion_factor_strict(
  p_product_id BIGINT,
  p_uom TEXT,
  p_explicit_factor NUMERIC DEFAULT 0
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
  v_factor NUMERIC;
  v_valid_units TEXT;
BEGIN
  IF p_uom IS NULL OR btrim(p_uom) = '' THEN
    RAISE EXCEPTION 'Đơn vị tính (uom) không được rỗng cho sản phẩm ID=%.', p_product_id;
  END IF;

  SELECT conversion_rate INTO v_factor
  FROM public.product_units
  WHERE product_id = p_product_id AND btrim(unit_name) = btrim(p_uom)
  LIMIT 1;

  IF v_factor IS NULL OR v_factor <= 0 THEN
    SELECT string_agg(unit_name, ', ' ORDER BY conversion_rate)
      INTO v_valid_units
    FROM public.product_units
    WHERE product_id = p_product_id;

    RAISE EXCEPTION
      'Đơn vị "%" không hợp lệ cho sản phẩm ID=%. Đơn vị hợp lệ: %.',
      p_uom, p_product_id, COALESCE(v_valid_units, '(chưa cấu hình)');
  END IF;

  -- Hint > 0 và khác DB → báo lỗi FE. Trước đây tin hint → bypass bảo vệ.
  IF p_explicit_factor > 0 AND p_explicit_factor <> v_factor THEN
    RAISE EXCEPTION
      'conversion_factor mismatch cho sản phẩm ID=% UOM "%": FE gửi % nhưng DB=%. Lỗi FE — kiểm tra payload.',
      p_product_id, p_uom, p_explicit_factor, v_factor;
  END IF;

  RETURN v_factor;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public._resolve_conversion_factor_strict(BIGINT, TEXT, NUMERIC)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
