-- ============================================================
-- Bảng product_promotions: khuyến mãi / giảm giá trên sản phẩm
-- Khác bảng promotions (voucher đơn hàng) — đây là deal trên SP
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_deals (
  id serial PRIMARY KEY,
  name text NOT NULL,                           -- "Flash Sale T4", "Giảm giá hè"
  slug text NOT NULL,
  description text,

  -- Loại giảm giá
  discount_type text NOT NULL DEFAULT 'percent'
    CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric(12,2) NOT NULL,        -- 10 (= 10%) hoặc 5000 (= 5.000đ)

  -- Thời gian hiệu lực
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,                         -- NULL = không hết hạn

  -- Trạng thái
  status text DEFAULT 'active' CHECK (status IN ('active', 'scheduled', 'expired', 'inactive')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_deals_slug ON public.product_deals(slug);

-- ============================================================
-- Bảng deal_items: N-N giữa deals và products
-- ============================================================

CREATE TABLE IF NOT EXISTS public.deal_items (
  id serial PRIMARY KEY,
  deal_id integer NOT NULL REFERENCES public.product_deals(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  -- Override giá cho SP cụ thể (nếu khác deal chung)
  override_discount_type text CHECK (override_discount_type IN ('percent', 'fixed')),
  override_discount_value numeric(12,2),

  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(deal_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_items_product ON public.deal_items(product_id);
CREATE INDEX IF NOT EXISTS idx_deal_items_deal ON public.deal_items(deal_id);

-- ============================================================
-- View: SP đang có deal active
-- ============================================================

CREATE OR REPLACE VIEW public.v_active_deals AS
SELECT
  di.product_id,
  d.id AS deal_id,
  d.name AS deal_name,
  d.slug AS deal_slug,
  COALESCE(di.override_discount_type, d.discount_type) AS discount_type,
  COALESCE(di.override_discount_value, d.discount_value) AS discount_value,
  d.start_date,
  d.end_date
FROM public.product_deals d
JOIN public.deal_items di ON di.deal_id = d.id
WHERE d.status = 'active'
  AND d.start_date <= now()
  AND (d.end_date IS NULL OR d.end_date > now());

-- ============================================================
-- Seed: 2 deals demo với SP thật
-- ============================================================

INSERT INTO public.product_deals (id, name, slug, discount_type, discount_value, start_date, end_date, status) VALUES
  (1, 'Flash Sale Tháng 4',  'flash-sale-t4',       'percent', 15, '2026-04-01', '2026-04-30', 'active'),
  (2, 'Combo Hè Khỏe Mạnh', 'combo-he-khoe-manh',  'percent', 10, '2026-04-01', '2026-06-30', 'active')
ON CONFLICT DO NOTHING;

SELECT setval('product_deals_id_seq', (SELECT COALESCE(MAX(id), 1) FROM product_deals));

-- Flash Sale: 10 SP đầu có giá
INSERT INTO public.deal_items (deal_id, product_id)
SELECT 1, p.id
FROM products p
JOIN product_units pu ON pu.product_id = p.id
WHERE p.status = 'active' AND p.category_id IS NOT NULL AND p.category_id != 18
  AND pu.price > 0
GROUP BY p.id
ORDER BY p.id
LIMIT 10
ON CONFLICT DO NOTHING;

-- Combo Hè: 10 SP tiếp theo
INSERT INTO public.deal_items (deal_id, product_id)
SELECT 2, p.id
FROM products p
JOIN product_units pu ON pu.product_id = p.id
WHERE p.status = 'active' AND p.category_id IS NOT NULL AND p.category_id != 18
  AND pu.price > 0
  AND p.id NOT IN (SELECT product_id FROM deal_items WHERE deal_id = 1)
GROUP BY p.id
ORDER BY p.id
LIMIT 10
ON CONFLICT DO NOTHING;
