// src/types/purchaseOrderTypes.ts

export interface POItem {
  product_id: number;
  sku: string;
  name: string;
  image_url: string;
  quantity: number;
  uom: string;
  unit_price: number;
  discount: number;
  // Các trường meta để tính toán
  _items_per_carton: number;
  _wholesale_unit: string;
  _retail_unit: string;
  _base_price: number;
}
