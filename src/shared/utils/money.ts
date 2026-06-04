// Safe money arithmetic — tránh lỗi floating point bằng cách tính trên integer
// Nhân lên SCALE, tính xong chia lại. Giữ tối đa 3 chữ số thập phân.

const SCALE = 1_000; // 3 decimal places

/** Tolerance kế toán mặc định: 100đ (đồng bộ với DB payment allocation). */
export const PAYMENT_TOLERANCE = 100;

/** Chuyển float → integer (nhân SCALE) */
const toInt = (n: number): number => Math.round(n * SCALE);

/** Chuyển integer → float (chia SCALE) */
const toFloat = (n: number): number => n / SCALE;

const toMoneyNumber = (n: number | string | null | undefined): number => {
  const parsed = Number(n ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Cộng */
export const moneyAdd = (a: number, b: number): number =>
  toFloat(toInt(a) + toInt(b));

/** Trừ */
export const moneySub = (a: number, b: number): number =>
  toFloat(toInt(a) - toInt(b));

/** So sánh a >= b với tolerance — tránh lỗi float precision. */
export const moneyGte = (
  a: number | string | null | undefined,
  b: number | string | null | undefined,
  tolerance = 0
): boolean =>
  toInt(toMoneyNumber(a)) + toInt(tolerance) >= toInt(toMoneyNumber(b));

/** Đơn được coi là đã thanh toán: paid + tolerance >= final, và final > 0. */
export const isPaid = (
  paid: number | string | null | undefined,
  final: number | string | null | undefined,
  tolerance = PAYMENT_TOLERANCE
): boolean => {
  const finalAmount = toMoneyNumber(final);
  if (finalAmount <= 0) return false;
  return moneyGte(paid, finalAmount, tolerance);
};

/** Nhân (a * b) — a là tiền, b là hệ số (qty, rate, %) */
export const moneyMul = (a: number, b: number): number =>
  toFloat(Math.round(toInt(a) * b));

/** Chia (a / b) — a là tiền, b là hệ số */
export const moneyDiv = (a: number, b: number): number =>
  b === 0 ? 0 : toFloat(Math.round(toInt(a) / b));

/** Tính tổng mảng số */
export const moneySum = (values: number[]): number =>
  toFloat(values.reduce((sum, v) => sum + toInt(v), 0));

/** Tính lineTotal = qty * price (cả 2 đều qua integer domain) */
export const moneyLineTotal = (qty: number, price: number): number =>
  toFloat(Math.round((toInt(qty) * toInt(price)) / SCALE));

/** Tính VAT: lineTotal * (vatRate / 100) */
export const moneyVat = (lineTotal: number, vatRate: number): number =>
  toFloat(Math.round((toInt(lineTotal) * vatRate) / 100));

/**
 * Tính invoice totals theo chuẩn kế toán VN (VAS).
 * - Tiền hàng nguyên giá (goods) = SL*ĐG.
 * - Chiết khấu dòng: ưu tiên discount_amount; nếu không có thì = goods * discount_rate%.
 * - Thành tiền trước thuế (amount_before_tax) = ưu tiên field có sẵn (XML ThTien),
 *   nếu không thì = goods - discount.
 * - Thuế tính trên amount_before_tax (SAU chiết khấu), KHÔNG phải qty*price.
 * - Tiền phí (opts.totalFee, nhập tay) tách riêng — KHÔNG cộng vào `final` (tổng thanh
 *   toán hóa đơn = chưa thuế + thuế), vì phí thường không nằm trên TgTTTBSo của hóa đơn;
 *   phí được phân bổ vào GIÁ VỐN tồn kho ở backend (process_vat_invoice_entry).
 * Tương thích ngược: caller cũ chỉ truyền {quantity, unit_price, vat_rate} → discount=0,
 * amount_before_tax=goods → kết quả totalPreTax/totalTax/final y như trước.
 */
export const calcInvoiceTotals = (
  items: Array<{
    quantity?: number;
    unit_price?: number;
    vat_rate?: number;
    discount_amount?: number;
    discount_rate?: number;
    amount_before_tax?: number;
  }>,
  opts?: { totalFee?: number }
) => {
  let totalGoodsInt = 0;
  let totalDiscountInt = 0;
  let totalPreTaxInt = 0;
  let totalTaxInt = 0;

  items.forEach((item) => {
    const qty = Number(item?.quantity) || 0;
    const price = Number(item?.unit_price) || 0;
    const vat = Number(item?.vat_rate) || 0;

    // goods = SL*ĐG (qua integer domain)
    const goodsInt = Math.round((toInt(qty) * toInt(price)) / SCALE);

    // chiết khấu dòng: ưu tiên discount_amount, else theo discount_rate%
    let discountInt = 0;
    if (item?.discount_amount != null) {
      discountInt = toInt(Number(item.discount_amount) || 0);
    } else if (item?.discount_rate) {
      discountInt = Math.round(
        (goodsInt * (Number(item.discount_rate) || 0)) / 100
      );
    }

    // thành tiền trước thuế: ưu tiên field XML (ThTien), else goods - discount
    const amountBeforeTaxInt =
      item?.amount_before_tax != null
        ? toInt(Number(item.amount_before_tax) || 0)
        : goodsInt - discountInt;

    totalGoodsInt += goodsInt;
    totalDiscountInt += discountInt;
    totalPreTaxInt += amountBeforeTaxInt;
    // thuế tính trên thành tiền SAU chiết khấu
    totalTaxInt += Math.round((amountBeforeTaxInt * vat) / 100);
  });

  const totalFeeInt = toInt(Number(opts?.totalFee) || 0);

  return {
    totalGoods: toFloat(totalGoodsInt),
    totalDiscount: toFloat(totalDiscountInt),
    totalPreTax: toFloat(totalPreTaxInt),
    totalTax: toFloat(totalTaxInt),
    totalFee: toFloat(totalFeeInt),
    // tổng thanh toán hóa đơn = chưa thuế + thuế (khớp TgTTTBSo); phí KHÔNG cộng vào đây
    final: toFloat(totalPreTaxInt + totalTaxInt),
  };
};

/** Format tiền hiển thị — giữ decimal nếu có, bỏ trailing zeros */
export const fmtMoney = (v: number | null | undefined): string => {
  if (v == null) return "0";
  // Nếu là số nguyên → không cần decimal
  if (Number.isInteger(v)) return v.toLocaleString();
  // Có decimal → giữ tối đa 3 chữ số, bỏ trailing 0
  const fixed = v.toFixed(3).replace(/\.?0+$/, "");
  // Format phần integer với dấu phẩy
  const [intPart, decPart] = fixed.split(".");
  const formatted = Number(intPart).toLocaleString();
  return decPart ? `${formatted}.${decPart}` : formatted;
};
