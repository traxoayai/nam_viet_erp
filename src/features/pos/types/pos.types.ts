// 1. Search Types
export interface UsageInstructions {
  [key: string]: string | undefined;
}

export interface PosProductSearchResult {
  id: number;
  name: string;
  sku: string;
  retail_price: number;
  image_url: string | null;
  unit: string;
  stock_quantity: number;
  location: {
    cabinet: string | null;
    row: string | null;
    slot: string | null;
  };
  usage_instructions: UsageInstructions;
}

// 2. Cart Types
export interface CartItem extends PosProductSearchResult {
  qty: number;
  price: number;
  dosage: string;
  note?: string;
}

export interface CartTotals {
  subTotal: number;
  discountVal: number;
  debtAmount: number;
  grandTotal: number;
}

export interface PosVoucher {
  // --- Thông tin gốc từ DB ---
  id: string; // UUID
  code: string; // VD: "TET2025"
  name: string; // VD: "Lì xì 50k"
  description: string | null; // VD: "Áp dụng cho đơn hàng..."

  type: "public" | "personal" | "point_exchange";
  discount_type: "percent" | "fixed";
  discount_value: number; // Giá trị giảm (VD: 10 hoặc 50000)
  max_discount_value: number | null; // Tối đa giảm (nếu là %)
  min_order_value: number; // Đơn tối thiểu

  valid_from: string; // ISO Date String
  valid_to: string; // ISO Date String (Dùng cái này để hiện HSD)

  apply_to_scope: "all" | "personal";

  // --- Thông tin tính toán (Virtual) ---
  voucher_source: "personal" | "campaign"; // 'personal': Trong ví, 'campaign': Gợi ý
  is_owned: boolean; // Đã lưu chưa?
  days_remaining: number; // Số ngày còn lại ( < 0 là hết hạn, < 3 là sắp hết)

  // [NEW SHOPEE FIELDS]
  is_eligible: boolean; // True/False
  missing_amount: number; // Số tiền cần mua thêm
}

export interface PosCustomerSearchResult {
  id: number;
  code: string;
  name: string;
  phone: string;
  type: "CaNhan" | "ToChuc" | "NguoiGiamHo"; // Core trả về text, map tương ứng
  debt_amount: number;
  loyalty_points: number;
  sub_label: string | null; // Quan trọng: "PH: Nguyễn Văn A" hoặc "Người LH: ..."
}

export interface WarehousePosData {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

export interface PosCreateOrderPayload {
  p_customer_b2b_id: number | null;
  p_customer_b2c_id: number | null;
  p_order_type: "B2B" | "POS";
  p_payment_method: "cash" | "transfer" | "debt";
  p_delivery_address?: string;
  p_delivery_time?: string;
  p_note?: string;
  p_items: {
    product_id: number;
    quantity: number;
    uom: string;
    unit_price: number;
    discount: number;
    is_gift?: boolean;
    note?: string;
  }[];
  p_discount_amount: number;
  p_shipping_fee: number;
  p_status:
    | "DRAFT"
    | "PENDING"
    | "CONFIRMED"
    | "SHIPPING"
    | "COMPLETED"
    | "CANCELLED"
    | "QUOTE"
    | "DELIVERED";
  p_delivery_method?: string;
  p_shipping_partner_id?: number | null;
  p_warehouse_id: number; // [NEW] Trường bắt buộc mới
}
