// src/features/pos/api/posService.ts
import { supabase } from "@/shared/lib/supabaseClient";
import { PosProductSearchResult, PosCustomerSearchResult, WarehousePosData } from "../types/pos.types";

export const posService = {
  async searchProducts(keyword: string, warehouseId: number = 1): Promise<PosProductSearchResult[]> {
    if (!keyword.trim()) return [];

    const { data, error } = await supabase.rpc("search_products_pos", {
      p_keyword: keyword,
      p_warehouse_id: warehouseId, // Truyền ID kho hiện tại của nhân viên
      p_limit: 20
    });

    if (error) {
      console.error("POS Search Error:", error);
      throw error;
    }

    // Map dữ liệu từ RPC (snake_case) sang Frontend (camelCase)
    return (data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      retail_price: item.retail_price,
      image_url: item.image_url,
      unit: item.unit,
      stock_quantity: item.stock_quantity,
      location: {
        cabinet: item.location_cabinet,
        row: item.location_row,
        slot: item.location_slot
      },
      usage_instructions: item.usage_instructions || {}
    }));
  },

  // 2. Tìm khách hàng thông minh (Smart Search)
  async searchCustomers(keyword: string): Promise<PosCustomerSearchResult[]> {
    if (!keyword.trim()) return [];
    
    const { data, error } = await supabase.rpc('search_customers_pos', { 
      p_keyword: keyword 
    });

    if (error) {
      console.error("Smart Search Error:", error);
      return [];
    }
    return data as PosCustomerSearchResult[];
  },

  // 3. Lấy danh sách kho Active (kèm tọa độ)
  async getActiveWarehouses(): Promise<WarehousePosData[]> {
    const { data, error } = await supabase.rpc('get_active_warehouses');
    if (error) {
       console.error("Get Warehouses Error:", error);
       return [];
    }
    return data as WarehousePosData[];
  },

  // 4. Tạo đơn hàng (Omnichannel V2)
  async createOrder(payload: any): Promise<string> {
    const { data, error } = await supabase.rpc('create_sales_order', payload);
    if (error) throw error;
    return data; // Trả về UUID của đơn hàng
  }
};
