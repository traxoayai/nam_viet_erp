// src/features/finance/api/posTransactionService.ts
import { RemittanceResponse } from "../types/pos.finance.types";

import { supabase } from "@/shared/lib/supabaseClient";
import { safeRpc } from "@/shared/lib/safeRpc";

export const posTransactionService = {
  /**
   * Gửi yêu cầu nộp tiền mặt cho danh sách đơn hàng
   * @param orderIds - Mảng chứa các UUID của đơn hàng (Lưu ý: Là string, không phải number)
   */
  async submitRemittance(orderIds: string[]): Promise<RemittanceResponse> {
    // 1. Lấy User hiện tại (Người nộp)
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Bạn chưa đăng nhập");

    // 2. Gọi RPC để udate ngược lại danh sách (List) Đơn Hàng POS sang trạng thái "Đã nộp"
    const { data } = await safeRpc("submit_cash_remittance", {
      p_order_ids: orderIds, // Core yêu cầu UUID[] -> Frontend truyền string[]
      p_user_id: userData.user.id,
    });

    return data as unknown as RemittanceResponse;
  },

  async getUserPendingRevenue(userId: string): Promise<number> {
    try {
      const { data } = await safeRpc("get_user_pending_revenue", {
        p_user_id: userId,
      });
      return data as number;
    } catch {
      return 0;
    }
  },
};
export default posTransactionService;
