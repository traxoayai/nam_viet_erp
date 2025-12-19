// src/types/b2b_sales.ts

// 1. IMPORT TỪ MODULE KHÁC (FIX LỖI TYPE MISMATCH)
// Thay vì tự định nghĩa, ta import chuẩn từ shippingPartner
import { ShippingPartner } from "@/features/partners/types/shippingPartner";

export { type ShippingPartner }; // Export lại để các file khác dùng nếu cần

// 2. INPUT PAYLOAD
export interface CreateSalesOrderPayload {
  p_customer_id: number;
  p_delivery_address: string;
  p_delivery_time: string;
  p_note: string;
  p_discount_amount: number;
  p_shipping_fee: number;
  p_status: "DRAFT" | "QUOTE" | "CONFIRMED";
  p_delivery_method: "internal" | "app" | "coach";
  p_shipping_partner_id?: number | null;
  p_items: SalesOrderItemPayload[];
}

export interface SalesOrderItemPayload {
  product_id: number;
  quantity: number;
  uom: string;
  unit_price: number;
  discount: number;
  is_gift: boolean;
  note?: string;
}

// 3. DATA MODELS
export interface CustomerB2B {
  id: number;
  name: string;
  tax_code: string;
  vat_address: string;
  shipping_address: string;
  phone: string;
  debt_limit: number;
  current_debt: number;
  loyalty_points: number;
  is_bad_debt: boolean;
  contacts: {
    name: string;
    phone: string;
    position: string;
    is_primary: boolean;
  }[];
}

export interface ProductB2B {
  id: number;
  sku: string;
  name: string;
  image_url: string | null;
  stock_quantity: number;
  shelf_location: string;
  lot_number: string | null;
  expiry_date: string | null;
  wholesale_unit: string;
  price_wholesale: number;
  items_per_carton: number;
}

// (Đã xóa interface ShippingPartner ở đây để dùng import)

export interface VoucherRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_discount_value: number | null;
  min_order_value: number;
  valid_to: string;
}

export interface CartItem extends ProductB2B {
  key: string;
  quantity: number;
  discount: number;
  total: number;
}
