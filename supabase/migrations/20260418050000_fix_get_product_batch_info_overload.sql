-- Migration: Fix overload conflict get_product_batch_info
-- BUG: Trong prod đang có 2 signatures (bigint + integer) gây PGRST203 error.
-- FIX: DROP cả 2 rồi CREATE lại với BIGINT (match products.id type).
-- Date: 2026-04-18

BEGIN;

-- Drop cả 2 signatures để tránh ambiguous
DROP FUNCTION IF EXISTS public.get_product_batch_info(INTEGER);
DROP FUNCTION IF EXISTS public.get_product_batch_info(BIGINT);

-- Re-create với BIGINT (match products.id)
CREATE OR REPLACE FUNCTION public.get_product_batch_info(p_product_id BIGINT)
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
        AND ib.warehouse_id = v_b2b_wh_id
      ORDER BY b.expiry_date ASC
    ) row_data
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_batch_info(BIGINT)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
