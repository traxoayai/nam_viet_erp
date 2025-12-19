// src/constants/b2b.ts

export const DELIVERY_METHODS = [
  { label: "Giao nội bộ (Xe cty)", value: "internal" },
  { label: "Giao qua App (Grab/Aha)", value: "app" },
  { label: "Gửi xe khách/Chành", value: "coach" },
] as const;

export const ORDER_STATUSES = [
  { label: "Bản nháp", value: "DRAFT", color: "default" },
  { label: "Báo giá", value: "QUOTE", color: "blue" },
  { label: "Chờ đóng gói", value: "CONFIRMED", color: "orange" },
] as const;

// Định nghĩa các ngưỡng cảnh báo (nếu cần)
export const WARNING_THRESHOLDS = {
  BAD_DEBT: 0, // Nợ xấu > 0 là cảnh báo
  MIN_ORDER_VALUE_FOR_DISCOUNT: 200000,
};
