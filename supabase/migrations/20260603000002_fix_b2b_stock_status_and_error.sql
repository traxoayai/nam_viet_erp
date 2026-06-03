BEGIN;

-- 1. Nâng cấp get_products_stock_status để trả về thêm wholesale_quantity và wholesale_unit
CREATE OR REPLACE FUNCTION public.get_products_stock_status(
  p_product_ids BIGINT[],
  p_warehouse_id BIGINT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSON;
  v_effective_wh BIGINT;
BEGIN
  -- Default về kho B2B nếu client không truyền
  v_effective_wh := COALESCE(p_warehouse_id, public.get_b2b_warehouse_id());

  SELECT json_agg(json_build_object(
    'product_id', pid,
    'total_quantity', COALESCE(s.total_qty, 0), -- Giữ nguyên base unit để không vỡ B2C
    'wholesale_unit', p.wholesale_unit,
    'wholesale_quantity', FLOOR(COALESCE(s.total_qty, 0) / NULLIF(COALESCE(pu.conversion_rate, 1), 0)), -- Tính sẵn theo đơn vị sỉ cho B2B
    'stock_status', CASE
      WHEN COALESCE(s.total_qty, 0) = 0 THEN 'out_of_stock'
      WHEN COALESCE(s.total_qty, 0) <= (50 * COALESCE(pu.conversion_rate, 1)) THEN 'low_stock'
      ELSE 'in_stock'
    END
  )) INTO v_result
  FROM UNNEST(p_product_ids) pid
  LEFT JOIN public.products p ON p.id = pid
  LEFT JOIN public.product_units pu ON pu.product_id = pid AND pu.unit_name = p.wholesale_unit
  LEFT JOIN (
    SELECT
      ib.product_id,
      SUM(ib.quantity) AS total_qty
    FROM public.inventory_batches ib
    WHERE ib.product_id = ANY(p_product_ids)
      AND ib.warehouse_id = v_effective_wh
    GROUP BY ib.product_id
  ) s ON s.product_id = pid;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;


-- 2. Nâng cấp câu thông báo lỗi xuất kho FEFO (_deduct_stock_fefo)
CREATE OR REPLACE FUNCTION public._deduct_stock_fefo(
  p_warehouse_id BIGINT,
  p_product_id BIGINT,
  p_base_quantity NUMERIC,
  p_unit_price NUMERIC,
  p_order_code TEXT,
  p_partner_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET "search_path" TO 'public'
AS $fn$
DECLARE
  v_remaining NUMERIC := p_base_quantity;
  v_deduct NUMERIC;
  v_batch RECORD;
BEGIN
  FOR v_batch IN
    SELECT ib.id, ib.warehouse_id, ib.quantity, ib.batch_id, b.batch_code
    FROM public.inventory_batches ib
    JOIN public.batches b ON ib.batch_id = b.id
    WHERE ib.product_id = p_product_id
      AND ib.quantity > 0
    ORDER BY b.expiry_date ASC, ib.id ASC
  LOOP
    IF v_remaining <= 0 THEN EXIT; END IF;
    v_deduct := LEAST(v_batch.quantity, v_remaining);

    UPDATE public.inventory_batches
    SET quantity = quantity - v_deduct, updated_at = NOW()
    WHERE id = v_batch.id;

    INSERT INTO public.inventory_transactions (
      warehouse_id, product_id, batch_id, partner_id,
      type, action_group, quantity, unit_price,
      ref_id, description, created_by, created_at
    ) VALUES (
      v_batch.warehouse_id, p_product_id, v_batch.batch_id, NULLIF(p_partner_id, '')::BIGINT,
      'out', 'sale', (v_deduct * -1), p_unit_price,
      p_order_code, 'Xuất bán (Lô: ' || v_batch.batch_code || ')',
      auth.uid(), NOW()
    );
    v_remaining := v_remaining - v_deduct;
  END LOOP;

  IF v_remaining > 0 THEN
    DECLARE
      v_pname TEXT;
      v_psku TEXT;
      v_punit TEXT;
      v_conv NUMERIC;
      v_missing NUMERIC;
    BEGIN
      -- Lookup thông tin sản phẩm và quy đổi sang đơn vị sỉ
      SELECT p.name, p.sku, p.wholesale_unit, pu.conversion_rate 
      INTO v_pname, v_psku, v_punit, v_conv
      FROM public.products p
      LEFT JOIN public.product_units pu ON pu.product_id = p.id AND pu.unit_name = p.wholesale_unit
      WHERE p.id = p_product_id;

      -- Tính số lượng thiếu theo đơn vị sỉ
      v_missing := ROUND(v_remaining / NULLIF(COALESCE(v_conv, 1), 0), 2);

      -- Raise exception với câu thông báo mới
      RAISE EXCEPTION 'Không đủ tồn kho cho SP % (SKU: %) sau khi trừ FEFO. Còn thiếu: % %',
        v_pname, v_psku, v_missing, COALESCE(v_punit, 'Đơn vị');
    END;
  END IF;
END;
$fn$;

COMMIT;
