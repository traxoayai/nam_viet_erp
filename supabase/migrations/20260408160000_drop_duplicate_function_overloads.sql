-- Drop duplicate function overloads (old signatures no longer used by frontend)
-- 2026-04-08

BEGIN;

-- 1. create_sales_order: old version returns UUID, uses TEXT params
-- Frontend uses new version (returns JSONB, TIMESTAMPTZ delivery_time)
DROP FUNCTION IF EXISTS public.create_sales_order(
  bigint, text, text, text, jsonb, numeric, numeric,
  public.order_status, text, bigint
);

-- 2. confirm_finance_transaction: old version without p_target_status
-- Frontend uses version with p_target_status
DROP FUNCTION IF EXISTS public.confirm_finance_transaction(bigint);

-- 3. create_draft_po: old 4-param version
-- New version has delivery_method, shipping_partner_id, shipping_fee
DROP FUNCTION IF EXISTS public.create_draft_po(
  bigint, timestamptz, text, jsonb
);

-- 4. get_customers_b2c_list: old version without pagination
-- Frontend uses version with page_num, page_size
DROP FUNCTION IF EXISTS public.get_customers_b2c_list(
  text, text, text
);

-- 5. update_purchase_order: old version with p_data jsonb
-- Frontend uses individual params version
DROP FUNCTION IF EXISTS public.update_purchase_order(
  bigint, jsonb, jsonb
);

-- 6. update_user_assignments: old single jsonb version
-- Frontend uses jsonb[] array version
DROP FUNCTION IF EXISTS public.update_user_assignments(uuid, jsonb);

COMMIT;
