// src/features/location/api/locationService.ts
// Đọc danh mục đơn vị hành chính 2 cấp (Tỉnh/Thành -> Phường/Xã) theo mô hình 2025.
// Bảng provinces/wards có RLS read-all (lookup) nên đọc trực tiếp qua supabase.from()
// — KHÔNG cần RPC (giống supplierService/warehouseService).
import type { Database } from "@/shared/types/database.types";

import { supabase } from "@/shared/lib/supabaseClient";

type ProvinceRow = Database["public"]["Tables"]["provinces"]["Row"];
type WardRow = Database["public"]["Tables"]["wards"]["Row"];

export type Province = Pick<ProvinceRow, "code" | "name" | "full_name">;
export type Ward = Pick<
  WardRow,
  "code" | "name" | "full_name" | "province_code"
>;

export const locationService = {
  // Danh sách tỉnh/thành, sắp theo tên.
  getProvinces: async (): Promise<Province[]> => {
    const { data, error } = await supabase
      .from("provinces")
      .select("code, name, full_name")
      .order("name", { ascending: true });
    if (error) {
      console.error("Lỗi lấy danh sách tỉnh/thành:", error);
      return [];
    }
    return data ?? [];
  },

  // Danh sách phường/xã thuộc 1 tỉnh, sắp theo tên. Tỉnh rỗng -> [] (không query).
  getWardsByProvince: async (provinceCode: string): Promise<Ward[]> => {
    if (!provinceCode) return [];
    const { data, error } = await supabase
      .from("wards")
      .select("code, name, full_name, province_code")
      .eq("province_code", provinceCode)
      .order("name", { ascending: true });
    if (error) {
      console.error("Lỗi lấy danh sách phường/xã:", error);
      return [];
    }
    return data ?? [];
  },
};
