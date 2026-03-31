// src/features/finance/types/sepay.types.ts
// Types cho SEPAY E-Invoice API (https://developer.sepay.vn/vi/einvoice-api/v1/tong-quan)

export interface SepayBuyer {
  type?: "personal" | "company";
  name: string;
  legal_name?: string;
  tax_code?: string;
  address?: string;
  email?: string;
  phone?: string;
  buyer_code?: string;
  national_id?: string;
}

export interface SepayInvoiceItem {
  line_number: number;
  line_type: 1 | 2 | 3 | 4; // 1=hàng hóa, 2=khuyến mại, 3=chiết khấu, 4=ghi chú
  item_code?: string;
  item_name: string;
  unit?: string;
  quantity?: number;
  unit_price?: number;
  tax_rate?: -2 | -1 | 0 | 5 | 8 | 10;
  discount_tax?: number;
  discount_amount?: number;
  before_discount_and_tax_amount?: number;
}

export interface SepayCreateInvoiceRequest {
  template_code: string;
  invoice_series: string;
  issued_date: string; // YYYY-MM-DD HH:mm:ss
  currency: "VND" | "USD" | "CAD";
  provider_account_id: string;
  payment_method?: "TM" | "CK" | "TM/CK" | "KHAC";
  is_draft?: boolean;
  buyer: SepayBuyer;
  items: SepayInvoiceItem[];
  notes?: string;
}

export interface SepayCreateInvoiceResponse {
  success: boolean;
  data: {
    tracking_code: string;
    tracking_url: string;
    message: string;
  };
}

export interface SepayTrackingResponse {
  success: boolean;
  data: {
    reference_code?: string;
    status: string; // "Success" | "Failed" | "Processing"
    message?: string;
    invoice?: {
      reference_code: string;
      invoice_number: string;
      invoice_series: string;
      issued_date: string;
      pdf_url?: string;
      xml_url?: string;
      status: string;
      total_before_tax: number;
      tax_amount: number;
      total_amount: number;
      buyer?: SepayBuyer;
    };
    error_message?: string;
  };
}
