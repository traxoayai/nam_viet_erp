// src/features/pos/api/posService.ts
import {
  PosProductSearchResult,
  PosCustomerSearchResult,
  WarehousePosData,
} from "../types/pos.types";

import { safeRpc } from "@/shared/api/safeRpc";

export const posService = {
  async searchProducts(
    keyword: string,
    warehouseId: number = 1
  ): Promise<PosProductSearchResult[]> {
    if (!keyword.trim()) return [];

    try {
      const { data } = await safeRpc("search_products_pos", {
        p_keyword: keyword,
        p_warehouse_id: warehouseId, // Truyền ID kho hiện tại của nhân viên
        p_limit: 20,
      });
      return (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        retail_price: item.retail_price,
        image_url: item.image_url,
        unit: item.unit,
        stock_quantity: item.stock_quantity,
        status: item.status,
        location: {
          cabinet: item.location_cabinet,
          row: item.location_row,
          slot: item.location_slot,
        },
        usage_instructions: item.usage_instructions || {},
      }));
    } catch (err) {
      console.error("POS Search Error:", err);
      throw err;
    }
  },

  // 2. Tìm khách hàng thông minh (Smart Search)
  async searchCustomers(keyword: string): Promise<PosCustomerSearchResult[]> {
    if (!keyword.trim()) return [];

    try {
      const { data } = await safeRpc("search_customers_pos", {
        p_keyword: keyword,
      });
      return data as PosCustomerSearchResult[];
    } catch (err) {
      console.error("Smart Search Error:", err);
      return [];
    }
  },

  // 3. Lấy danh sách kho Active (kèm tọa độ)
  async getActiveWarehouses(): Promise<WarehousePosData[]> {
    try {
      const { data } = await safeRpc("get_active_warehouses");
      return data as WarehousePosData[];
    } catch (err) {
      console.error("Get Warehouses Error:", err);
      return [];
    }
  },

  // 4. Tạo đơn hàng (Omnichannel V2)
  async createOrder(payload: any): Promise<string> {
    const { data } = await safeRpc("create_sales_order", payload);
    return data as string; // Trả về UUID của đơn hàng
  },
};
