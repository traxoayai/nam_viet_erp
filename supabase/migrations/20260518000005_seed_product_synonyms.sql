-- 2026-05-18 — Phase 1 Chatbot C2: seed initial pharma synonyms cho chatbot search
-- Mục đích: bootstrap product_synonyms với 30+ cặp brand↔active_ingredient phổ biến VN
-- (Xarelto↔Rivaroxaban, Panadol↔Paracetamol, Augmentin↔Amoxicillin+Acid clavulanic, ...)
-- để chatbot fast-path search_products_fts hit được synonym khi khách gõ tên thương hiệu.
--
-- Schema thật (xem 20260515000003_product_synonyms.sql):
--   product_synonyms(id, product_id NOT NULL FK products(id), synonym, weight, created_at)
--   UNIQUE(product_id, synonym) → ON CONFLICT DO NOTHING là idempotent
--
-- Strategy: với mỗi cặp (brand, ingredient), join lên public.products có
--   p.status = 'active' AND p.active_ingredient ILIKE '%<ingredient>%'
--   rồi INSERT synonym = lower(brand), weight = 1.5 (brand-name hit > generic).
-- Dùng ILIKE %...% để bắt cả compound (vd "Amoxicillin + Acid clavulanic" match nhiều
-- biến thể products có chứa cụm). Nếu products rỗng (local DB chưa seed) thì 0 row
-- được insert — migration vẫn pass.
--
-- KHÔNG seed cặp (synonym='X', canonical='X') (Losartan↔Losartan potassium...) vì
-- search_products_fts đã match qua products.fts (đã có name+active_ingredient). Bộ
-- mapping này TẬP TRUNG vào brand↔generic — phần khách không gõ đúng activeingredient.

BEGIN;

-- Defensive: kiểm tra bảng + cột tồn tại. Nếu schema chưa đúng → raise rõ ràng.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_synonyms'
      AND column_name = 'product_id'
  ) THEN
    RAISE EXCEPTION 'product_synonyms.product_id missing — chạy 20260515000003_product_synonyms.sql trước';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'active_ingredient'
  ) THEN
    RAISE EXCEPTION 'products.active_ingredient missing — schema chưa khớp';
  END IF;
END $$;

-- Helper CTE: liệt kê cặp (brand_lower, ingredient_keyword) cần seed.
-- ingredient_keyword là chuỗi sẽ ILIKE '%...%' lên products.active_ingredient.
-- Lowercase brand vì add_product_synonym RPC cũng lowercase + trim trước insert.
WITH brand_map(brand_synonym, ingredient_keyword) AS (
  VALUES
    -- Tên thương hiệu ↔ Hoạt chất
    ('xarelto',     'Rivaroxaban'),
    ('panadol',     'Paracetamol'),
    ('hapacol',     'Paracetamol'),
    ('efferalgan',  'Paracetamol'),
    ('tylenol',     'Paracetamol'),
    ('tatanol',     'Paracetamol'),
    ('aspirin',     'Acetylsalicylic'),                 -- bắt 'Acid acetylsalicylic'
    ('augmentin',   'Amoxicillin'),                     -- combo amox+clav
    ('klamentin',   'Amoxicillin'),
    ('adalat',      'Nifedipine'),
    ('norvasc',     'Amlodipine'),
    ('amlor',       'Amlodipine'),
    ('coversyl',    'Perindopril'),
    ('cozaar',      'Losartan'),
    ('crestor',     'Rosuvastatin'),
    ('lipitor',     'Atorvastatin'),
    ('diamicron',   'Gliclazide'),
    ('glucophage',  'Metformin'),
    ('siofor',      'Metformin'),
    ('concor',      'Bisoprolol'),
    ('sandimmun',   'Cyclosporin'),
    ('imodium',     'Loperamide'),
    ('smecta',      'Diosmectite'),
    ('motilium',    'Domperidone'),
    ('decolgen',    'Paracetamol'),                     -- combo
    ('tiffy',       'Paracetamol'),                     -- combo
    ('berberin',    'Berberin'),                        -- bắt 'Berberin hydrochloride'
    ('nexium',      'Esomeprazole'),
    ('esomeprazol', 'Esomeprazole'),                    -- VN spelling without -e
    ('tums',        'Calcium carbonate'),
    ('yumangel',    'Almagate'),
    ('phosphalugel','Aluminum phosphate'),
    -- Self-map (giúp search hit khi user viết tên hoạt chất qua nhiều cách):
    ('losartan',    'Losartan'),
    ('telmisartan', 'Telmisartan'),
    -- Cách viết khác nhau cho vitamin
    ('vit c',       'Vitamin C'),
    ('vit d',       'Vitamin D'),
    ('vit b12',     'Vitamin B12'),
    -- Cụm khái niệm (match qua products.name/ingredient)
    ('siro ho',     'siro ho'),
    ('giảm đau',    'giảm đau')
)
INSERT INTO public.product_synonyms (product_id, synonym, weight)
SELECT p.id, bm.brand_synonym, 1.5::real
FROM brand_map bm
JOIN public.products p
  ON p.status = 'active'
 AND p.active_ingredient ILIKE '%' || bm.ingredient_keyword || '%'
ON CONFLICT (product_id, synonym) DO NOTHING;

COMMIT;
