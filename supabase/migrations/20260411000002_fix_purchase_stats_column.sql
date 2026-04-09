-- Migration: Fix customer column in get_customer_purchase_stats
-- Date: 2026-04-11 (Using sequential date to follow existing migrations)
-- Description: The original RPC in 20260409100000 used o.customer_b2b_id which does not exist in the orders table. Corrected to o.customer_id.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_customer_purchase_stats(p_customer_id INT, p_limit INT DEFAULT 20)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_data), '[]'::json)
    FROM (
      SELECT oi.product_id, p.name AS product_name, p.sku, p.image_url,
             p.active_ingredient, p.manufacturer_name, p.packing_spec,
             COUNT(DISTINCT o.id) AS order_count,
             SUM(oi.quantity) AS total_quantity_ordered,
             MAX(o.created_at) AS last_ordered_at
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      JOIN public.products p ON p.id = oi.product_id
      WHERE o.customer_id = p_customer_id AND o.status NOT IN ('CANCELLED', 'DRAFT')
      GROUP BY oi.product_id, p.name, p.sku, p.image_url, p.active_ingredient, p.manufacturer_name, p.packing_spec
      ORDER BY order_count DESC, total_quantity_ordered DESC
      LIMIT p_limit
    ) row_data
  );
END;
$$;

COMMIT;
