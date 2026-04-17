-- Migration: Portal stock/batch RPCs default về kho B2B khi không truyền warehouse
-- Mục đích: Khi Portal không truyền p_warehouse_id, tồn kho phải lấy từ kho B2B
--           (không SUM toàn hệ thống như hiện tại, khiến Portal thấy cả kho retail)
-- Depends on: 20260417100000_b2b_warehouse_helper.sql
-- Date: 2026-04-17

BEGIN;

-- A. get_products_stock_status: khi p_warehouse_id NULL → dùng kho B2B (không còn SUM tất cả kho)
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
  -- [CHANGED] Default về kho B2B nếu client không truyền
  v_effective_wh := COALESCE(p_warehouse_id, public.get_b2b_warehouse_id());

  SELECT json_agg(json_build_object(
    'product_id', pid,
    'total_quantity', COALESCE(s.total_qty, 0),
    'stock_status', CASE
      WHEN COALESCE(s.total_qty, 0) = 0 THEN 'out_of_stock'
      WHEN COALESCE(s.total_qty, 0) <= 50 THEN 'low_stock'
      ELSE 'in_stock'
    END
  )) INTO v_result
  FROM UNNEST(p_product_ids) pid
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

-- B. get_product_batch_info: thêm filter warehouse_id = kho B2B
CREATE OR REPLACE FUNCTION public.get_product_batch_info(p_product_id INT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_b2b_wh_id BIGINT := public.get_b2b_warehouse_id();
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_data), '[]'::json)
    FROM (
      SELECT b.batch_code, b.expiry_date, ib.quantity, ib.warehouse_id,
             w.name AS warehouse_name
      FROM public.inventory_batches ib
      JOIN public.batches b ON b.id = ib.batch_id
      LEFT JOIN public.warehouses w ON w.id = ib.warehouse_id
      WHERE ib.product_id = p_product_id
        AND ib.quantity > 0
        AND ib.warehouse_id = v_b2b_wh_id  -- [NEW] Chỉ lấy lô ở kho B2B
      ORDER BY b.expiry_date ASC
    ) row_data
  );
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
