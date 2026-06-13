/**
 * Invoice types for multi-VAT form and RPC payloads
 */
import type { Dayjs } from "dayjs";

export type VatRate = 0 | 5 | 10;

export interface InvoiceLineItem {
  key: string; // Unique identifier for form binding
  product_id?: number | string;
  product_name: string;
  quantity: number;
  unit_price: number;
  vat_rate: VatRate;
  discount_amount?: number; // Per-line discount
  line_subtotal?: number; // Calculated: qty * unit_price
  line_after_discount?: number; // Calculated: subtotal - discount
  line_tax?: number; // Calculated: tax amount
  line_total?: number; // Calculated: after_discount + tax
}

export interface InvoiceFormData {
  invoice_number: string;
  invoice_date: Dayjs;
  customer_name: string;
  customer_tax_code: string; // MST — required
  customer_address?: string;
  items: InvoiceLineItem[];
  discount_total?: number; // Global/header discount
  fee_total?: number; // Global/header fee
  notes?: string;
}

export interface InvoiceLineJSON {
  product_id?: number | string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  vat_rate: VatRate;
  vat_amount: number;
  line_total: number;
}

export interface InvoiceFeeJSON {
  description: string;
  amount: number;
}

export interface InvoiceSubmitPayload {
  invoice_number: string;
  invoice_date: string; // ISO format YYYY-MM-DD
  customer_name: string;
  customer_tax_code: string;
  customer_address?: string;
  items_json: {
    lines: InvoiceLineJSON[];
    fees?: InvoiceFeeJSON[];
  };
  discount_total: number;
  fee_total: number;
  notes?: string;
  summary: {
    total_goods: number;
    total_discount: number;
    total_pre_tax: number;
    total_tax: number;
    total_post_tax: number;
    final: number;
    tax_by_rate?: Record<number, number>;
  };
}

export interface ScannedInvoiceResult {
  invoice_number?: string;
  customer_name?: string;
  customer_tax_code?: string;
  items?: InvoiceLineItem[];
}
