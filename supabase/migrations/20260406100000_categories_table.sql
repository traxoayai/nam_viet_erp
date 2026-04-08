-- ============================================================
-- Bảng categories: danh mục sản phẩm có cấu trúc cha-con
-- Giữ nguyên products.category_name (không xóa, không đổi)
-- Thêm products.category_id (nullable, FK → categories)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.categories (
  id serial PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL,
  parent_id integer REFERENCES public.categories(id) ON DELETE SET NULL,
  image_url text,
  sort_order integer DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX idx_categories_slug ON public.categories(slug);
CREATE INDEX idx_categories_parent ON public.categories(parent_id);

-- Thêm category_id vào products (nullable, không break gì)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id integer REFERENCES public.categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);

-- ============================================================
-- Seed parent categories (nhóm lớn)
-- ============================================================
INSERT INTO public.categories (id, name, slug, parent_id, sort_order) VALUES
  (1,  'Thuốc hô hấp & Cảm cúm',       'ho-hap-cam-cum',        NULL, 1),
  (2,  'Tim mạch & Huyết áp',            'tim-mach-huyet-ap',     NULL, 2),
  (3,  'Thực phẩm chức năng',            'thuc-pham-chuc-nang',   NULL, 3),
  (4,  'Giảm đau & Hạ sốt',             'giam-dau-ha-sot',       NULL, 4),
  (5,  'Kháng sinh & Kháng virus',       'khang-sinh-khang-virus', NULL, 5),
  (6,  'Dị ứng & Kháng histamin',        'di-ung-khang-histamin', NULL, 6),
  (7,  'Tiêu hóa & Dạ dày',             'tieu-hoa-da-day',       NULL, 7),
  (8,  'Gan & Giải độc',                 'gan-giai-doc',          NULL, 8),
  (9,  'Thần kinh & Tuần hoàn não',      'than-kinh-tuan-hoan',   NULL, 9),
  (10, 'Da liễu & Dược mỹ phẩm',        'da-lieu-duoc-my-pham',  NULL, 10),
  (11, 'Xương khớp',                     'xuong-khop',            NULL, 11),
  (12, 'Vitamin & Khoáng chất',          'vitamin-khoang-chat',   NULL, 12),
  (13, 'Chăm sóc cá nhân',              'cham-soc-ca-nhan',      NULL, 13),
  (14, 'Sức khỏe phụ nữ',               'suc-khoe-phu-nu',       NULL, 14),
  (15, 'Thiết bị y tế',                  'thiet-bi-y-te',         NULL, 15),
  (16, 'Đông y & Đông dược',             'dong-y-dong-duoc',      NULL, 16),
  (17, 'Tiểu đường',                     'tieu-duong',            NULL, 17),
  (18, 'Khác',                           'khac',                  NULL, 99)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed child categories (gom từ category_name hiện tại)
