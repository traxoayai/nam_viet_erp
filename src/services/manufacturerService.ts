// src/services/manufacturerService.ts
import { supabase } from "@/lib/supabaseClient";

export const getManufacturers = async () => {
  const { data, error } = await supabase
    .from("manufacturers")
    .select("id, name");

  if (error) {
    console.error("Lỗi khi tải Nhà sản xuất:", error);
    throw error;
  }
  return data || [];
};
