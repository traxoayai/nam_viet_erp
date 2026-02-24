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

export const supplierService = {
  getQuickInfo: async (id: number) => {
    const { data, error } = await supabase.rpc("get_supplier_quick_info", {
      p_supplier_id: id,
    });
    if (error) throw error;
    return data;
  },

  // [NEW] Import Excel (V33.2)
  importSuppliersBulk: async (suppliers: any[]) => {
    // Backend V33.2 expects 'p_suppliers'
    const { data, error } = await supabase.rpc("import_suppliers_bulk", {
      p_suppliers: suppliers,
    });
    if (error) throw error;
    return data;
  },
};
