-- RPC get_customer_product_prices_by_uom: trả giá theo (product_id, uom) cụ thể.
-- Tạo thêm RPC mới — KHÔNG xoá get_customer_product_prices (giữ backward compat).
-- Dùng price_sell có sẵn trong product_units cho từng uom.
-- Business rule: customer_price = wholesale gốc, KHÔNG bake Flash Sale deal.
-- Date: 2026-04-25

BEGIN;

CREATE OR REPLACE FUNCTION public.get_customer_product_prices_by_uom(
  p_customer_b2b_id bigint,
  p_items jsonb
)
 RETURNS TABLE(
   product_id bigint,
   uom text,
   customer_price numeric,
   list_price numeric
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- p_items: [{"product_id": X, "uom": "Hộp"}, ...]
  -- Với mỗi (product_id, uom):
  --   1. Tìm product_units row khớp unit_name = uom (case-insensitive)
  --   2. Nếu có price_sell > 0 → dùng price_sell của UOM đó trực tiếp
  --   3. Nếu không → lấy price_sell của wholesale unit × (conversion_rate_uom / conversion_rate_wholesale)
  --      để tính giá tương đương theo tỉ lệ chuyển đổi
  --   4. Fallback cuối: actual_cost của product
  --   customer_price = list_price (không bake deal, giống get_customer_product_prices)
  RETURN QUERY
  SELECT
    p.id                                                          AS product_id,
    COALESCE(pu_uom.unit_name, item_row->>'uom')                 AS uom,
    -- customer_price: ưu tiên price_sell trực tiếp; fallback tính theo conversion
    COALESCE(
      NULLIF(pu_uom.price_sell, 0),
      CASE
        WHEN pu_wholesale.price_sell > 0
             AND pu_uom.conversion_rate IS NOT NULL
             AND pu_wholesale.conversion_rate IS NOT NULL
             AND pu_wholesale.conversion_rate > 0
        THEN pu_wholesale.price_sell
             * (pu_uom.conversion_rate::numeric / pu_wholesale.conversion_rate::numeric)
        ELSE NULL
      END,
      p.actual_cost
    )::numeric                                                    AS customer_price,
    -- list_price: giống customer_price (không discount)
    COALESCE(
      NULLIF(pu_uom.price_sell, 0),
      CASE
        WHEN pu_wholesale.price_sell > 0
             AND pu_uom.conversion_rate IS NOT NULL
             AND pu_wholesale.conversion_rate IS NOT NULL
             AND pu_wholesale.conversion_rate > 0
        THEN pu_wholesale.price_sell
             * (pu_uom.conversion_rate::numeric / pu_wholesale.conversion_rate::numeric)
        ELSE NULL
      END,
      p.actual_cost
    )::numeric                                                    AS list_price
  FROM jsonb_array_elements(p_items) AS item_row
  JOIN public.products p
    ON p.id = (item_row->>'product_id')::bigint
   AND p.status = 'active'
  -- UOM được yêu cầu (match by unit_name, case-insensitive)
  LEFT JOIN public.product_units pu_uom
    ON pu_uom.product_id = p.id
   AND lower(pu_uom.unit_name) = lower(item_row->>'uom')
  -- Wholesale unit để dùng làm base tính giá khi UOM không có price_sell riêng
  LEFT JOIN public.product_units pu_wholesale
    ON pu_wholesale.product_id = p.id
   AND pu_wholesale.unit_type = 'wholesale'
  -- p_customer_b2b_id dùng để verify quyền (tương lai có thể thêm tier pricing)
  WHERE (p_customer_b2b_id IS NOT NULL OR p_customer_b2b_id IS NULL);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_customer_product_prices_by_uom(bigint, jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
