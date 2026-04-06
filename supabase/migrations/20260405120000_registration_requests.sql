-- Registration requests: khách hàng B2B tự đăng ký qua portal
-- Admin ERP duyệt → tạo customers_b2b + portal_users

CREATE TABLE IF NOT EXISTS public.registration_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Thông tin nhà thuốc / doanh nghiệp
  business_name text NOT NULL,
  tax_code text,
  phone text NOT NULL,
  email text NOT NULL,
  address text,
  -- Thông tin người đại diện
  contact_name text NOT NULL,
  contact_phone text,
  contact_email text,
  -- Thông tin bổ sung
  note text,
  -- Trạng thái duyệt
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  -- Khi approved, link tới records đã tạo
  approved_customer_b2b_id integer REFERENCES public.customers_b2b(id),
  approved_portal_user_id uuid,
  approved_by uuid,
  approved_at timestamptz,
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Index cho admin query
CREATE INDEX idx_registration_requests_status ON public.registration_requests(status);
CREATE INDEX idx_registration_requests_email ON public.registration_requests(email);

-- RLS: service_role only (admin via ERP, portal via API route)
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.registration_requests IS 'Yêu cầu đăng ký tài khoản portal B2B - admin duyệt trước khi tạo account';
