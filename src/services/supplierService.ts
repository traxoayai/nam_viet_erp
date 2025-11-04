// src/services/supplierService.ts
import { supabase } from "@/lib/supabaseClient";

export const getSuppliers = async () => {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("Lỗi khi tải Nhà Cung Cấp:", error);
    throw error;
  }
  return data || [];
};
