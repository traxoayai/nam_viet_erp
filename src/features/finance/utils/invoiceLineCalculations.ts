/**
 * Pure functions for invoice line-level VAT, discount, fee calculations
 * Used by InvoiceMultiVatForm and related components
 */

export interface InvoiceLineItem {
  quantity: number;
  unit_price: number;
  vat_rate: number; // 0, 5, 10, or decimal 0-1
  discount_amount?: number;
}

export interface InvoiceSummary {
  total_goods: number; // Sum of qty * unit_price
  total_discount: number; // Sum of all discounts (line + global)
  total_pre_tax: number; // total_goods - total_discount
  total_tax: number; // Sum of all VAT
  total_post_tax: number; // total_pre_tax + total_tax
  fee_total?: number;
  final: number; // total_post_tax + fee_total
  tax_by_rate?: Record<number, number>; // e.g. { 10: 100, 5: 25 }
}

/**
 * Calculate line subtotal: qty * unit_price
 */
export function calculateLineSubtotal(quantity: number, unit_price: number): number {
  return quantity * unit_price;
}

/**
 * Calculate amount after discount (never negative)
 */
export function calculateLineAfterDiscount(
  subtotal: number,
  discount_amount: number
): number {
  return Math.max(0, subtotal - discount_amount);
}

/**
 * Calculate tax amount
 * @param amount - Pre-tax amount
 * @param vat_rate - Rate as integer (10) or decimal (0.1)
 */
export function calculateLineTax(amount: number, vat_rate: number): number {
  // Normalize: if vat_rate > 1, treat as percentage; else as decimal
  const rate = vat_rate > 1 ? vat_rate / 100 : vat_rate;
  return amount * rate;
}

/**
 * Calculate total line amount = (qty * price - discount) * (1 + vat_rate)
 */
export function calculateLineTotal(line: InvoiceLineItem): number {
  const subtotal = calculateLineSubtotal(line.quantity, line.unit_price);
  const afterDiscount = calculateLineAfterDiscount(
    subtotal,
    line.discount_amount || 0
  );
  const tax = calculateLineTax(afterDiscount, line.vat_rate);
  return afterDiscount + tax;
}

/**
 * Calculate invoice-level summary from all line items
 * @param lines - Array of line items
 * @param discount_total - Global/header-level discount (VND)
 * @param fee_total - Global/header-level fee (VND)
 */
export function calculateInvoiceSummary(
  lines: InvoiceLineItem[],
  discount_total: number = 0,
  fee_total: number = 0
): InvoiceSummary {
  const total_goods = lines.reduce(
    (sum, line) => sum + calculateLineSubtotal(line.quantity, line.unit_price),
    0
  );

  const total_line_discount = lines.reduce(
    (sum, line) => sum + (line.discount_amount || 0),
    0
  );

  const total_discount = total_line_discount + discount_total;
  const total_pre_tax = total_goods - total_discount;

  // Calculate tax by rate for breakdown
  const tax_by_rate: Record<number, number> = {};
  let total_tax = 0;

  lines.forEach((line) => {
    const subtotal = calculateLineSubtotal(line.quantity, line.unit_price);
    const afterDiscount = calculateLineAfterDiscount(
      subtotal,
      line.discount_amount || 0
    );
    const tax = calculateLineTax(afterDiscount, line.vat_rate);

    // Normalize rate for grouping
    const rate = line.vat_rate > 1 ? line.vat_rate : line.vat_rate * 100;
    if (!tax_by_rate[rate]) {
      tax_by_rate[rate] = 0;
    }
    tax_by_rate[rate] += tax;
    total_tax += tax;
  });

  const total_post_tax = total_pre_tax + total_tax;
  const final = total_post_tax + fee_total;

  return {
    total_goods,
    total_discount,
    total_pre_tax,
    total_tax,
    total_post_tax,
    fee_total: fee_total || undefined,
    final,
    tax_by_rate: Object.keys(tax_by_rate).length > 0 ? tax_by_rate : undefined,
  };
}
