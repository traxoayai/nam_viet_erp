// src/services/categoryService.ts
import { supabase } from "@/lib/supabaseClient";

export const getCategories = async () => {
  const { data, error } = await supabase.from("categories").select("id, name");

  if (error) {
    console.error("Lỗi khi tải Phân loại:", error);
    throw error;
  }
  return data || [];
};
