// src/services/warehouseService.ts
import { supabase } from "@/lib/supabaseClient";

export const getWarehouses = async () => {
  const { data, error } = await supabase
    .from("warehouses")
    .select("id, key, name, unit")
    .order("id", { ascending: true }); // Sắp xếp theo ID để đảm bảo thứ tự

  if (error) {
    console.error("Lỗi khi tải Kho hàng:", error);
    throw error;
  }
  return data || [];
};
