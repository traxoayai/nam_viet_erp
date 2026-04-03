-- =============================================================================
-- Portal Users table + RPCs for B2B Wholesale Portal
-- =============================================================================

-- 1. portal_users table
CREATE TABLE public.portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_b2b_id BIGINT NOT NULL REFERENCES public.customers_b2b(id),
  display_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'staff')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_portal_users_auth ON portal_users(auth_user_id);
CREATE INDEX idx_portal_users_customer ON portal_users(customer_b2b_id);
CREATE INDEX idx_portal_users_email ON portal_users(email);

ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. RPC: get_portal_user_profile
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_portal_user_profile(p_auth_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'portal_user', json_build_object(
      'id', pu.id,
      'auth_user_id', pu.auth_user_id,
      'customer_b2b_id', pu.customer_b2b_id,
      'display_name', pu.display_name,
      'email', pu.email,
      'phone', pu.phone,
      'role', pu.role,
      'status', pu.status,
      'last_login_at', pu.last_login_at
    ),
    'customer', json_build_object(
      'id', c.id,
      'customer_code', c.customer_code,
      'name', c.name,
      'phone', c.phone,
      'email', c.email,
      'tax_code', c.tax_code,
      'vat_address', c.vat_address,
      'shipping_address', c.shipping_address,
      'debt_limit', c.debt_limit,
      'current_debt', c.current_debt,
      'payment_term', c.payment_term,
      'ranking', c.ranking,
      'status', c.status
    )
  ) INTO v_result
  FROM public.portal_users pu
  JOIN public.customers_b2b c ON c.id = pu.customer_b2b_id
  WHERE pu.auth_user_id = p_auth_user_id
    AND pu.status = 'active';

  RETURN v_result;
END;
$$;

