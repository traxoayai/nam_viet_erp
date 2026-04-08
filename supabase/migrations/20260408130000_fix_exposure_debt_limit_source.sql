-- =========================================================================
-- HOTFIX: get_customer_exposure_summary references d.debt_limit from
-- b2b_customer_debt_view, but that view does NOT have debt_limit column.
-- debt_limit lives on customers_b2b table.
-- Fix: Get debt_limit from customers_b2b, actual_debt from the view.
-- =========================================================================

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

    -- C. Sum of all PENDING/CONFIRMED orders not yet in actual debt
    SELECT COALESCE(SUM(o.final_amount), 0)
    INTO v_pending
    FROM public.orders o
    WHERE o.customer_id = p_customer_id
      AND o.status IN ('PENDING', 'CONFIRMED');

    -- D. Return result
    RETURN QUERY SELECT
        v_actual,
        v_pending,
        (v_actual + v_pending) as _total_exposure,
        v_limit,
        (v_limit - (v_actual + v_pending)) as _available_credit;
END;
$$;
