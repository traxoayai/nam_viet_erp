// src/features/marketing/api/servicePackageService.ts
import type {
  ServicePackageInput,
  ServicePackageItemInput,
  PackageFilter,
  ServicePackageRecord,
} from "@/features/marketing/types/servicePackage";

import { safeRpc } from "@/shared/lib/safeRpc";
import { supabase } from "@/shared/lib/supabaseClient";

export const servicePackageService = {
  // 1. Lấy danh sách
  async fetchPackages(filter: PackageFilter) {
    const { data } = await safeRpc("get_service_packages_list", {
      p_search_query: filter.search_query || null,
      p_type_filter: filter.type_filter || null,
      p_status_filter: filter.status_filter || null,
      p_page_num: filter.page_num || 1,
      p_page_size: filter.page_size || 10,
    });

    // Backend trả về total_count trong mỗi dòng, lấy dòng đầu tiên
    const totalCount = data && data.length > 0 ? data[0].total_count : 0;
    return { data: data as ServicePackageRecord[], totalCount };
  },

  // 2. Lấy chi tiết
  async getPackageDetails(id: number) {
    const { data } = await safeRpc("get_service_package_details", {
      p_id: id,
    });
    return data; // Trả về JSON { package_data, package_items }
  },

  // 3. Tính giá vốn (Server-side)
  async calculateCost(items: ServicePackageItemInput[]) {
    const { data } = await safeRpc("calculate_package_cost", {
      p_items: items,
    });
    return data as number;
  },

  // 4. Tạo mới
  async createPackage(
    pkgData: ServicePackageInput,
    items: ServicePackageItemInput[]
  ) {
    const { data } = await safeRpc("create_service_package", {
      p_data: pkgData,
      p_items: items,
    });
    return data;
  },

  // 5. Cập nhật
  async updatePackage(
    id: number,
    pkgData: ServicePackageInput,
    items: ServicePackageItemInput[]
  ) {
    await safeRpc("update_service_package", {
      p_id: id,
      p_data: pkgData,
      p_items: items,
    });
    return true;
  },

  // 6. Xóa (Cần thêm RPC delete nếu chưa có, hoặc dùng update status)
  // 6. Xóa Gói (Soft Delete thông qua RPC)
  async deletePackage(ids: number[]) {
    // Gọi RPC delete_service_packages của Core
    await safeRpc("delete_service_packages", {
      p_ids: ids,
    });
    return true;
  },

  // 7. Cập nhật trạng thái hàng loạt (Active/Inactive)
  async updatePackagesStatus(ids: number[], status: "active" | "inactive") {
    const { error } = await supabase
      .from("service_packages")
      .update({ status: status })
      .in("id", ids);

    if (error) {
      console.error("Lỗi cập nhật trạng thái gói:", error);
      throw error;
    }
    return true;
  },
};
