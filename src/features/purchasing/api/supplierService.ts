// src/services/supplierService.ts
import { supabase } from "@/shared/lib/supabaseClient";

export const getSuppliers = async () => {
  // [FIX] Thêm tax_code vào danh sách select
  // Lấy danh sách NCC đang hoạt động để hiển thị Dropdown
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, tax_code, phone, address") 
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    console.error("Lỗi lấy danh sách NCC:", error);
    return [];
  }
  return data || [];
};
