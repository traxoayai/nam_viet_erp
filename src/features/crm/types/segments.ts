import { Database } from "@/shared/lib/database.types";

// Type gốc từ DB
export type CustomerSegmentRow =
  Database["public"]["Tables"]["customer_segments"]["Row"];

// Cấu trúc JSON Criteria
export interface SegmentCriteria {
  gender?: "Nam" | "Nữ" | "Khác";
  birthday_month?: number | "current";
  min_age?: number;
  max_age?: number;
  min_loyalty?: number;

  // [NEW] Số tháng chưa quay lại mua hàng
  last_purchase_months?: number;
}

// Payload tạo mới
export interface CreateSegmentPayload {
  name: string;
  description?: string;
  type: "static" | "dynamic";
  criteria?: SegmentCriteria;
  is_active?: boolean;
}

// Dữ liệu hiển thị thành viên
export interface SegmentMemberDisplay {
  id: number;
  name: string;
  phone: string | null;
  gender: string | null;
  loyalty_points: number | null;
  added_at: string;
}
