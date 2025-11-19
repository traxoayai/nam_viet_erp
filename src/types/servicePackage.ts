// src/types/servicePackage.ts

// 1. Type cho Item trong gói (Input từ Frontend)
export interface ServicePackageItemInput {
  item_id: string; // Đổi product_id -> item_id cho khớp RPC
  quantity: number;
  item_type: "product" | "service"; // Thêm loại để phân biệt
  schedule_days?: number; // Số ngày nhắc lịch (cho Gói)
}

// 2. Type cho Gói Dịch vụ (Input từ Frontend)
export interface ServicePackageInput {
  name: string;
  sku: string; // Đổi code -> sku
  unit: string;
  type: "service" | "bundle";
  price: number; // Giá bán lẻ
  revenueAccountId: string;
  validFrom: string;
  validTo: string;
  status: "active" | "inactive";
  validityDays?: number;
  applicableBranches: string[]; // Mảng ID kho
  applicableChannels: string;
}

// 3. Filter (Input cho Fetch)
export interface PackageFilter {
  search_query?: string; // Đổi search -> search_query
  type_filter?: string;
  status_filter?: string;
  page_num?: number;
  page_size?: number;
}

// 4. Record hiển thị trên Table (Output từ Server)
export interface ServicePackageRecord {
  key: string;
  id: number; // Backend trả về bigint (number)
  name: string;
  sku: string;
  type: "service" | "bundle";
  price: number;
  total_cost_price: number;
  status: "active" | "inactive";
  valid_from: string;
  valid_to: string;
}

// 5. Chi tiết gói (Output từ Server khi Sửa)
export interface ServicePackageDetail {
  package_data: ServicePackageRecord & ServicePackageInput; // Merge lại
  package_items: Array<
    ServicePackageItemInput & {
      key: string;
      name: string;
      unit: string;
    }
  >;
}
