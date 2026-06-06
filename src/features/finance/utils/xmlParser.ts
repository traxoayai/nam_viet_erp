// src/features/finance/utils/xmlParser.ts

export interface ParsedInvoiceItem {
  line_number: number;
  name: string; // THHDVu
  unit: string; // DVTinh
  quantity: number; // SLuong
  unit_price: number; // DGia
  total: number; // ThTien (giữ tương thích cũ = amount_before_tax)
  vat_rate: number; // TSuat (ví dụ 8, 10, -1 nếu k chịu thuế)
  discount: number; // STCKhau (giữ tương thích cũ = discount_amount)
  // --- Chuẩn VAS (chiết khấu thương mại dòng) ---
  discount_rate: number; // TLCKhau (% chiết khấu dòng)
  discount_amount: number; // STCKhau (tiền chiết khấu dòng)
  amount_before_tax: number; // ThTien (thành tiền sau CK, trước thuế = SL*ĐG - STCKhau)
  is_promo: boolean; // TChat=2 → hàng khuyến mại (DGia=0, không tính vào giá vốn)
}

export interface ParsedInvoiceHeader {
  invoice_number: string; // SHDon
  invoice_symbol: string; // KHHDon
  invoice_date: string; // NLap (YYYY-MM-DD)
  supplier_name: string; // NBan > Ten
  supplier_tax_code: string; // NBan > MST
  supplier_address: string; // NBan > DChi
  total_amount_pre_tax: number; // TgTCThue (tổng chưa thuế, sau CK)
  total_tax: number; // TgTThue
  total_amount_post_tax: number; // TgTTTBSo
  total_discount_amount: number; // TTCKTMai (tổng chiết khấu thương mại)
  total_fee_amount: number; // tổng tiền phí mua hàng (XML không có → mặc định 0, kế toán nhập tay)
}

export const parseInvoiceXML = (
  xmlContent: string
): { header: ParsedInvoiceHeader; items: ParsedInvoiceItem[] } => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

  // Helper để lấy text từ tag
  const getText = (parent: Element | Document, tag: string) => {
    return parent.querySelector(tag)?.textContent || "";
  };

  // 1. Parse Header
  const dlHdon = xmlDoc.querySelector("DLHDon");
  if (!dlHdon)
    throw new Error(
      "File XML không đúng định dạng Hóa đơn điện tử (Thiếu thẻ DLHDon)."
    );

  const ttChung = dlHdon.querySelector("TTChung");
  const ndHdon = dlHdon.querySelector("NDHDon");
  if (!ttChung || !ndHdon)
    throw new Error("Thiếu thông tin chung hoặc nội dung hóa đơn.");

  const nBan = ndHdon.querySelector("NBan");
  const tToan = ndHdon.querySelector("TToan");

  const header: ParsedInvoiceHeader = {
    invoice_number: getText(ttChung, "SHDon"),
    invoice_symbol: getText(ttChung, "KHHDon"),
    invoice_date: getText(ttChung, "NLap"), // Format chuẩn XML thường là YYYY-MM-DD
    supplier_name: getText(nBan!, "Ten"),
    supplier_tax_code: getText(nBan!, "MST"),
    supplier_address: getText(nBan!, "DChi"),
    total_amount_pre_tax: Number(getText(tToan!, "TgTCThue") || 0),
    total_tax: Number(getText(tToan!, "TgTThue") || 0),
    total_amount_post_tax: Number(getText(tToan!, "TgTTTBSo") || 0),
    total_discount_amount: Number(getText(tToan!, "TTCKTMai") || 0),
    total_fee_amount: 0, // XML hóa đơn không có phí mua hàng — kế toán nhập tay khi đối chiếu
  };

  // 2. Parse Items
  const items: ParsedInvoiceItem[] = [];
  const hhdVuList = ndHdon.querySelectorAll("DSHHDVu HHDVu");

  hhdVuList.forEach((node) => {
    // Xử lý VAT: XML có thể ghi "8%" hoặc "10" hoặc "-1"
    const vatStr = getText(node, "TSuat").replace("%", "");
    let vatRate = 0;
    if (vatStr.startsWith("KCT") || vatStr.startsWith("KKK"))
      vatRate = 0; // Không chịu thuế
    else vatRate = Number(vatStr) || 0;

    const amountBeforeTax = Number(getText(node, "ThTien") || 0); // ThTien = SL*ĐG - STCKhau
    const discountAmount = Number(getText(node, "STCKhau") || 0);
    const discountRate = Number(getText(node, "TLCKhau").replace("%", "") || 0);
    // TChat (tính chất dòng) theo chuẩn HĐĐT TT78: 1=hàng/dịch vụ, 2=khuyến mại, 3=CKTM, 4=ghi chú
    const isPromo = getText(node, "TChat") === "2";

    items.push({
      line_number: Number(getText(node, "STT")),
      name: getText(node, "THHDVu"),
      unit: getText(node, "DVTinh"),
      quantity: Number(getText(node, "SLuong") || 0),
      unit_price: Number(getText(node, "DGia") || 0),
      total: amountBeforeTax, // tương thích cũ
      discount: discountAmount, // tương thích cũ
      discount_rate: discountRate,
      discount_amount: discountAmount,
      amount_before_tax: amountBeforeTax,
      vat_rate: vatRate,
      is_promo: isPromo,
    });
  });

  return { header, items };
};
