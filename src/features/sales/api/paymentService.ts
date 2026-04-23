import { safeRpc } from "@/shared/lib/safeRpc";

/**
 * Service cho xác nhận thanh toán thủ công từ ERP.
 * RPC record_manual_payment_received wrap INSERT finance_transactions →
 * trigger auto_allocate update orders.paid_amount/status → trigger notify
 * fire → KH + NV nhận notification + email.
 */
export const paymentService = {
  /**
   * Xác nhận NV đã nhận tiền (CK hoặc tiền mặt) cho 1 đơn.
   * @param orderId UUID đơn
   * @param amount  `undefined` = toàn bộ outstanding
   * @param note    Ghi chú bổ sung
   */
  async recordManualPayment(
    orderId: string,
    amount?: number,
    note?: string,
  ): Promise<{
    success: boolean;
    trans_code: string;
    amount: number;
    order_code: string;
  }> {
    const { data, error } = await safeRpc("record_manual_payment_received", {
      p_order_id: orderId,
      p_amount: amount ?? null,
      p_note: note ?? null,
    });
    if (error) throw error;
    return data as {
      success: boolean;
      trans_code: string;
      amount: number;
      order_code: string;
    };
  },
};
