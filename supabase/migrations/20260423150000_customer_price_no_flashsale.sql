-- Fix get_customer_product_prices: customer_price KHÔNG bake Flash Sale discount.
-- Trước đây LEAST(wholesale, wholesale * (1-deal%)) → trang detail hiển thị giá
-- đã giảm + add-to-cart lưu giá giảm luôn → lỗ gấp đôi nếu khách áp voucher.
-- Business rule: sale_price chỉ marketing UI (Flash Sale block); cart/checkout
-- dùng wholesale gốc; khách tự chọn voucher ở checkout để apply discount.
-- Date: 2026-04-23

BEGIN;

CREATE OR REPLACE FUNCTION public.get_customer_product_prices(
  p_customer_b2b_id bigint,
  p_product_ids bigint[]
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(json_build_object(
    'product_id', p.id,
    'list_price', COALESCE(
      (SELECT pu.price_sell FROM public.product_units pu
       WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1),
      p.actual_cost
    ),
    -- [FIX] customer_price = wholesale gốc, KHÔNG bake Flash Sale deal.
    -- Active deal chỉ hiển thị ở `sale_price` của /api/deals (Flash Sale block).
    'customer_price', COALESCE(
      (SELECT pu.price_sell FROM public.product_units pu
       WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1),
      p.actual_cost
    ),
    'unit_name', COALESCE(
      (SELECT pu.unit_name FROM public.product_units pu
       WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1),
      p.wholesale_unit
    )
  )) INTO v_result
  FROM public.products p
  WHERE p.id = ANY(p_product_ids)
    AND p.status = 'active'
    AND (p_customer_b2b_id = p_customer_b2b_id);

  RETURN COALESCE(v_result, '[]'::json);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_customer_product_prices(bigint, bigint[]) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
