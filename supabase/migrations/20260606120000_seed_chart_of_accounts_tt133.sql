-- Seed hệ thống tài khoản kế toán theo Thông tư 133/2016/TT-BTC
--   + danh mục loại phiếu Thu/Chi (transaction_categories) gán vào TK.
-- Ngày 2026-06-06.
--
-- An toàn: idempotent (ON CONFLICT DO NOTHING theo account_code / code) — KHÔNG
-- ghi đè dữ liệu kế toán đã có. account_id của transaction_categories là FK tới
-- chart_of_accounts.account_code (text), nên gán = account_code.
-- balance_type: No (dư Nợ) | Co (dư Có) | LuongTinh (lưỡng tính).

BEGIN;

-- =============================================================
-- 1. CHART OF ACCOUNTS (TT133) — cấp 1 + các cấp 2 nghiệp vụ cần
-- =============================================================
WITH seed(account_code, name, type, balance_type, parent_code, allow_posting) AS (VALUES
  -- ---- TÀI SẢN ----
  ('111','Tiền mặt','TaiSan','No',NULL,true),
  ('112','Tiền gửi Ngân hàng','TaiSan','No',NULL,true),
  ('121','Chứng khoán kinh doanh','TaiSan','No',NULL,true),
  ('128','Đầu tư nắm giữ đến ngày đáo hạn','TaiSan','No',NULL,true),
  ('131','Phải thu của khách hàng','TaiSan','No',NULL,true),
  ('133','Thuế GTGT được khấu trừ','TaiSan','No',NULL,false),
  ('1331','Thuế GTGT được khấu trừ của hàng hóa, dịch vụ','TaiSan','No','133',true),
  ('1332','Thuế GTGT được khấu trừ của TSCĐ','TaiSan','No','133',true),
  ('136','Phải thu nội bộ','TaiSan','No',NULL,true),
  ('138','Phải thu khác','TaiSan','No',NULL,true),
  ('141','Tạm ứng','TaiSan','No',NULL,true),
  ('151','Hàng mua đang đi đường','TaiSan','No',NULL,true),
  ('152','Nguyên liệu, vật liệu','TaiSan','No',NULL,true),
  ('153','Công cụ, dụng cụ','TaiSan','No',NULL,true),
  ('154','Chi phí sản xuất, kinh doanh dở dang','TaiSan','No',NULL,true),
  ('155','Thành phẩm','TaiSan','No',NULL,true),
  ('156','Hàng hóa','TaiSan','No',NULL,true),
  ('157','Hàng gửi đi bán','TaiSan','No',NULL,true),
  ('211','Tài sản cố định','TaiSan','No',NULL,true),
  ('214','Hao mòn tài sản cố định','TaiSan','Co',NULL,true),
  ('217','Bất động sản đầu tư','TaiSan','No',NULL,true),
  ('228','Đầu tư góp vốn vào đơn vị khác','TaiSan','No',NULL,true),
  ('229','Dự phòng tổn thất tài sản','TaiSan','Co',NULL,true),
  ('241','Xây dựng cơ bản dở dang','TaiSan','No',NULL,true),
  ('242','Chi phí trả trước','TaiSan','No',NULL,true),
  -- ---- NỢ PHẢI TRẢ ----
  ('331','Phải trả cho người bán','NoPhaiTra','Co',NULL,true),
  ('333','Thuế và các khoản phải nộp Nhà nước','NoPhaiTra','Co',NULL,false),
  ('3331','Thuế GTGT phải nộp','NoPhaiTra','Co','333',false),
  ('33311','Thuế GTGT đầu ra','NoPhaiTra','Co','3331',true),
  ('3334','Thuế thu nhập doanh nghiệp','NoPhaiTra','Co','333',true),
  ('3338','Thuế và các khoản phải nộp khác','NoPhaiTra','Co','333',true),
  ('334','Phải trả người lao động','NoPhaiTra','Co',NULL,true),
  ('335','Chi phí phải trả','NoPhaiTra','Co',NULL,true),
  ('336','Phải trả nội bộ','NoPhaiTra','Co',NULL,true),
  ('338','Phải trả, phải nộp khác','NoPhaiTra','Co',NULL,true),
  ('341','Vay và nợ thuê tài chính','NoPhaiTra','Co',NULL,true),
  ('352','Dự phòng phải trả','NoPhaiTra','Co',NULL,true),
  ('353','Quỹ khen thưởng, phúc lợi','NoPhaiTra','Co',NULL,true),
  ('356','Quỹ phát triển khoa học và công nghệ','NoPhaiTra','Co',NULL,true),
  -- ---- VỐN CHỦ SỞ HỮU ----
  ('411','Vốn đầu tư của chủ sở hữu','VonChuSoHuu','Co',NULL,true),
  ('413','Chênh lệch tỷ giá hối đoái','VonChuSoHuu','LuongTinh',NULL,true),
  ('418','Các quỹ thuộc vốn chủ sở hữu','VonChuSoHuu','Co',NULL,true),
  ('419','Cổ phiếu quỹ','VonChuSoHuu','No',NULL,true),
  ('421','Lợi nhuận sau thuế chưa phân phối','VonChuSoHuu','LuongTinh',NULL,false),
  ('4211','Lợi nhuận sau thuế chưa phân phối năm trước','VonChuSoHuu','LuongTinh','421',true),
  ('4212','Lợi nhuận sau thuế chưa phân phối năm nay','VonChuSoHuu','LuongTinh','421',true),
  -- ---- DOANH THU ----
  ('511','Doanh thu bán hàng và cung cấp dịch vụ','DoanhThu','Co',NULL,false),
  ('5111','Doanh thu bán hàng hóa','DoanhThu','Co','511',true),
  ('5112','Doanh thu bán thành phẩm','DoanhThu','Co','511',true),
  ('5113','Doanh thu cung cấp dịch vụ','DoanhThu','Co','511',true),
  ('5118','Doanh thu khác','DoanhThu','Co','511',true),
  ('515','Doanh thu hoạt động tài chính','DoanhThu','Co',NULL,true),
  ('711','Thu nhập khác','DoanhThu','Co',NULL,true),
  -- ---- CHI PHÍ ----
  ('611','Mua hàng','ChiPhi','No',NULL,true),
  ('631','Giá thành sản xuất','ChiPhi','No',NULL,true),
  ('632','Giá vốn hàng bán','ChiPhi','No',NULL,true),
  ('635','Chi phí tài chính','ChiPhi','No',NULL,true),
  ('642','Chi phí quản lý kinh doanh','ChiPhi','No',NULL,false),
  ('6421','Chi phí bán hàng','ChiPhi','No','642',true),
  ('6422','Chi phí quản lý doanh nghiệp','ChiPhi','No','642',true),
  ('811','Chi phí khác','ChiPhi','No',NULL,true),
  ('821','Chi phí thuế thu nhập doanh nghiệp','ChiPhi','No',NULL,true),
  -- ---- XÁC ĐỊNH KẾT QUẢ KINH DOANH ----
  ('911','Xác định kết quả kinh doanh','ChiPhi','LuongTinh',NULL,true)
)
INSERT INTO public.chart_of_accounts (account_code, name, type, balance_type, allow_posting)
SELECT account_code, name, type::public.account_type, balance_type::public.account_balance_type, allow_posting
FROM seed
ON CONFLICT (account_code) DO NOTHING;

