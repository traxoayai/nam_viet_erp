import { describe, it, expect } from "vitest";

import { parseInvoiceXML } from "@/features/finance/utils/xmlParser";

// XML hóa đơn điện tử tối giản: 1 dòng hàng thường (TChat=1) + 1 dòng khuyến mại (TChat=2, DGia=0)
const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<HDon>
  <DLHDon>
    <TTChung>
      <SHDon>123</SHDon>
      <KHHDon>K24TAA</KHHDon>
      <NLap>2026-03-15</NLap>
    </TTChung>
    <NDHDon>
      <NBan>
        <Ten>Công ty Dược ABC</Ten>
        <MST>0101234567</MST>
        <DChi>Hà Nội</DChi>
      </NBan>
      <DSHHDVu>
        <HHDVu>
          <STT>1</STT>
          <TChat>1</TChat>
          <THHDVu>Paracetamol 500mg</THHDVu>
          <DVTinh>Hộp</DVTinh>
          <SLuong>10</SLuong>
          <DGia>20000</DGia>
          <ThTien>200000</ThTien>
          <TSuat>8%</TSuat>
          <STCKhau>0</STCKhau>
          <TLCKhau>0</TLCKhau>
        </HHDVu>
        <HHDVu>
          <STT>2</STT>
          <TChat>2</TChat>
          <THHDVu>Vitamin C (Khuyến mại)</THHDVu>
          <DVTinh>Hộp</DVTinh>
          <SLuong>5</SLuong>
          <DGia>0</DGia>
          <ThTien>0</ThTien>
          <TSuat>8%</TSuat>
          <STCKhau>0</STCKhau>
          <TLCKhau>0</TLCKhau>
        </HHDVu>
      </DSHHDVu>
      <TToan>
        <TgTCThue>200000</TgTCThue>
        <TgTThue>16000</TgTThue>
        <TgTTTBSo>216000</TgTTTBSo>
        <TTCKTMai>0</TTCKTMai>
      </TToan>
    </NDHDon>
  </DLHDon>
</HDon>`;

describe("parseInvoiceXML — nhận diện hàng khuyến mại (TChat=2)", () => {
  it("dòng TChat=2 (DGia=0) là khuyến mại: is_promo=true, SL>0, đơn giá 0, thành tiền trước thuế 0", () => {
    const { items } = parseInvoiceXML(SAMPLE_XML);
    expect(items.length).toBe(2);

    const promo = items.find((i) => i.line_number === 2);
    expect(promo).toBeDefined();
    expect(promo!.is_promo).toBe(true);
    expect(promo!.quantity).toBe(5);
    expect(promo!.unit_price).toBe(0);
    expect(promo!.amount_before_tax).toBe(0);
  });

  it("dòng TChat=1 là hàng thường: is_promo=false", () => {
    const { items } = parseInvoiceXML(SAMPLE_XML);
    const normal = items.find((i) => i.line_number === 1);
    expect(normal).toBeDefined();
    expect(normal!.is_promo).toBe(false);
    expect(normal!.unit_price).toBe(20000);
    expect(normal!.amount_before_tax).toBe(200000);
  });
});
