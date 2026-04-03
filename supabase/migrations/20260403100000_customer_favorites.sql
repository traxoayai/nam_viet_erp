-- Customer favorites / wishlist for Portal
CREATE TABLE public.customer_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_b2b_id BIGINT NOT NULL REFERENCES public.customers_b2b(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_b2b_id, product_id)
);

CREATE INDEX idx_customer_favorites_customer ON customer_favorites(customer_b2b_id);
CREATE INDEX idx_customer_favorites_product ON customer_favorites(product_id);

ALTER TABLE customer_favorites ENABLE ROW LEVEL SECURITY;
