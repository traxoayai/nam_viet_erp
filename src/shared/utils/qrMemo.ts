/**
 * Helper rút gọn memo cho VietQR addInfo.
 *
 * Lý do: QR addInfo có max 25 ký tự (EMVCo). Mã đơn DB hiện tại dài
 * `SO-260425-00006840` (18 ký tự) + tiền tố `TT ` → vượt quá khi thêm số PO/
 * receiver. Khách CK qua app banking thường strip dấu gạch → memo nhận về dài
 * hơn cần thiết.
 *
 * Format mới: PREFIX + 8-digit suffix, không gạch, không space.
 *   `SO-260425-00006840` → `SO00006840`
 *   `POS-260425-00001234` → `POS00001234`
 *
 * Backward compat: nếu code không match format chuẩn (vd legacy SO-260423-1234
 * 4 chữ số), vẫn strip dấu gạch để tiết kiệm ký tự: `SO-260423-1234` → `SO2604231234`.
 *
 * Server-side parser `extract_order_codes_from_memo` resolve cả 2 dạng.
 */
export function buildOrderQrMemo(orderCode: string | null | undefined): string {
  if (!orderCode) return "";
  const code = orderCode.trim().toUpperCase();
  // Format mới: SO|POS - YYMMDD - 8digits → PREFIX + 8digits
  const m = code.match(/^(SO|POS)-\d{6}-(\d{8})$/);
  if (m) return `${m[1]}${m[2]}`;
  // Format cũ 4-digit hoặc bất thường: chỉ strip dấu gạch
  return code.replace(/-/g, "");
}
