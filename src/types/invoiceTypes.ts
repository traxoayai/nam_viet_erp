// src/types/invoiceTypes.ts

export interface ScannedInvoiceItem {
  name: string;
  unit: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  vat_rate: number | null;
  lot_number: string | null; // Quan trọng
  expiry_date: string | null; // Quan trọng YYYY-MM-DD
}

export interface ScannedInvoiceResult {
  invoice_id: number; // ID bản ghi draft trong DB
  file_url: string; // URL ảnh để hiển thị bên trái
  data: {
    invoice_number: string | null;
    invoice_symbol: string | null;
    invoice_date: string | null;
    supplier_name: string | null;
    tax_code: string | null;
    supplier_address: string | null;
    total_amount_pre_tax: number;
    tax_amount: number;
    total_amount_post_tax: number;
    items: ScannedInvoiceItem[];
  };
}
