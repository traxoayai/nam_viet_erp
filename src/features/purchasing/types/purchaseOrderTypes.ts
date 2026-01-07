// src/types/purchaseOrderTypes.ts

// [NEW] Cho phép Multi-Unit
export interface UnitOption {
  unit_name: string;
  conversion_rate: number;
  is_base: boolean;
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
  
  // [NEW] Mảng đơn vị khả dụng (Load từ API)
  available_units?: UnitOption[];

  // Các trường meta để tính toán
  _items_per_carton: number;
  _wholesale_unit: string;
  _retail_unit: string;
  _base_price: number;
}
