// src/features/inventory/types/outbound.ts

export interface OutboundTask {
  task_id: string; // UUID
  code: string;
  task_type: 'Bán hàng' | 'Chuyển kho';
  customer_name: string;
  created_at: string;
  delivery_deadline: string;
  priority: 'High' | 'Normal';
  status: string; // CONFIRMED, SHIPPING, DELIVERED, CANCELLED
  
  // Shipping Info
  shipping_partner_name: string;
  shipping_contact_name: string;
  shipping_contact_phone: string;
  package_count: number;

  // Progress & Pagination
  progress_picked: number;
  progress_total: number;
  status_label: string; 
  total_count: number; 
}

export interface OutboundStats {
  pending_packing: number;
  shipping: number;
  completed_today: number;
}

export interface OutboundFilter {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;       // CONFIRMED, SHIPPING...
  type?: string;         // 'Bán hàng' | 'Chuyển kho'
  shipping_partner_id?: number;
  date_from?: string;
  date_to?: string;
}

// Detail Interfaces
export interface OutboundOrderInfo {
  id: string;
  code: string;
  customer_name: string;
  delivery_address: string;
  note: string;
  status: string;
  // Các trường mới V4
  shipping_partner?: string;
  shipping_phone?: string;
  cutoff_time?: string;
  package_count?: number; // <--- FIX LỖI TS2339 TẠI ĐÂY (Thêm dấu ? để an toàn)
}

export interface OutboundPickItem {
  product_id: number;
  product_name: string;
  sku: string;
  barcode: string;
  unit: string;
  quantity_ordered: number;
  quantity_picked: number;
  image_url: string;
  shelf_location?: string;
  fefo_suggestion?: {
    batch_code: string;
    expiry_date: string;
    quantity_available: number;
  };
}

export interface OutboundDetailResponse {
  order_info: OutboundOrderInfo;
  items: OutboundPickItem[];
}