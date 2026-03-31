// Safe money arithmetic — tránh lỗi floating point bằng cách tính trên integer
// Nhân lên SCALE, tính xong chia lại. Giữ tối đa 3 chữ số thập phân.

const SCALE = 1_000; // 3 decimal places

/** Chuyển float → integer (nhân SCALE) */
const toInt = (n: number): number => Math.round(n * SCALE);

/** Chuyển integer → float (chia SCALE) */
const toFloat = (n: number): number => n / SCALE;

/** Cộng */
export const moneyAdd = (a: number, b: number): number =>
  toFloat(toInt(a) + toInt(b));

/** Trừ */
export const moneySub = (a: number, b: number): number =>
  toFloat(toInt(a) - toInt(b));

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

/** Tính invoice totals từ danh sách items */
export const calcInvoiceTotals = (
  items: Array<{ quantity?: number; unit_price?: number; vat_rate?: number }>
) => {
  let totalPreTaxInt = 0;
  let totalTaxInt = 0;

  items.forEach((item) => {
    const qty = Number(item?.quantity) || 0;
    const price = Number(item?.unit_price) || 0;
    const vat = Number(item?.vat_rate) || 0;

    // lineTotal = qty * price (cả 2 qua integer domain, chia SCALE)
    const lineTotalInt = Math.round((toInt(qty) * toInt(price)) / SCALE);
    totalPreTaxInt += lineTotalInt;

    // tax = lineTotal * vat / 100
    totalTaxInt += Math.round((lineTotalInt * vat) / 100);
  });

  const totalPreTax = toFloat(totalPreTaxInt);
  const totalTax = toFloat(totalTaxInt);
  return {
    totalPreTax,
    totalTax,
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
