-- Stock adjustment bù cho 25 order_items oversell do conversion_factor=1 sai
-- (audit prod 2026-04-24, 30 ngày qua, tổng ~5,100 BASE units dư ảo).
--
-- ASSUMPTION (đã xác nhận với user):
--   - Nhân viên kho đã giao ĐÚNG số lượng theo đơn (vd 4 Hộp = 2000 viên)
--   - Khách không phàn nàn → kho thực đã giảm đúng
--   - DB chỉ trừ 4 viên → DB ảo DƯ 1996 viên so với kho thực
--   → Script bù bằng: insert ADJUSTMENT transaction + trừ batches FEFO
--
-- Thuật toán:
--   1. Lấy 25 order_items có conversion_factor=1 mà product_units.conversion_rate
--      cho UOM đó > 1 (trong 30 ngày).
--   2. Với mỗi item, deduct_stock_fefo thêm (quantity * (actual_factor - 1))
--      BASE units khỏi kho. Reuse helper đã có → đúng FEFO + sinh
--      inventory_transactions entry đồng bộ.
--   3. Ref_code: "ADJ-OVERSELL-<order_code>" để truy ngược.
--
-- Safety:
--   - Nếu batch trong kho không đủ (do đã nhập/xuất khác) →
--     _deduct_stock_fefo RAISE. Migration RAISE NOTICE + skip item đó, ghi
--     vào _stock_adjust_oversell_failures để PM xử lý manual.
--   - Migration idempotent: check existing adjustment trước khi apply.
--
-- Date: 2026-04-24
-- ============================================================================

BEGIN;

-- Bảng log nếu có item nào skip (không đủ tồn để trừ)
CREATE TABLE IF NOT EXISTS public._stock_adjust_oversell_failures (
  id BIGSERIAL PRIMARY KEY,
  order_code TEXT NOT NULL,
  product_id BIGINT NOT NULL,
  uom TEXT NOT NULL,
  missing_base_qty NUMERIC NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
DECLARE
  r RECORD;
  v_missing_base NUMERIC;
  v_ref_code TEXT;
  v_exists BOOLEAN;
BEGIN
  FOR r IN
    SELECT
      oi.id AS oi_id,
      o.id AS order_id,
      o.code AS order_code,
      o.warehouse_id,
      o.customer_id::text AS partner_id,
      oi.product_id,
      oi.uom,
      oi.quantity AS qty_uom,
      oi.conversion_factor AS stored_factor,
      pu.conversion_rate AS actual_factor,
      oi.unit_price
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.product_units pu
      ON pu.product_id = oi.product_id
      AND btrim(pu.unit_name) = btrim(oi.uom)
    WHERE o.created_at >= NOW() - INTERVAL '30 days'
      AND oi.conversion_factor = 1
      AND pu.conversion_rate > 1
      AND o.status IN ('CONFIRMED', 'COMPLETED', 'PACKED', 'SHIPPING', 'DELIVERED', 'DONE')
      AND o.warehouse_id IS NOT NULL
  LOOP
    v_ref_code := 'ADJ-OVERSELL-' || r.order_code || '-' || r.oi_id;
    v_missing_base := r.qty_uom * (r.actual_factor - r.stored_factor);

    -- Idempotent: check xem đã có adjustment cho order_item này chưa
    SELECT EXISTS (
      SELECT 1 FROM public.inventory_transactions
      WHERE note LIKE v_ref_code || '%'
    ) INTO v_exists;

    IF v_exists THEN
      RAISE NOTICE 'SKIP (already adjusted): %', v_ref_code;
      CONTINUE;
    END IF;

    BEGIN
      PERFORM public._deduct_stock_fefo(
        r.warehouse_id,
        r.product_id,
        v_missing_base,
        r.unit_price,
        v_ref_code,
        r.partner_id
      );
      RAISE NOTICE 'ADJUSTED: % (product=%, -% base units)',
        v_ref_code, r.product_id, v_missing_base;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public._stock_adjust_oversell_failures
        (order_code, product_id, uom, missing_base_qty, error_message)
      VALUES
        (r.order_code, r.product_id, r.uom, v_missing_base, SQLERRM);
      RAISE NOTICE 'FAILED: % (err=%)', v_ref_code, SQLERRM;
    END;
  END LOOP;

  -- Update order_items.conversion_factor về đúng để không loop lặp lại khi
  -- chạy migration idempotent.
  UPDATE public.order_items oi
  SET conversion_factor = pu.conversion_rate
  FROM public.orders o, public.product_units pu
  WHERE o.id = oi.order_id
    AND pu.product_id = oi.product_id
    AND btrim(pu.unit_name) = btrim(oi.uom)
    AND o.created_at >= NOW() - INTERVAL '30 days'
    AND oi.conversion_factor = 1
    AND pu.conversion_rate > 1
    AND o.status IN ('CONFIRMED', 'COMPLETED', 'PACKED', 'SHIPPING', 'DELIVERED', 'DONE');
END $$;

COMMIT;

-- VERIFY sau migration:
-- SELECT * FROM public._stock_adjust_oversell_failures;
-- (rỗng = thành công hoàn toàn)
