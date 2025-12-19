// src/features/sales/types/pos_sales.ts
import { VoucherRecord } from "@/features/sales/types/b2b_sales";
export type SalesOrderStatus = "DRAFT" | "QUOTE" | "CONFIRMED";

export interface SalesOrderItem {
  key: string;
  product_id: number;
  product_code: string;
  product_name: string;
  image_url?: string;

  // Kho & Vị trí
  warehouse_location: string; // Vị trí kệ (A-01-02...)
  lot_number?: string;
  expiry_date?: string;

  // Số lượng & Đơn vị (Chỉ bán buôn)
  quantity: number;
  uom: string; // Mặc định là wholesale_unit

  // Giá & Thành tiền
  unit_price: number; // Giá bán buôn
  discount: number;
  total: number;
}

export interface SalesOrder {
  customer_id?: number;
  // Thông tin giao hàng
  delivery_info: {
    contact_name: string;
    shipping_address: string;
    carrier_name: string; // Tên vận chuyển
    carrier_phone: string; // SĐT Vận chuyển
    est_delivery_time: string; // Thời gian dự kiến nhận
    total_packages: number; // Tổng số kiện
  };

  // Tài chính
  items: SalesOrderItem[];
  total_items: number;
  total_amount: number;
  shipping_fee: number;
  voucher?: VoucherRecord;
  old_debt: number;

  // Meta
  note?: string;
  quote_duration: number; // Giờ (Default 3h)
}
