// src/features/purchasing/types/purchase.ts

export type DeliveryStatus = "pending" | "partial" | "delivered" | "cancelled";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "overpaid";

// Dùng cho bảng danh sách (Master View)
export interface PurchaseOrderMaster {
  id: number;
  code: string;
  supplier_id: number;
  supplier_name: string;
  status: string; // Main status: new, approved, ordering, completed, cancelled
  
  // Logistics & Status
  delivery_status: DeliveryStatus;
  payment_status: PaymentStatus;
  delivery_progress: number; // 0 - 100
  delivery_method: string;
  expected_delivery_date: string | null;
  expected_delivery_time: string | null;
  carrier_name?: string; // Tên nhà vận chuyển
  shipping_partner_name?: string;
  
  // Metrics
  final_amount: number;
  total_paid: number;
  total_quantity: number;
  total_cartons: number; // Tổng số thùng
  total_packages?: number; // Tổng số kiện (nếu có logic riêng)
  created_at: string;
  
  // Optional for UI consistency if needed
  items_count?: number; 
  received_count?: number; 
}

export interface PurchaseStats {
  total_orders: number;
  pending_approval: number;
  ordering: number;
  delivering: number;
  completed_month: number;
}

export interface PoLogisticsStat {
  method: string;
  total_cartons: number;
  order_count: number;
}

// THÊM ĐOẠN NÀY VÀO CUỐI FILE
export interface PurchaseOrderFilters {
  search?: string;
  status_delivery?: string; // hoặc DeliveryStatus
  status_payment?: string;  // hoặc PaymentStatus
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}