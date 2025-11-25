// src/types/purchase.ts

export type DeliveryStatus = "pending" | "partial" | "delivered" | "cancelled";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "overpaid";

// Dùng cho bảng danh sách (Master View)
export interface PurchaseOrderMaster {
  key: string;
  id: number;
  code: string;
  supplier_id: number;
  supplier_name: string;
  delivery_status: DeliveryStatus;
  payment_status: PaymentStatus;
  final_amount: number;
  total_paid: number;
  expected_delivery_date: string | null;
  created_at: string;

  // Các trường tính toán từ SQL
  progress_delivery: number; // 0 - 100
  progress_payment: number; // 0 - 100
  delivery_method: string;
  total_cartons: number;
}

export interface PurchaseOrderFilters {
  search?: string;
  delivery_status?: string;
  payment_status?: string;
  date_from?: string;
  date_to?: string;
}
