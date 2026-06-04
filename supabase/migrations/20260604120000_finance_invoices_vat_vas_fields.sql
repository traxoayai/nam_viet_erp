-- Hóa đơn VAT theo chuẩn kế toán VN (VAS): thêm cột tổng chiết khấu / phí / tiền hàng nguyên giá.
-- Ngày: 2026-06-04. Chỉ ADD COLUMN nullable-with-default → nhanh, không rewrite bảng, an toàn.
BEGIN;

ALTER TABLE public.finance_invoices
  ADD COLUMN IF NOT EXISTS total_goods_amount    numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_fee_amount      numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.finance_invoices.total_goods_amount IS
  'Tổng tiền hàng nguyên giá = SUM(SL*ĐG) trước chiết khấu.';
COMMENT ON COLUMN public.finance_invoices.total_discount_amount IS
  'Tổng chiết khấu thương mại (XML: TTCKTMai = SUM STCKhau từng dòng).';
COMMENT ON COLUMN public.finance_invoices.total_fee_amount IS
  'Tổng tiền phí mua hàng (nhập tay) — phân bổ vào giá vốn tồn kho theo tỷ trọng Thành tiền từng dòng (chuẩn VAS). Có thể không chịu VAT.';

COMMIT;
