// Map trạng thái đơn hàng sang màu (Ant Design presets)
export const B2B_STATUS_COLOR = {
  DRAFT: "default", // Xám
  QUOTE: "purple", // Tím
  CONFIRMED: "blue", // Xanh dương
  SHIPPING: "cyan", // Xanh lơ
  DELIVERED: "green", // Xanh lá
  CANCELLED: "red", // Đỏ
};

// Map trạng thái thanh toán sang màu (Theo chỉ đạo của CORE)
export const PAYMENT_STATUS_COLOR = {
  unpaid: "red",
  partial: "orange",
  paid: "green",
};

// Label tiếng Việt (Optional)
export const B2B_STATUS_LABEL = {
  DRAFT: "Nháp",
  QUOTE: "Báo giá",
  CONFIRMED: "Đã chốt",
  SHIPPING: "Đang giao",
  DELIVERED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};
