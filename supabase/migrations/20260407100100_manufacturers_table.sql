-- ============================================================
-- Bảng manufacturers: nhà sản xuất / nhãn hàng
-- Chuẩn hóa từ products.manufacturer_name (82 values → ~45)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.manufacturers (
  id serial PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL,
  country text,
  logo_url text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX idx_manufacturers_slug ON public.manufacturers(slug);

-- Thêm manufacturer_id vào products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS manufacturer_id integer REFERENCES public.manufacturers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_manufacturer_id ON public.products(manufacturer_id);

-- ============================================================
-- Seed manufacturers (chuẩn hóa, gộp trùng)
-- ============================================================
INSERT INTO public.manufacturers (id, name, slug, country) VALUES
  (1,  'Abbott',                'abbott',              'Mỹ'),
  (2,  'ABIPHA',                'abipha',              'Việt Nam'),
  (3,  'Aikido',                'aikido',              'Việt Nam'),
  (4,  'An Thiên',              'an-thien',            'Việt Nam'),
  (5,  'Armephaco',             'armephaco',           'Việt Nam'),
  (6,  'AstraZeneca',           'astrazeneca',         'Anh/Thụy Điển'),
  (7,  'Bayer',                 'bayer',               'Đức'),
  (8,  'Berlin-Chemie',         'berlin-chemie',       'Đức'),
  (9,  'Bình Minh Pharma',      'binh-minh-pharma',    'Việt Nam'),
  (10, 'Boehringer Ingelheim',  'boehringer-ingelheim','Đức'),
  (11, 'Cagipharm',             'cagipharm',           'Việt Nam'),
  (12, 'Chung Gei Pharma',      'chung-gei-pharma',    'Hàn Quốc'),
  (13, 'Đại Uy Pharma',         'dai-uy-pharma',       'Việt Nam'),
  (14, 'Doppelherz',            'doppelherz',          'Đức'),
  (15, 'Dược Hậu Giang',        'duoc-hau-giang',      'Việt Nam'),
  (16, 'Dược Khoa',             'duoc-khoa',           'Việt Nam'),
  (17, 'Dược Nam Việt',          'duoc-nam-viet',       'Việt Nam'),
  (18, 'Dược phẩm Nam Hà',      'duoc-pham-nam-ha',    'Việt Nam'),
  (19, 'Dược phẩm TW3',         'duoc-pham-tw3',       'Việt Nam'),
  (20, 'Dược phẩm Yên Bái',     'duoc-pham-yen-bai',   'Việt Nam'),
  (21, 'Engelhard',             'engelhard',           'Đức'),
  (22, 'Eupharma',              'eupharma',            'Việt Nam'),
  (23, 'Frosst Iberica',        'frosst-iberica',      'Tây Ban Nha'),
  (24, 'Gedeon Richter',        'gedeon-richter',      'Hungary'),
  (25, 'GSK',                   'gsk',                 'Anh'),
  (26, 'Hafaco',                'hafaco',              'Việt Nam'),
  (27, 'Hisamitsu',             'hisamitsu',           'Nhật Bản'),
  (28, 'Hoa Linh',              'hoa-linh',            'Việt Nam'),
  (29, 'LIPA Pharma',           'lipa-pharma',         'Úc'),
  (30, 'Medipharco-Tenamyd',    'medipharco-tenamyd',  'Việt Nam'),
  (31, 'Mediplantex',           'mediplantex',         'Việt Nam'),
  (32, 'Mekophar',              'mekophar',            'Việt Nam'),
  (33, 'Merap',                 'merap',               'Việt Nam'),
  (34, 'MSD',                   'msd',                 'Mỹ'),
  (35, 'Nam Dược',              'nam-duoc',            'Việt Nam'),
  (36, 'Nhất Nhất',             'nhat-nhat',           'Việt Nam'),
  (37, 'OPC',                   'opc',                 'Việt Nam'),
  (38, 'Pharbaco',              'pharbaco',            'Việt Nam'),
  (39, 'Queisser Pharma',       'queisser-pharma',     'Đức'),
  (40, 'Sanofi',                'sanofi',              'Pháp'),
  (41, 'Sao Thái Dương',        'sao-thai-duong',      'Việt Nam'),
  (42, 'Satyam Pharma',         'satyam-pharma',       'Ấn Độ'),
  (43, 'Servier',               'servier',             'Pháp'),
  (44, 'Soha Vimex',            'soha-vimex',          'Việt Nam'),
  (45, 'Stellapharm',           'stellapharm',         'Việt Nam'),
  (46, 'Thai Nakorn Patana',    'thai-nakorn-patana',  'Thái Lan'),
  (47, 'Traphaco',              'traphaco',            'Việt Nam'),
  (48, 'United International Pharma', 'uip',           'Việt Nam'),
  (49, 'Vidipha',               'vidipha',             'Việt Nam'),
  (50, 'Vinphaco',              'vinphaco',            'Việt Nam'),
  (51, 'Yuhan',                 'yuhan',               'Hàn Quốc')
ON CONFLICT DO NOTHING;

SELECT setval('manufacturers_id_seq', (SELECT MAX(id) FROM manufacturers));

-- ============================================================
-- Map products.manufacturer_id dựa trên manufacturer_name
-- Dùng ILIKE pattern matching để gộp các tên viết khác nhau
-- ============================================================

-- Abbott
UPDATE products SET manufacturer_id = 1 WHERE manufacturer_name ILIKE '%abbott%';
-- ABIPHA
UPDATE products SET manufacturer_id = 2 WHERE manufacturer_name ILIKE '%abipha%';
-- Aikido
UPDATE products SET manufacturer_id = 3 WHERE manufacturer_name ILIKE '%aikido%';
-- An Thiên
UPDATE products SET manufacturer_id = 4 WHERE manufacturer_name ILIKE '%an thiên%';
-- Armephaco
UPDATE products SET manufacturer_id = 5 WHERE manufacturer_name ILIKE '%armephaco%';
-- AstraZeneca
UPDATE products SET manufacturer_id = 6 WHERE manufacturer_name ILIKE '%astrazeneca%';
-- Bayer
UPDATE products SET manufacturer_id = 7 WHERE manufacturer_name ILIKE '%bayer%';
-- Berlin-Chemie
UPDATE products SET manufacturer_id = 8 WHERE manufacturer_name ILIKE '%berlin%chemie%';
-- Bình Minh Pharma
UPDATE products SET manufacturer_id = 9 WHERE manufacturer_name ILIKE '%bình minh%';
-- Boehringer Ingelheim
UPDATE products SET manufacturer_id = 10 WHERE manufacturer_name ILIKE '%boehringer%';
-- Cagipharm
UPDATE products SET manufacturer_id = 11 WHERE manufacturer_name ILIKE '%cagipharm%';
-- Chung Gei Pharma
UPDATE products SET manufacturer_id = 12 WHERE manufacturer_name ILIKE '%chung gei%';
-- Đại Uy Pharma (+ Đại Y)
UPDATE products SET manufacturer_id = 13 WHERE manufacturer_name ILIKE '%đại uy%' OR manufacturer_name ILIKE '%đại y%';
-- Doppelherz
UPDATE products SET manufacturer_id = 14 WHERE manufacturer_name ILIKE '%doppelherz%';
-- Dược Hậu Giang (+ DHG)
UPDATE products SET manufacturer_id = 15 WHERE manufacturer_name ILIKE '%hậu giang%' OR manufacturer_name ILIKE '%dhg%';
-- Dược Khoa
UPDATE products SET manufacturer_id = 16 WHERE manufacturer_name ILIKE '%dược khoa%';
-- Dược Nam Việt
UPDATE products SET manufacturer_id = 17 WHERE manufacturer_name = 'Dược Nam Việt';
-- Dược phẩm Nam Hà (+ DP Nam Hà)
UPDATE products SET manufacturer_id = 18 WHERE manufacturer_name ILIKE '%nam hà%';
-- Dược phẩm TW3 (+ trung ương 3)
UPDATE products SET manufacturer_id = 19 WHERE manufacturer_name ILIKE '%trung ương 3%' OR manufacturer_name ILIKE '%tw3%';
-- Dược phẩm Yên Bái
UPDATE products SET manufacturer_id = 20 WHERE manufacturer_name ILIKE '%yên bái%';
-- Engelhard
UPDATE products SET manufacturer_id = 21 WHERE manufacturer_name ILIKE '%engelhard%';
-- Eupharma
UPDATE products SET manufacturer_id = 22 WHERE manufacturer_name ILIKE '%eupharma%';
-- Frosst Iberica
UPDATE products SET manufacturer_id = 23 WHERE manufacturer_name ILIKE '%frosst%';
-- Gedeon Richter
UPDATE products SET manufacturer_id = 24 WHERE manufacturer_name ILIKE '%gedeon%' OR manufacturer_name ILIKE '%richter%';
-- GSK
UPDATE products SET manufacturer_id = 25 WHERE manufacturer_name ILIKE '%gsk%' OR manufacturer_name ILIKE '%glaxo%';
-- Hafaco
UPDATE products SET manufacturer_id = 26 WHERE manufacturer_name ILIKE '%hafaco%';
-- Hisamitsu
UPDATE products SET manufacturer_id = 27 WHERE manufacturer_name ILIKE '%hisamitsu%';
-- Hoa Linh
UPDATE products SET manufacturer_id = 28 WHERE manufacturer_name ILIKE '%hoa linh%';
-- LIPA Pharma
UPDATE products SET manufacturer_id = 29 WHERE manufacturer_name ILIKE '%lipa%';
-- Medipharco-Tenamyd
UPDATE products SET manufacturer_id = 30 WHERE manufacturer_name ILIKE '%medipharco%';
-- Mediplantex
UPDATE products SET manufacturer_id = 31 WHERE manufacturer_name ILIKE '%mediplantex%';
-- Mekophar
UPDATE products SET manufacturer_id = 32 WHERE manufacturer_name ILIKE '%mekophar%';
-- Merap
UPDATE products SET manufacturer_id = 33 WHERE manufacturer_name ILIKE '%merap%';
-- MSD (+ Merck Sharp & Dohme)
UPDATE products SET manufacturer_id = 34 WHERE manufacturer_name ILIKE '%msd%' OR manufacturer_name ILIKE '%merck sharp%';
-- Nam Dược
UPDATE products SET manufacturer_id = 35 WHERE manufacturer_name ILIKE '%nam dược%';
-- Nhất Nhất
UPDATE products SET manufacturer_id = 36 WHERE manufacturer_name ILIKE '%nhất nhất%';
-- OPC
UPDATE products SET manufacturer_id = 37 WHERE manufacturer_name ILIKE '%opc%';
-- Pharbaco (+ TW1)
UPDATE products SET manufacturer_id = 38 WHERE manufacturer_name ILIKE '%pharbaco%' OR manufacturer_name ILIKE '%trung ương i%' OR manufacturer_name ILIKE '%tw1%';
-- Queisser Pharma
UPDATE products SET manufacturer_id = 39 WHERE manufacturer_name ILIKE '%queisser%';
-- Sanofi
UPDATE products SET manufacturer_id = 40 WHERE manufacturer_name ILIKE '%sanofi%';
-- Sao Thái Dương
UPDATE products SET manufacturer_id = 41 WHERE manufacturer_name ILIKE '%sao thái dương%' OR manufacturer_name ILIKE '%thái dương%';
-- Satyam Pharma
UPDATE products SET manufacturer_id = 42 WHERE manufacturer_name ILIKE '%satyam%';
-- Servier
UPDATE products SET manufacturer_id = 43 WHERE manufacturer_name ILIKE '%servier%';
-- Soha Vimex
UPDATE products SET manufacturer_id = 44 WHERE manufacturer_name ILIKE '%soha vimex%';
-- Stellapharm
UPDATE products SET manufacturer_id = 45 WHERE manufacturer_name ILIKE '%stellapharm%';
-- Thai Nakorn Patana
UPDATE products SET manufacturer_id = 46 WHERE manufacturer_name ILIKE '%thai nakorn%';
-- Traphaco
UPDATE products SET manufacturer_id = 47 WHERE manufacturer_name ILIKE '%traphaco%';
-- United International Pharma
UPDATE products SET manufacturer_id = 48 WHERE manufacturer_name ILIKE '%united international%';
-- Vidipha
UPDATE products SET manufacturer_id = 49 WHERE manufacturer_name ILIKE '%vidipha%';
-- Vinphaco
UPDATE products SET manufacturer_id = 50 WHERE manufacturer_name ILIKE '%vinphaco%' OR manufacturer_name ILIKE '%vĩnh phúc%';
-- Yuhan
UPDATE products SET manufacturer_id = 51 WHERE manufacturer_name ILIKE '%yuhan%';