-- ============================================================
INSERT INTO public.categories (name, slug, parent_id, sort_order) VALUES
  -- Hô hấp & Cảm cúm (parent=1)
  ('Thuốc hô hấp',         'thuoc-ho-hap',          1, 1),
  ('Thuốc ho, long đờm',   'thuoc-ho-long-dom',     1, 2),
  ('Thuốc cảm lạnh',       'thuoc-cam-lanh',        1, 3),
  ('Thuốc trị ho cảm',     'thuoc-tri-ho-cam',      1, 4),
  ('Dung dịch xịt họng',   'dung-dich-xit-hong',    1, 5),
  -- Tim mạch (parent=2)
  ('Thuốc tim mạch',               'thuoc-tim-mach',           2, 1),
  ('Thuốc tim mạch huyết áp',     'thuoc-tim-mach-huyet-ap',  2, 2),
  ('Thuốc chống đông máu',        'thuoc-chong-dong-mau',     2, 3),
  -- TPCN (parent=3)
  ('Thực phẩm bảo vệ sức khỏe',           'tpbvsk',                    3, 1),
  ('Thực phẩm bổ sung',                   'thuc-pham-bo-sung',          3, 2),
  ('TPCN hỗ trợ hô hấp',                 'tpcn-ho-tro-ho-hap',         3, 3),
  ('TPCN hỗ trợ gan',                     'tpcn-ho-tro-gan',            3, 4),
  -- Giảm đau (parent=4)
  ('Thuốc giảm đau, hạ sốt',             'thuoc-giam-dau-ha-sot',      4, 1),
  ('Giảm đau kháng viêm',                'giam-dau-khang-viem',        4, 2),
  ('Miếng dán hạ sốt',                   'mieng-dan-ha-sot',           4, 3),
  -- Kháng sinh (parent=5)
  ('Thuốc kháng sinh',    'thuoc-khang-sinh',   5, 1),
  ('Thuốc kháng virus',   'thuoc-khang-virus',  5, 2),
  -- Dị ứng (parent=6)
  ('Thuốc chống dị ứng',        'thuoc-chong-di-ung',       6, 1),
  ('Thuốc kháng histamin',      'thuoc-khang-histamin',     6, 2),
  ('Thuốc mũi',                 'thuoc-mui',                6, 3),
  -- Tiêu hóa (parent=7)
  ('Thuốc dạ dày, tá tràng',    'thuoc-da-day-ta-trang',    7, 1),
  -- Gan (parent=8)
  ('Thuốc giải độc gan',                  'thuoc-giai-doc-gan',         8, 1),
  ('TPBVSK gan',                           'tpbvsk-gan',                 8, 2),
  -- Thần kinh (parent=9)
  ('Thuốc tuần hoàn não',                 'thuoc-tuan-hoan-nao',        9, 1),
  ('Thuốc hệ thần kinh',                  'thuoc-he-than-kinh',         9, 2),
  -- Da liễu (parent=10)
  ('Thuốc da liễu',           'thuoc-da-lieu',          10, 1),
  ('Dược mỹ phẩm',            'duoc-my-pham',           10, 2),
  ('Thuốc trị nấm da',        'thuoc-tri-nam-da',       10, 3),
  -- Xương khớp (parent=11)
  ('Thuốc xương khớp',        'thuoc-xuong-khop',       11, 1),
  ('Thuốc giảm đau ngoài da', 'thuoc-giam-dau-ngoai-da',11, 2),
  -- Vitamin (parent=12)
  ('Vitamin & Khoáng chất',        'vitamin-khoang',            12, 1),
  ('Thuốc bổ sung Canxi',         'thuoc-bo-sung-canxi',       12, 2),
  ('Vitamin cho trẻ',              'vitamin-cho-tre',           12, 3),
  -- Chăm sóc cá nhân (parent=13)
  ('Chăm sóc răng miệng',    'cham-soc-rang-mieng',   13, 1),
  ('Dầu gội & Khử mùi',      'dau-goi-khu-mui',       13, 2),
  -- Phụ nữ (parent=14)
  ('Sức khỏe phụ nữ',         'suc-khoe-phu-nu-con',   14, 1),
  ('Thuốc hormon nội tiết',   'thuoc-hormon-noi-tiet',  14, 2),
  -- Thiết bị y tế (parent=15) — no children
  -- Đông y (parent=16)
  ('Thuốc đông y',            'thuoc-dong-y',           16, 1),
  ('Tinh dầu & Cao xoa bóp', 'tinh-dau-cao-xoa-bop',  16, 2),
  -- Tiểu đường (parent=17)
  ('Thuốc tiểu đường',        'thuoc-tieu-duong',       17, 1)
ON CONFLICT DO NOTHING;

-- Reset sequence
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));

-- ============================================================
-- Map products.category_id dựa trên category_name
-- Dùng ILIKE pattern matching cho các tên lộn xộn
-- ============================================================

-- Hô hấp & Cảm (parent=1)
UPDATE products SET category_id = 1 WHERE category_name ILIKE '%hô hấp%' OR category_name ILIKE '%ho,%' OR category_name ILIKE '%cảm%' OR category_name ILIKE '%trị ho%' OR category_name ILIKE '%xịt họng%';

