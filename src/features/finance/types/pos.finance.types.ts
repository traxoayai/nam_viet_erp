// Định nghĩa kết quả trả về từ RPC submit_cash_remittance
export interface RemittanceResponse {
  success: boolean;
  updated_count: number; // Số lượng đơn hàng đã cập nhật
  total_amount: number; // Tổng tiền đã nộp
  transaction_code: string; // Mã phiếu thu vừa sinh (Quan trọng để hiển thị)
}

// Payload gửi lên (nếu cần strict type)
export interface RemittancePayload {
  orderIds: string[]; // UUID của các đơn hàng
  userId: string; // UUID người nộp
}
