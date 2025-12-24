// src/features/finance/utils/xmlParser.ts

export interface ParsedInvoiceItem {
  line_number: number;
  name: string;       // THHDVu
  unit: string;       // DVTinh
  quantity: number;   // SLuong
  unit_price: number; // DGia
  total: number;      // ThTien
  vat_rate: number;   // TSuat (ví dụ 8, 10, -1 nếu k chịu thuế)
  discount: number;   // STCKhau
}

export interface ParsedInvoiceHeader {
  invoice_number: string; // SHDon
  invoice_symbol: string; // KHHDon
  invoice_date: string;   // NLap (YYYY-MM-DD)
  supplier_name: string;  // NBan > Ten
  supplier_tax_code: string; // NBan > MST
  supplier_address: string; // NBan > DChi
  total_amount_pre_tax: number;
  total_tax: number;
  total_amount_post_tax: number; // TgTTTBSo
}

export const parseInvoiceXML = (xmlContent: string): { header: ParsedInvoiceHeader; items: ParsedInvoiceItem[] } => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

  // Helper để lấy text từ tag
  const getText = (parent: Element | Document, tag: string) => {
    return parent.querySelector(tag)?.textContent || "";
  };

  // 1. Parse Header
  const dlHdon = xmlDoc.querySelector("DLHDon");
  if (!dlHdon) throw new Error("File XML không đúng định dạng Hóa đơn điện tử (Thiếu thẻ DLHDon).");

  const ttChung = dlHdon.querySelector("TTChung");
  const ndHdon = dlHdon.querySelector("NDHDon");
  if (!ttChung || !ndHdon) throw new Error("Thiếu thông tin chung hoặc nội dung hóa đơn.");

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
  };

  // 2. Parse Items
  const items: ParsedInvoiceItem[] = [];
  const hhdVuList = ndHdon.querySelectorAll("DSHHDVu HHDVu");

  hhdVuList.forEach((node) => {
    // Xử lý VAT: XML có thể ghi "8%" hoặc "10" hoặc "-1"
    let vatStr = getText(node, "TSuat").replace("%", "");
    let vatRate = 0;
    if (vatStr.startsWith("KCT") || vatStr.startsWith("KKK")) vatRate = 0; // Không chịu thuế
    else vatRate = Number(vatStr) || 0;

    items.push({
      line_number: Number(getText(node, "STT")),
      name: getText(node, "THHDVu"),
      unit: getText(node, "DVTinh"),
      quantity: Number(getText(node, "SLuong") || 0),
      unit_price: Number(getText(node, "DGia") || 0),
      total: Number(getText(node, "ThTien") || 0),
      discount: Number(getText(node, "STCKhau") || 0),
      vat_rate: vatRate,
    });
  });

  return { header, items };
};
