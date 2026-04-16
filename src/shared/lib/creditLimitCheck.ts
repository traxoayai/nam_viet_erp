/**
 * Credit Limit Check — Common utility
 *
 * Tập trung logic check hạn mức công nợ B2B.
 * Khi cần bật lại: đổi CREDIT_LIMIT_ENABLED = true
 * và tạo migration bật lại block E trong create_sales_order().
 */

/** Master switch — tạm tắt để bypass hạn mức (data chưa đúng) */
export const CREDIT_LIMIT_ENABLED = false;

interface CreditLimitInput {
  debtLimit: number | null | undefined;
  currentDebt: number;
  orderAmount: number;
}

/**
 * Kiểm tra đơn hàng có vượt hạn mức công nợ không.
 * Trả `false` (không vượt) khi feature bị tắt.
 */
export function isOverCreditLimit({
  debtLimit,
  currentDebt,
  orderAmount,
}: CreditLimitInput): boolean {
  if (!CREDIT_LIMIT_ENABLED) return false;
  if (debtLimit === null || debtLimit === undefined) return false;
  return currentDebt + orderAmount > debtLimit;
}
