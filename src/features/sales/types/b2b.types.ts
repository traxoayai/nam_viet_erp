// src/features/sales/types/b2b.types.ts

// 1. Dữ liệu từng dòng đơn hàng
export interface B2BOrderItem {
  id: string;
  code: string;
  customer_name: string;
  status:
    | "DRAFT"
    | "QUOTE"
    | "CONFIRMED"
    | "SHIPPING"
    | "DELIVERED"
    | "CANCELLED";
  payment_status: "paid" | "partial" | "unpaid";
  final_amount: number;
  paid_amount: number;
  created_at: string;
}

// 2. Dữ liệu thống kê (Header)
export interface B2BOrderStats {
  sales_this_month: number;
  draft_count: number;
  pending_payment: number;
}

// 3. Response tổng thể từ RPC
export interface B2BOrderViewResponse {
  data: B2BOrderItem[];
  total: number;
  stats: B2BOrderStats;
}

// 4. Params filter (Input cho Service)
export interface B2BOrderFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  // date_from, date_to nếu cần mở rộng sau này
}

// 5. Chi tiết đơn hàng (Detail Page)
export interface B2BOrderDetailItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  unit_name?: string;
}

export interface B2BOrderDetail {
  id: string;
  code: string;
  status: B2BOrderItem["status"];
  created_at: string;
  note?: string;
  payment_method?: string;
  
  // Thông tin khách hàng (Join)
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  delivery_address?: string;

  // Tổng kết tài chính
  sub_total: number;
  discount_amount: number;
  shipping_fee: number;
  final_amount: number;

  // Danh sách sản phẩm
  items: B2BOrderDetailItem[];
}

