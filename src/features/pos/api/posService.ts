import { supabase } from "@/shared/lib/supabaseClient";
import { PosProductSearchResult } from "../types/pos.types";

export const posService = {
  async searchProducts(keyword: string, warehouseId: number): Promise<PosProductSearchResult[]> {
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
  }
};
