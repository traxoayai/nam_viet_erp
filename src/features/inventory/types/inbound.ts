// src/features/inventory/types/inbound.ts
export interface InboundTask {
  task_id: number; // PO ID
  code: string;
  supplier_name: string;
  created_at: string;
  expected_delivery_date: string; // Or expected_delivery_time
  item_count: number;
  progress_percent: number; // 0 - 100
  status: 'pending' | 'partial' | 'completed';
  total_count: number;
  
  // Logistics Fields (New)
  total_packages?: number;
  carrier_name?: string;
  carrier_contact?: string;
  expected_delivery_time?: string; // Datetime
}

export interface InboundDetailItem {
  product_id: number;
  product_name: string;
  sku: string;
  image_url: string;
  unit: string;
  stock_management_type: 'lot_date' | 'serial' | 'simple';
  quantity_ordered: number;
  quantity_received_prev: number;
  quantity_remaining: number;
  
  // Client-side inputs for receiving
  input_quantity?: number;
  input_lot?: string;
  input_expiry?: string; 
}

export interface InboundDetailResponse {
  po_info: {
    id: number;
    code: string;
    supplier_name: string;
    note: string;
    status: string;
    
    // Logistics Fields
    total_packages?: number;
    carrier_name?: string;
    carrier_contact?: string;
    expected_delivery_time?: string;
  };
  items: InboundDetailItem[];
}

export interface ProcessInboundPayload {
  p_po_id: number;
  p_warehouse_id: number;
  p_items: Array<{
    product_id: number;
    quantity: number;
    unit?: string; // [NEW] Added unit
    lot_number?: string;
    expiry_date?: string;
  }>;
}

export interface InboundFilter {
  page: number;
  pageSize: number;
  search?: string;
  status?: string; // 'pending' | 'completed' | 'all'
  date_from?: string;
  date_to?: string;
}
