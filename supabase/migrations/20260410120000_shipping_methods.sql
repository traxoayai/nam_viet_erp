-- =============================================================================
-- Shipping Methods: 3 phương án vận chuyển
-- Ngày: 2026-04-10
-- =============================================================================
BEGIN;

-- 1. shipping_addresses — Địa chỉ giao hàng structured
CREATE TABLE IF NOT EXISTS public.shipping_addresses (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  customer_b2b_id bigint NOT NULL REFERENCES public.customers_b2b(id),
  label text,
  province_code text NOT NULL,
  district_code text NOT NULL,
  ward_code text NOT NULL,
  street text,
  full_address text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipping_addresses_customer
  ON public.shipping_addresses (customer_b2b_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipping_addresses_default
  ON public.shipping_addresses (customer_b2b_id) WHERE is_default = true;

ALTER TABLE public.shipping_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_shipping_addresses"
  ON public.shipping_addresses FOR ALL
  USING (true) WITH CHECK (true);

-- 2. transport_vehicles — Danh sách xe khách/vận tải
CREATE TABLE IF NOT EXISTS public.transport_vehicles (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name text NOT NULL,
  phone text,
  route text,
  status public.account_status DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.transport_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_transport_vehicles"
  ON public.transport_vehicles FOR ALL
  USING (true) WITH CHECK (true);

-- 3. delivery_routes — Lịch tuyến mặc định theo thứ
CREATE TABLE IF NOT EXISTS public.delivery_routes (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  route_name text NOT NULL,
  district_codes text[] NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.delivery_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_delivery_routes"
  ON public.delivery_routes FOR ALL
  USING (true) WITH CHECK (true);

-- 4. delivery_schedule_overrides — Override ngày cụ thể
CREATE TABLE IF NOT EXISTS public.delivery_schedule_overrides (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  override_date date NOT NULL UNIQUE,
  route_name text,
  district_codes text[],
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.delivery_schedule_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_delivery_schedule_overrides"
  ON public.delivery_schedule_overrides FOR ALL
  USING (true) WITH CHECK (true);

-- 5. Mở rộng orders — thêm shipping fields
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_address_id bigint REFERENCES public.shipping_addresses(id),
  ADD COLUMN IF NOT EXISTS transport_vehicle_id bigint REFERENCES public.transport_vehicles(id),
  ADD COLUMN IF NOT EXISTS custom_vehicle_name text,
  ADD COLUMN IF NOT EXISTS custom_vehicle_phone text,
  ADD COLUMN IF NOT EXISTS custom_vehicle_route text;

COMMIT;
