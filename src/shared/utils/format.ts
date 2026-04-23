export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);
};

/**
 * Format VND compact (no currency symbol) — dùng cho dialog confirm,
 * table cells, inline labels. Append "đ" riêng nếu cần.
 *   formatVnd(1355325) → "1.355.325"
 *   formatVnd(1355325) + " đ" → "1.355.325 đ"
 */
export const formatVnd = (value: number | string): string =>
  new Intl.NumberFormat("vi-VN").format(Number(value) || 0);
