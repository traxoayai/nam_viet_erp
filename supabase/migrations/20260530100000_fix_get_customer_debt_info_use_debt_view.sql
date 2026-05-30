-- 20260530100000_fix_get_customer_debt_info_use_debt_view.sql
-- Date: 2026-05-30
-- Purpose: Đồng bộ nguồn công nợ cho luồng in đơn (useOrderPrint).
--
-- TRƯỚC: get_customer_debt_info tự tính current_debt qua
--   SUM(final_amount - paid_amount) FROM orders WHERE status NOT IN ('DRAFT','CANCELLED')
--                                          AND payment_status != 'paid'
--   → Lệch với b2b_customer_debt_view (view dùng finance_transactions ledger
--     để cộng "total_paid"), khiến biên lai in có thể khác Inbox/Finance khi
--     payment ghi qua FT nhưng orders.paid_amount chưa được bump (hoặc ngược lại).
--
-- SAU: Lấy actual_current_debt thẳng từ b2b_customer_debt_view, đồng bộ với:
--   - financeService.getB2BDebt (SELECT actual_current_debt FROM view)
--   - get_customer_debt_summary (SELECT ... FROM b2b_customer_debt_view dv)
--   - get_customer_exposure_summary (SELECT ... FROM b2b_customer_debt_view d)
--
-- GIỮ NGUYÊN:
--   - Signature TABLE(customer_id, customer_name, debt_limit, current_debt,
--     available_credit, is_bad_debt) — FE useOrderPrint đọc rows[0].current_debt.
--   - SECURITY DEFINER + GRANT cũ.
--   - Behavior khi không tìm thấy khách: RETURN; (empty rows).

BEGIN;

CREATE OR REPLACE FUNCTION public.get_customer_debt_info(p_customer_id bigint)
RETURNS TABLE(
  customer_id bigint,
  customer_name text,
  debt_limit numeric,
  current_debt numeric,
  available_credit numeric,
  is_bad_debt boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_limit NUMERIC;
  v_debt  NUMERIC;
  v_name  TEXT;
BEGIN
  -- Hạn mức + tên khách
  SELECT c.name, c.debt_limit
    INTO v_name, v_limit
  FROM public.customers_b2b c
  WHERE c.id = p_customer_id;

  IF v_name IS NULL THEN
    RETURN; -- Không tìm thấy khách → empty
  END IF;

  -- Nợ thực tế: LẤY TỪ b2b_customer_debt_view (single source of truth).
  -- View đã tính: total_invoiced (orders PACKED/SHIPPING/DELIVERED/COMPLETED)
  --             - total_paid    (finance_transactions flow='in' completed)
  SELECT COALESCE(dv.actual_current_debt, 0)
    INTO v_debt
  FROM public.b2b_customer_debt_view dv
  WHERE dv.customer_id = p_customer_id;

  v_debt  := COALESCE(v_debt, 0);
  v_limit := COALESCE(v_limit, 0);

  RETURN QUERY SELECT
    p_customer_id,
    v_name,
    v_limit,
    v_debt,
    (v_limit - v_debt),
    (v_debt > v_limit);
END;
$$;

ALTER FUNCTION public.get_customer_debt_info(bigint) OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.get_customer_debt_info(bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_customer_debt_info(bigint) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_customer_debt_info(bigint)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_customer_debt_info(bigint) IS
  'Trả hạn mức + nợ thực tế (từ b2b_customer_debt_view) cho luồng in đơn / kiểm tra credit. Đồng bộ với financeService.getB2BDebt & get_customer_debt_summary. Updated 2026-05-30.';

COMMIT;
