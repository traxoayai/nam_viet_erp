-- =====================================================================
-- Seed: hóa đơn bán demo (public.sales_invoices) cho Portal B2B
--
-- Chạy tự động sau migrations khi: supabase db reset
-- Chạy tay trên remote/staging: psql $DATABASE_URL -f supabase/seed.sql
--
-- Điều kiện: có portal_users (active) + orders (không CANCELLED) cùng customer_id
-- Idempotent: không insert nếu đã tồn tại sales_invoices.order_id = orders.id
-- Không UPDATE/XÓA bảng khác; chỉ thêm dòng mới vào sales_invoices.
-- =====================================================================

INSERT INTO public.sales_invoices (
  invoice_date,
  invoice_number,
  invoice_serial,
  invoice_template_code,
  buyer_name,
  buyer_company_name,
  buyer_tax_code,
  buyer_email,
  buyer_address,
  payment_method,
  total_amount_pre_tax,
  vat_rate,
  vat_amount,
  final_amount,
  status,
  customer_id,
  order_id,
  created_at,
  updated_at
)
SELECT
  (o.created_at AT TIME ZONE 'UTC')::date,
  'DEMO-' || o.code,
  'C25TAA',
  '1/001',
  c.name,
  c.name,
  COALESCE(NULLIF(btrim(COALESCE(c.tax_code, '')), ''), '0000000000'),
  c.email,
  COALESCE(NULLIF(btrim(COALESCE(c.vat_address, '')), ''), c.shipping_address),
  'CK',
  ROUND((a.amt / 1.1)::numeric, 2),
  10::numeric,
  ROUND((a.amt - (a.amt / 1.1))::numeric, 2),
  a.amt,
  (ARRAY['pending'::text, 'processing', 'issued', 'verified'])[
    1 + (abs(hashtext(o.id::text)) % 4)
  ],
  o.customer_id,
  o.id,
  now(),
  now()
FROM public.orders o
INNER JOIN public.customers_b2b c ON c.id = o.customer_id
INNER JOIN public.portal_users pu
  ON pu.customer_b2b_id = o.customer_id
  AND pu.status = 'active'
CROSS JOIN LATERAL (
  SELECT
    GREATEST(
      COALESCE(o.final_amount, 0)::numeric,
      COALESCE(o.total_amount, 0)::numeric,
      1::numeric
    ) AS amt
) a
WHERE o.customer_id IS NOT NULL
  AND COALESCE(o.status, '') <> 'CANCELLED'
  AND NOT EXISTS (
    SELECT 1
    FROM public.sales_invoices si
    WHERE si.order_id = o.id
  )
ORDER BY o.created_at DESC
LIMIT 15;