-- Tim mạch (parent=2)
UPDATE products SET category_id = 2 WHERE category_name ILIKE '%tim mạch%' OR category_name ILIKE '%huyết áp%' OR category_name ILIKE '%chống đông%';

-- TPCN (parent=3)
UPDATE products SET category_id = 3 WHERE category_id IS NULL AND (category_name ILIKE '%thực phẩm chức năng%' OR category_name ILIKE '%thực phẩm bảo vệ%' OR category_name ILIKE '%thực phẩm bổ sung%' OR category_name ILIKE 'TPCN%');

-- Giảm đau (parent=4)
UPDATE products SET category_id = 4 WHERE category_id IS NULL AND (category_name ILIKE '%giảm đau%' OR category_name ILIKE '%hạ sốt%');

-- Kháng sinh (parent=5)
UPDATE products SET category_id = 5 WHERE category_id IS NULL AND (category_name ILIKE '%kháng sinh%' OR category_name ILIKE '%kháng virus%');

-- Dị ứng (parent=6)
UPDATE products SET category_id = 6 WHERE category_id IS NULL AND (category_name ILIKE '%dị ứng%' OR category_name ILIKE '%histamin%' OR category_name ILIKE '%thuốc mũi%');

-- Tiêu hóa (parent=7)
UPDATE products SET category_id = 7 WHERE category_id IS NULL AND (category_name ILIKE '%tiêu hóa%' OR category_name ILIKE '%dạ dày%' OR category_name ILIKE '%tá tràng%');

-- Gan (parent=8)
UPDATE products SET category_id = 8 WHERE category_id IS NULL AND (category_name ILIKE '%gan%' OR category_name ILIKE '%giải độc%');

-- Thần kinh (parent=9)
UPDATE products SET category_id = 9 WHERE category_id IS NULL AND (category_name ILIKE '%tuần hoàn não%' OR category_name ILIKE '%thần kinh%' OR category_name ILIKE '%tiền đình%');

-- Da liễu (parent=10)
UPDATE products SET category_id = 10 WHERE category_id IS NULL AND (category_name ILIKE '%da liễu%' OR category_name ILIKE '%dược mỹ phẩm%' OR category_name ILIKE '%dược mĩ phẩm%' OR category_name ILIKE '%nấm da%' OR category_name ILIKE '%kem dưỡng%');

-- Xương khớp (parent=11)
UPDATE products SET category_id = 11 WHERE category_id IS NULL AND (category_name ILIKE '%xương khớp%' OR category_name ILIKE '%cơ xương%');

-- Vitamin (parent=12)
UPDATE products SET category_id = 12 WHERE category_id IS NULL AND (category_name ILIKE '%vitamin%' OR category_name ILIKE '%khoáng chất%' OR category_name ILIKE '%canxi%');

-- Chăm sóc cá nhân (parent=13)
UPDATE products SET category_id = 13 WHERE category_id IS NULL AND (category_name ILIKE '%răng miệng%' OR category_name ILIKE '%vệ sinh%' OR category_name ILIKE '%dầu gội%' OR category_name ILIKE '%khử mùi%');

-- Phụ nữ (parent=14)
UPDATE products SET category_id = 14 WHERE category_id IS NULL AND (category_name ILIKE '%phụ nữ%' OR category_name ILIKE '%hormon%' OR category_name ILIKE '%nội tiết%');

-- Thiết bị y tế (parent=15)
UPDATE products SET category_id = 15 WHERE category_id IS NULL AND (category_name ILIKE '%thiết bị%' OR category_name ILIKE '%y tế%');

-- Đông y (parent=16)
UPDATE products SET category_id = 16 WHERE category_id IS NULL AND (category_name ILIKE '%đông y%' OR category_name ILIKE '%đông dược%' OR category_name ILIKE '%tinh dầu%' OR category_name ILIKE '%cao xoa%');

-- Tiểu đường (parent=17)
UPDATE products SET category_id = 17 WHERE category_id IS NULL AND (category_name ILIKE '%tiểu đường%');

-- Còn lại → Khác (parent=18)
UPDATE products SET category_id = 18 WHERE category_id IS NULL AND category_name IS NOT NULL AND category_name != '';
