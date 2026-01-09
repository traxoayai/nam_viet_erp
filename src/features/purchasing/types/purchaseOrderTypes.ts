// src/types/purchaseOrderTypes.ts

// [NEW] Cho phép Multi-Unit
export interface ProductUnitOption {
  id: number;
  unit_name: string;
  conversion_rate: number;
  is_base: boolean;
  price_sell?: number;
  barcode?: string;
}

export interface POItem {
  product_id: number;
  sku: string;
  name: string;
  image_url: string;
  quantity: number;
  uom: string;
  unit_price: number;
  discount: number;
  
  // [NEW] Mảng đơn vị động trả về từ API
  available_units?: ProductUnitOption[]; 

  // Các trường meta để tính toán
  _items_per_carton: number;
  _wholesale_unit: string;
  _retail_unit: string;
  _base_price: number;
}

// [UPDATED] Master Type
// [UPDATED] PurchaseOrderDetail (Header)
export interface PurchaseOrderDetail {
  id: number;
  code: string;
  created_at: string;
  status: string;
  supplier_name: string;
  final_amount: number;

  // [NEW] Logistics Fields
  delivery_method: string;
  total_packages: number | null;
  carrier_name: string | null;
  carrier_contact: string | null;
  carrier_phone: string | null;
  expected_delivery_time: string | null;
  expected_delivery_date?: string;
  
  payment_status?: 'unpaid' | 'partial' | 'paid';
  total_paid?: number;
  delivery_progress?: number; // % Giao hàng
}