-- Gán parent_id theo parent_code (idempotent)
WITH rel(account_code, parent_code) AS (VALUES
  ('1331','133'),('1332','133'),
  ('3331','333'),('33311','3331'),('3334','333'),('3338','333'),
  ('4211','421'),('4212','421'),
  ('5111','511'),('5112','511'),('5113','511'),('5118','511'),
  ('6421','642'),('6422','642')
)
UPDATE public.chart_of_accounts c
SET parent_id = p.id, updated_at = now()
FROM rel r
JOIN public.chart_of_accounts p ON p.account_code = r.parent_code
WHERE c.account_code = r.account_code
  AND c.parent_id IS DISTINCT FROM p.id;

-- =============================================================
-- 2. TRANSACTION_CATEGORIES — loại phiếu Thu/Chi (nhà thuốc)
--    account_id = account_code (TK đối ứng). Vế tiền lấy từ fund_account.
-- =============================================================
INSERT INTO public.transaction_categories (code, name, type, account_id, description) VALUES
  -- THU
  ('THU001','Thu tiền bán hàng / thu nợ khách','thu','131','Khách hàng thanh toán (Nợ tiền / Có 131)'),
  ('THU002','Thu lãi ngân hàng','thu','515','Lãi tiền gửi (Nợ tiền / Có 515)'),
  ('THU003','Thu khác','thu','711','Thu nhập khác (Nợ tiền / Có 711)'),
  -- CHI
  ('CHI001','Trả tiền nhà cung cấp','chi','331','Thanh toán công nợ NCC (Nợ 331 / Có tiền)'),
  ('CHI002','Trả lương nhân viên','chi','334','Chi lương (Nợ 334 / Có tiền)'),
  ('CHI003','Trả lãi vay ngân hàng','chi','635','Chi phí lãi vay (Nợ 635 / Có tiền)'),
  ('CHI004','Chi thuê mặt bằng','chi','6422','Chi phí QLDN (Nợ 6422 / Có tiền)'),
  ('CHI005','Chi điện, nước, internet','chi','6422','Chi phí QLDN (Nợ 6422 / Có tiền)'),
  ('CHI006','Chi vận chuyển, giao hàng','chi','6421','Chi phí bán hàng (Nợ 6421 / Có tiền)'),
  ('CHI007','Chi văn phòng phẩm','chi','6422','Chi phí QLDN (Nợ 6422 / Có tiền)'),
  ('CHI008','Chi marketing, quảng cáo','chi','6421','Chi phí bán hàng (Nợ 6421 / Có tiền)'),
  ('CHI009','Nộp thuế Nhà nước','chi','333','Nộp thuế (Nợ 333 / Có tiền)'),
  ('CHI010','Chi phí khác','chi','811','Chi phí khác (Nợ 811 / Có tiền)')
ON CONFLICT (code) DO NOTHING;

COMMIT;
