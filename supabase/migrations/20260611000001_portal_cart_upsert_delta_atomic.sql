-- Portal Cart — atomic delta upsert RPC để fix race lost-update
-- Date: 2026-06-11
--
-- Bug trước fix:
--   add_to_cart handler đọc existing.qty rồi UPDATE quantity = existing + delta.
--   2 request song song đọc cùng existing=5 → cả 2 ghi 8 (mất 3) thay vì 11.
--
-- Fix: dồn vào 1 statement atomic INSERT ... ON CONFLICT DO UPDATE
--      SET quantity = portal_cart_items.quantity + EXCLUDED.quantity.
--      Postgres giữ row lock giữa các transaction nên không lost-update.
--
-- UNIQUE constraint (portal_user_id, product_id, uom) đã có sẵn ở migration
-- 20260415200000_portal_cart.sql — không cần tạo lại.
--
-- Stock guard chống oversell: nếu p_max_stock IS NOT NULL và final_qty vượt,
-- revert delta của CHÍNH request này (không đụng delta của request song song
-- khác — chỉ trừ p_delta_qty mình mới thêm vào).

BEGIN;

CREATE OR REPLACE FUNCTION public.portal_cart_upsert_delta(
  p_portal_user_id    UUID,
  p_product_id        BIGINT,
  p_uom               TEXT,
  p_delta_qty         INT,
  p_unit_price        NUMERIC,
  p_conversion_factor INT,
  p_max_stock         INT DEFAULT NULL
)
RETURNS TABLE(final_qty INT, oversold BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty INT;
BEGIN
  IF p_delta_qty IS NULL OR p_delta_qty <= 0 THEN
    RAISE EXCEPTION 'p_delta_qty must be > 0 (got %)', p_delta_qty;
  END IF;

  -- Atomic upsert: nếu row tồn tại → cộng dồn quantity (Postgres giữ row lock
  -- giữa các transaction concurrent nên không bị lost-update). unit_price &
  -- conversion_factor refresh theo giá mới nhất (giữ behavior cũ).
  INSERT INTO public.portal_cart_items (
    portal_user_id, product_id, uom, quantity, unit_price, conversion_factor
  )
  VALUES (
    p_portal_user_id, p_product_id, p_uom, p_delta_qty, p_unit_price, p_conversion_factor
  )
  ON CONFLICT (portal_user_id, product_id, uom)
  DO UPDATE SET
    quantity          = public.portal_cart_items.quantity + EXCLUDED.quantity,
    unit_price        = EXCLUDED.unit_price,
    conversion_factor = EXCLUDED.conversion_factor
  RETURNING quantity INTO v_qty;

  -- Stock guard sau upsert. Trừ ĐÚNG delta của request này (p_delta_qty),
  -- không đụng delta của request song song khác nếu chúng đã insert trước.
  IF p_max_stock IS NOT NULL AND v_qty > p_max_stock THEN
    UPDATE public.portal_cart_items
       SET quantity = public.portal_cart_items.quantity - p_delta_qty
     WHERE portal_user_id = p_portal_user_id
       AND product_id     = p_product_id
       AND uom            = p_uom
    RETURNING quantity INTO v_qty;

    -- Nếu sau revert quantity <= 0 (row chỉ chứa delta của mình) → DELETE
    -- để không vi phạm CHECK (quantity > 0).
    IF v_qty IS NULL OR v_qty <= 0 THEN
      DELETE FROM public.portal_cart_items
       WHERE portal_user_id = p_portal_user_id
         AND product_id     = p_product_id
         AND uom            = p_uom;
      v_qty := 0;
    END IF;

    RETURN QUERY SELECT v_qty, TRUE;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_qty, FALSE;
END;
$$;

COMMENT ON FUNCTION public.portal_cart_upsert_delta(UUID, BIGINT, TEXT, INT, NUMERIC, INT, INT)
  IS 'Atomic delta upsert vào portal_cart_items. Fix race lost-update khi 2+ request thêm vào giỏ cùng lúc. Stock guard tuỳ chọn — vượt sẽ revert chính delta của caller này.';

-- Grant cho cả authenticated (RPC từ user-scoped client) và service_role (chatbot).
GRANT EXECUTE ON FUNCTION public.portal_cart_upsert_delta(UUID, BIGINT, TEXT, INT, NUMERIC, INT, INT)
  TO authenticated, service_role;

COMMIT;
