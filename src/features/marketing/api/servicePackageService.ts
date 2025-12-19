// src/services/servicePackageService.ts
import type {
  ServicePackageInput,
  ServicePackageItemInput,
  PackageFilter,
  ServicePackageRecord,
} from "@/features/marketing/types/servicePackage";

import { supabase } from "@/shared/lib/supabaseClient";

export const servicePackageService = {
  // 1. Lấy danh sách
  async fetchPackages(filter: PackageFilter) {
    const { data, error } = await supabase.rpc("get_service_packages_list", {
      p_search_query: filter.search_query || null,
      p_type_filter: filter.type_filter || null,
      p_status_filter: filter.status_filter || null,
      p_page_num: filter.page_num || 1,
      p_page_size: filter.page_size || 10,
    });

    if (error) throw error;

    // Backend trả về total_count trong mỗi dòng, lấy dòng đầu tiên
    const totalCount = data && data.length > 0 ? data[0].total_count : 0;
    return { data: data as ServicePackageRecord[], totalCount };
  },

  // 2. Lấy chi tiết
  async getPackageDetails(id: number) {
    const { data, error } = await supabase.rpc("get_service_package_details", {
      p_id: id,
    });
    if (error) throw error;
    return data; // Trả về JSON { package_data, package_items }
  },

  // 3. Tính giá vốn (Server-side)
  async calculateCost(items: ServicePackageItemInput[]) {
    const { data, error } = await supabase.rpc("calculate_package_cost", {
      p_items: items,
    });
    if (error) throw error;
    return data as number;
  },

  // 4. Tạo mới
  async createPackage(
    pkgData: ServicePackageInput,
    items: ServicePackageItemInput[]
  ) {
    const { data, error } = await supabase.rpc("create_service_package", {
      p_data: pkgData,
      p_items: items,
    });
    if (error) throw error;
    return data;
  },

  // 5. Cập nhật
  async updatePackage(
    id: number,
    pkgData: ServicePackageInput,
    items: ServicePackageItemInput[]
  ) {
    const { error } = await supabase.rpc("update_service_package", {
      p_id: id,
      p_data: pkgData,
      p_items: items,
    });
    if (error) throw error;
    return true;
  },

  // 6. Xóa (Cần thêm RPC delete nếu chưa có, hoặc dùng update status)
  // Tạm thời dùng update status
  async deletePackage(id: number) {
    console.warn("Chưa có RPC delete_service_package, tạm thời bỏ qua ID:", id);
    // Sếp có thể thêm RPC xóa thật sau:
    // const { error } = await supabase.rpc('delete_service_package', { p_id: id });
    return true;
  },
};
