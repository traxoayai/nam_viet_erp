// src/features/medical/api/medicalService.ts
import { supabase } from "@/shared/lib/supabaseClient";

export const medicalService = {
  // Tìm kiếm dịch vụ cận lâm sàng cho Bác sĩ chỉ định
  searchClinicalServices: async (keyword: string) => {
    let query = supabase
      .from("service_packages")
      .select("id, name, sku, unit, price, type, clinical_category")
      .eq("status", "active")
      .in("clinical_category", ["lab", "imaging", "procedure", "examination", "vaccination"]);

    if (keyword) {
      query = query.or(`name.ilike.%${keyword}%,sku.ilike.%${keyword}%`);
    }

    const { data, error } = await query.limit(20);

    if (error) {
      console.error("Lỗi tìm kiếm dịch vụ cận lâm sàng:", error);
      return [];
    }

    // Map dữ liệu để tương thích với DebounceProductSelect
    return (data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      sku: s.sku,
      unit: s.unit,
      price: s.price, // dùng giá bán (niêm yết)
      retail_price: s.price,
      image: null,
      type: s.type, // 'service' hoặc 'bundle'
      clinical_category: s.clinical_category,
    }));
  },
};
