-- =========================================================================
-- FIX: get_customer_exposure_summary trừ paid_amount khỏi pending_orders_total
-- Bug: SUM(final_amount) không trừ paid_amount → phóng đại exposure với
--      đơn partial payment (status PENDING/CONFIRMED nhưng đã trả trước 1 phần).
-- Fix: chỉ tính phần chưa thanh toán = final_amount - COALESCE(paid_amount, 0).
--      Bỏ qua đơn đã trả đủ hoặc dư (net <= 0) để tránh credit âm.
-- 2026-04-25
-- =========================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_customer_exposure_summary(p_customer_id BIGINT)
RETURNS TABLE (
    actual_current_debt NUMERIC,
    pending_orders_total NUMERIC,
    total_exposure NUMERIC,
    debt_limit NUMERIC,
    available_credit NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit NUMERIC;
    v_actual NUMERIC;
    v_pending NUMERIC;
BEGIN
    -- A. Get debt_limit from customers_b2b (NOT the view)
    SELECT c.debt_limit INTO v_limit
    FROM public.customers_b2b c
    WHERE c.id = p_customer_id;

    -- B. Get actual debt from the debt view
    SELECT COALESCE(d.actual_current_debt, 0) INTO v_actual
    FROM public.b2b_customer_debt_view d
    WHERE d.customer_id = p_customer_id;

    v_limit := COALESCE(v_limit, 0);
    v_actual := COALESCE(v_actual, 0);

    -- C. Sum of unpaid portion of PENDING/CONFIRMED orders
    --    Chỉ tính phần chưa thanh toán = final_amount - COALESCE(paid_amount, 0)
    --    WHERE clause loại đơn đã trả đủ/dư (net <= 0) để tránh âm exposure.
    SELECT COALESCE(SUM(o.final_amount - COALESCE(o.paid_amount, 0)), 0)
    INTO v_pending
    FROM public.orders o
    WHERE o.customer_id = p_customer_id
      AND o.status IN ('PENDING', 'CONFIRMED')
      AND (o.final_amount - COALESCE(o.paid_amount, 0)) > 0;

    -- D. Return result (actual_current_debt và available_credit giữ nguyên logic)
    RETURN QUERY SELECT
        v_actual,
        v_pending,
        (v_actual + v_pending) as _total_exposure,
        v_limit,
        (v_limit - (v_actual + v_pending)) as _available_credit;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
