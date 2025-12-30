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

export interface AppliedVoucher {
  id: number;
  code: string;
  name?: string; // Thêm tên để hiển thị
  discount_type: 'percent' | 'fixed';
  discount_value: number;
}

export interface PosCustomerSearchResult {
  id: number;
  code: string;
  name: string;
  phone: string;
  type: 'CaNhan' | 'ToChuc' | 'NguoiGiamHo'; // Core trả về text, map tương ứng
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