-- =============================================================================
-- 3. RPC: get_wholesale_catalog
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_wholesale_catalog(
  p_search TEXT DEFAULT '',
  p_category TEXT DEFAULT '',
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 20
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_offset INT;
  v_total BIGINT;
  v_data JSON;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  -- Count total
  SELECT COUNT(*) INTO v_total
  FROM public.products p
  WHERE p.status = 'active'
    AND (p_search = '' OR p.fts @@ plainto_tsquery('simple', p_search)
         OR p.name ILIKE '%' || p_search || '%'
         OR p.sku ILIKE '%' || p_search || '%'
         OR p.active_ingredient ILIKE '%' || p_search || '%')
    AND (p_category = '' OR p.category_name = p_category);

  -- Get products with wholesale price and stock status
  SELECT json_agg(row_data) INTO v_data
  FROM (
    SELECT
      p.id,
      p.name,
      p.sku,
      p.description,
      p.category_name,
      p.active_ingredient,
      p.manufacturer_name,
      p.image_url,
      p.wholesale_unit,
      p.packing_spec,
      p.registration_number,
      -- Wholesale price from product_units
      COALESCE(
        (SELECT pu.price_sell FROM public.product_units pu
         WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1),
        p.actual_cost
      ) AS price,
      -- Unit name
      COALESCE(
        (SELECT pu.unit_name FROM public.product_units pu
         WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1),
        p.wholesale_unit
      ) AS unit_name,
      -- Stock status
      CASE
        WHEN COALESCE(
          (SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id),
          0
        ) = 0 THEN 'out_of_stock'
        WHEN COALESCE(
          (SELECT SUM(ib.quantity) FROM public.inventory_batches ib WHERE ib.product_id = p.id),
          0
        ) <= 50 THEN 'low_stock'
        ELSE 'in_stock'
      END AS stock_status
    FROM public.products p
    WHERE p.status = 'active'
      AND (p_search = '' OR p.fts @@ plainto_tsquery('simple', p_search)
           OR p.name ILIKE '%' || p_search || '%'
           OR p.sku ILIKE '%' || p_search || '%'
           OR p.active_ingredient ILIKE '%' || p_search || '%')
      AND (p_category = '' OR p.category_name = p_category)
    ORDER BY p.name
    LIMIT p_page_size OFFSET v_offset
  ) row_data;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$$;

-- =============================================================================
-- 4. RPC: get_customer_product_prices
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_customer_product_prices(
  p_customer_b2b_id BIGINT,
  p_product_ids BIGINT[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Phase 1: Return wholesale list price for each product
  -- Phase 2 will add customer_price_list lookup
  SELECT json_agg(json_build_object(
    'product_id', p.id,
    'list_price', COALESCE(
      (SELECT pu.price_sell FROM public.product_units pu
       WHERE pu.product_id = p.id AND pu.unit_type = 'wholesale' LIMIT 1),
      p.actual_cost
    ),
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
    AND p.status = 'active';

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- =============================================================================
-- 5. RPC: get_products_stock_status
-- =============================================================================
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
BEGIN
  SELECT json_agg(json_build_object(
    'product_id', sub.product_id,
    'total_quantity', sub.total_qty,
    'stock_status', CASE
      WHEN sub.total_qty = 0 THEN 'out_of_stock'
      WHEN sub.total_qty <= 50 THEN 'low_stock'
      ELSE 'in_stock'
    END
  )) INTO v_result
  FROM (
    SELECT
      ib.product_id,
      SUM(ib.quantity) AS total_qty
    FROM public.inventory_batches ib
    WHERE ib.product_id = ANY(p_product_ids)
      AND (p_warehouse_id IS NULL OR ib.warehouse_id = p_warehouse_id)
    GROUP BY ib.product_id
  ) sub;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- =============================================================================
-- 6. RPC: get_customer_orders
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_customer_orders(
  p_customer_b2b_id BIGINT,
  p_status TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 20
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_offset INT;
  v_total BIGINT;
  v_data JSON;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  SELECT COUNT(*) INTO v_total
  FROM public.orders o
  WHERE o.customer_id = p_customer_b2b_id
    AND (p_status IS NULL OR o.status = p_status);

  SELECT json_agg(row_data) INTO v_data
  FROM (
    SELECT
      o.id,
      o.code,
      o.status,
      o.payment_status,
      o.total_amount,
      o.final_amount,
      o.shipping_fee,
      o.discount_amount,
      o.delivery_address,
      o.delivery_method,
      o.note,
      o.created_at,
      o.updated_at,
      (SELECT COUNT(*) FROM public.order_items oi WHERE oi.order_id = o.id) AS item_count
    FROM public.orders o
    WHERE o.customer_id = p_customer_b2b_id
      AND (p_status IS NULL OR o.status = p_status)
    ORDER BY o.created_at DESC
    LIMIT p_page_size OFFSET v_offset
  ) row_data;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$$;

-- =============================================================================
-- 7. RPC: get_customer_order_detail
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_customer_order_detail(
  p_order_id UUID,
  p_customer_b2b_id BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order JSON;
  v_items JSON;
BEGIN
  -- Verify ownership
  SELECT json_build_object(
    'id', o.id,
    'code', o.code,
    'status', o.status,
    'payment_status', o.payment_status,
    'payment_method', o.payment_method,
    'total_amount', o.total_amount,
    'final_amount', o.final_amount,
    'shipping_fee', o.shipping_fee,
    'discount_amount', o.discount_amount,
    'delivery_address', o.delivery_address,
    'delivery_method', o.delivery_method,
    'note', o.note,
    'created_at', o.created_at,
    'updated_at', o.updated_at
  ) INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.customer_id = p_customer_b2b_id;

  IF v_order IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get items
  SELECT json_agg(json_build_object(
    'id', oi.id,
    'product_id', oi.product_id,
    'product_name', p.name,
    'product_sku', p.sku,
    'product_image', p.image_url,
    'quantity', oi.quantity,
    'uom', oi.uom,
    'unit_price', oi.unit_price,
    'discount', oi.discount,
    'total_line', oi.total_line,
    'batch_no', oi.batch_no,
    'expiry_date', oi.expiry_date
  )) INTO v_items
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = p_order_id;

  RETURN json_build_object(
    'order', v_order,
    'items', COALESCE(v_items, '[]'::json)
  );
END;
$$;

-- =============================================================================
-- 8. RPC: get_customer_debt_summary
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_customer_debt_summary(
  p_customer_b2b_id BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'customer_id', dv.customer_id,
    'customer_code', dv.customer_code,
    'customer_name', dv.customer_name,
    'total_invoiced', dv.total_invoiced,
    'total_paid', dv.total_paid,
    'actual_current_debt', dv.actual_current_debt,
    'debt_limit', c.debt_limit,
    'payment_term', c.payment_term,
    'available_credit', c.debt_limit - dv.actual_current_debt
  ) INTO v_result
  FROM public.b2b_customer_debt_view dv
  JOIN public.customers_b2b c ON c.id = dv.customer_id
  WHERE dv.customer_id = p_customer_b2b_id;

  RETURN v_result;
END;
$$;
