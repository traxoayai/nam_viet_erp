// 1. Header của phiếu kiểm
export interface InventoryCheckSession {
  id: number;
  code: string;
  warehouse_id?: number;
  warehouse_name?: string; // [NEW]
  status: "DRAFT" | "COMPLETED" | "CANCELLED";
  created_at: string;
  completed_at?: string;
  note?: string;

  // Số liệu tài chính
  total_system_value: number;
  total_actual_value: number; // [NEW] Backend trả về
  total_diff_value: number;

  // Thông tin người dùng
  created_by_name: string;
  verified_by_name?: string;

  // Phân trang
  total_count?: number; // [NEW] Backend trả về tổng số dòng để phân trang
}

// 2. Chi tiết từng dòng (Sản phẩm)
export interface InventoryCheckItem {
  id: number; // ID dòng kiểm kê
  check_id: number;
  product_id: number;

  // Thông tin sản phẩm (Join từ bảng Products)
  product_name: string;
  sku: string;
  image_url?: string;
  unit: string; // Đơn vị cơ bản (Viên/Ống...)
  large_unit?: string; // Đơn vị lớn (Hộp/Vỉ...) - Nếu có
  retail_unit_rate: number; // Tỷ lệ quy đổi (VD: 10 viên/vỉ). Mặc định là 1.

  // Batch Info
  batch_code: string;
  expiry_date: string | null;

  // Số lượng (Base Unit - Đơn vị nhỏ nhất)
  system_quantity: number; // Tồn máy (Snapshot lúc tạo)
  actual_quantity: number; // Thực tế (User nhập) - Mặc định pre-fill bằng system_quantity

  // Vị trí (Để sort & hiển thị)
  location_snapshot: string; // VD: "A-01-02"

  // Logic tính toán
  diff_quantity?: number; // actual - system
  cost_price: number;
}
