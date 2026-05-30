-- Phase 1 Chatbot — Task 3: product_synonyms + search_products_fts RPC
-- Tạo bảng từ đồng nghĩa SP (xa20, xarelto20, rivaroxaban...) để chatbot match query.
-- Schema thật:
--   products.id           bigint (KHÔNG phải uuid như plan giả định)
--   products.status       text — 'active' filter thay cho is_active
--   products.stock_status text — 'in_stock'/'low_stock'/'out_of_stock' (KHÔNG có cột stock int)
--   products không có cột price_sell — giá B2B nằm ở product_units.price_sell, để layer
--   ứng dụng enrich tùy unit_type. RPC chỉ lo full-text matching.
--   products.fts          tsvector generated (name+sku+active_ingredient+barcode) — tận dụng index có sẵn.

BEGIN;

-- ---------- BẢNG ----------
CREATE TABLE IF NOT EXISTS public.product_synonyms (
  id          bigserial   PRIMARY KEY,
  product_id  bigint      NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  synonym     text        NOT NULL,
  weight      real        NOT NULL DEFAULT 1.0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, synonym)
);

COMMENT ON TABLE public.product_synonyms IS
  'Từ đồng nghĩa cho search SP qua chatbot — xa20, xarelto20, rivaroxaban... Master data, không user-specific.';

CREATE INDEX IF NOT EXISTS product_synonyms_fts_idx
  ON public.product_synonyms USING gin (to_tsvector('simple', synonym));

CREATE INDEX IF NOT EXISTS product_synonyms_product_idx
  ON public.product_synonyms(product_id);

-- ---------- RLS ----------
-- Synonym là master data: ai login (authenticated) đọc được; chỉ admin sửa.
-- anon role KHÔNG được đọc — tránh leak catalog cho khách chưa login.
ALTER TABLE public.product_synonyms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_synonyms_read ON public.product_synonyms;
CREATE POLICY product_synonyms_read
  ON public.product_synonyms
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS product_synonyms_admin_write ON public.product_synonyms;
CREATE POLICY product_synonyms_admin_write
  ON public.product_synonyms
  FOR ALL
  TO authenticated
  USING (coalesce(auth.jwt() ->> 'role', '') = 'admin')
  WITH CHECK (coalesce(auth.jwt() ->> 'role', '') = 'admin');

-- ---------- RPC ----------
-- search_products_fts(q, lim): full-text search trên products.fts + product_synonyms.synonym.
-- Trả về top N sản phẩm active, đã DISTINCT trên product_id, sort theo score DESC.
-- Score = ts_rank trên union của (products.fts ‖ matched synonyms) + weight synonym.
-- SECURITY DEFINER vì cần đọc product_synonyms (RLS chặn anon) — nhưng REVOKE anon ở dưới.
CREATE OR REPLACE FUNCTION public.search_products_fts(q text, lim int DEFAULT 10)
RETURNS TABLE (
  id           bigint,
  name         text,
  sku          text,
  stock_status text,
  score        real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  WITH tsq AS (
    SELECT plainto_tsquery('simple', coalesce(q, '')) AS query
  ),
  matched AS (
    -- Match qua products.fts (name/sku/active_ingredient/barcode)
    SELECT
      p.id,
      p.name,
      p.sku,
      p.stock_status,
      ts_rank(p.fts, tsq.query)::real AS score
    FROM public.products p
    CROSS JOIN tsq
    WHERE p.status = 'active'
      AND p.fts @@ tsq.query

    UNION ALL

    -- Match qua product_synonyms.synonym (xa20, rivaroxaban...)
    SELECT
      p.id,
      p.name,
      p.sku,
      p.stock_status,
      (ts_rank(
        to_tsvector('simple', ps.synonym),
        tsq.query
       ) * ps.weight)::real AS score
    FROM public.product_synonyms ps
    JOIN public.products p ON p.id = ps.product_id
    CROSS JOIN tsq
    WHERE p.status = 'active'
      AND to_tsvector('simple', ps.synonym) @@ tsq.query
  ),
  agg AS (
    SELECT
      m.id,
      max(m.name) AS name,
      max(m.sku) AS sku,
      max(m.stock_status) AS stock_status,
      max(m.score) AS score
    FROM matched m
    GROUP BY m.id
  )
  SELECT a.id, a.name, a.sku, a.stock_status, a.score
  FROM agg a
  WHERE length(coalesce(q, '')) > 0
  ORDER BY a.score DESC, a.id ASC
  LIMIT GREATEST(coalesce(lim, 10), 1);
$$;

COMMENT ON FUNCTION public.search_products_fts(text, int) IS
  'Phase 1 chatbot FTS: search products theo name/sku/active_ingredient/barcode + synonyms. SECURITY DEFINER vì bypass RLS product_synonyms cho authenticated. Anon đã REVOKE.';

-- Khóa anon, chỉ authenticated + service_role được gọi
REVOKE EXECUTE ON FUNCTION public.search_products_fts(text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_products_fts(text, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_products_fts(text, int) TO authenticated, service_role;

COMMIT;
