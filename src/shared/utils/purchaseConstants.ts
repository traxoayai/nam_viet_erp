export const PO_STATUS_CONFIG: Record<
  string,
  { color: string; label: string }
> = {
  // Lowercase keys
  draft: { color: "default", label: "Nháp" },
  PENDING: { color: "processing", label: "Đã đặt hàng" },
  new: { color: "blue", label: "Mới tạo" },
  approved: { color: "cyan", label: "Đã duyệt" },
  ordering: { color: "processing", label: "Đang đặt hàng" },
  completed: { color: "green", label: "Hoàn thành" },
  cancelled: { color: "red", label: "Đã hủy" },

  // Uppercase keys (Fix lỗi DB trả về hoa)
  DRAFT: { color: "default", label: "Nháp" },
  NEW: { color: "blue", label: "Mới tạo" },
  APPROVED: { color: "cyan", label: "Đã duyệt" },
  ORDERING: { color: "processing", label: "Đang đặt hàng" },
  COMPLETED: { color: "green", label: "Hoàn thành" },
  CANCELLED: { color: "red", label: "Đã hủy" },
};

export const PAYMENT_STATUS_CONFIG: Record<
  string,
  { color: string; label: string }
> = {
  unpaid: { color: "default", label: "Chưa thanh toán" },
  partial: { color: "warning", label: "Thanh toán 1 phần" },
  paid: { color: "success", label: "Đã thanh toán" },
};
