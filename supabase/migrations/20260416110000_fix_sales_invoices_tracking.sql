-- =============================================================================
-- FIX: Add tracking_code column + update RPC to return it
-- Date: 2026-04-16
-- Issues fixed:
--   1. sales_invoices missing tracking_code column (INSERT fails)
--   2. get_customer_sales_invoices RPC doesn't return tracking_code
-- =============================================================================

-- A. Add tracking_code column
ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS tracking_code TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_invoices_tracking_code
  ON public.sales_invoices(tracking_code)
  WHERE tracking_code IS NOT NULL;

-- B. Update RPC to include tracking_code in output
CREATE OR REPLACE FUNCTION public.get_customer_sales_invoices(
  p_customer_b2b_id BIGINT,
  p_status TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
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
  v_search TEXT;
BEGIN
  IF p_page IS NULL OR p_page < 1 THEN
    p_page := 1;
  END IF;
  IF p_page_size IS NULL OR p_page_size < 1 THEN
    p_page_size := 20;
  END IF;
  IF p_page_size > 100 THEN
    p_page_size := 100;
  END IF;

  v_offset := (p_page - 1) * p_page_size;
  v_search := NULLIF(TRIM(COALESCE(p_search, '')), '');

  SELECT COUNT(*) INTO v_total
  FROM public.sales_invoices si
  LEFT JOIN public.orders o ON o.id = si.order_id
  WHERE si.customer_id = p_customer_b2b_id
    AND (p_status IS NULL OR TRIM(COALESCE(p_status, '')) = '' OR si.status = p_status)
    AND (
      v_search IS NULL
      OR si.invoice_number ILIKE '%' || v_search || '%'
      OR si.invoice_serial ILIKE '%' || v_search || '%'
      OR COALESCE(si.buyer_company_name, '') ILIKE '%' || v_search || '%'
      OR COALESCE(si.buyer_tax_code, '') ILIKE '%' || v_search || '%'
      OR COALESCE(o.code, '') ILIKE '%' || v_search || '%'
      OR COALESCE(si.tracking_code, '') ILIKE '%' || v_search || '%'
    );

  SELECT json_agg(row_data) INTO v_data
  FROM (
    SELECT
      si.id,
      si.invoice_date::text AS invoice_date,
      si.invoice_number,
      si.invoice_serial,
      si.invoice_template_code,
      si.status,
      si.order_id::text AS order_id,
      o.code AS order_code,
      si.total_amount_pre_tax,
      si.vat_amount,
      si.final_amount,
      si.buyer_company_name,
      si.buyer_tax_code,
      si.payment_method,
      si.tracking_code,
      si.created_at::text AS created_at
    FROM public.sales_invoices si
    LEFT JOIN public.orders o ON o.id = si.order_id
    WHERE si.customer_id = p_customer_b2b_id
      AND (p_status IS NULL OR TRIM(COALESCE(p_status, '')) = '' OR si.status = p_status)
      AND (
        v_search IS NULL
        OR si.invoice_number ILIKE '%' || v_search || '%'
        OR si.invoice_serial ILIKE '%' || v_search || '%'
        OR COALESCE(si.buyer_company_name, '') ILIKE '%' || v_search || '%'
        OR COALESCE(si.buyer_tax_code, '') ILIKE '%' || v_search || '%'
        OR COALESCE(o.code, '') ILIKE '%' || v_search || '%'
        OR COALESCE(si.tracking_code, '') ILIKE '%' || v_search || '%'
      )
    ORDER BY si.invoice_date DESC NULLS LAST, si.id DESC
    LIMIT p_page_size OFFSET v_offset
  ) AS row_data;

  RETURN json_build_object(
    'data', COALESCE(v_data, '[]'::json),
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$$;
