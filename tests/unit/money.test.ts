import { describe, it, expect } from "vitest";
import {
  moneyAdd,
  moneySub,
  moneyMul,
  moneyDiv,
  moneySum,
  moneyLineTotal,
  moneyVat,
  calcInvoiceTotals,
  fmtMoney,
} from "@/shared/utils/money";

// ---------------------------------------------------------------------------
// moneyAdd
// ---------------------------------------------------------------------------
describe("moneyAdd", () => {
  it("fixes classic floating-point 0.1 + 0.2 = 0.3", () => {
    expect(moneyAdd(0.1, 0.2)).toBe(0.3);
  });

  it("adds two whole numbers", () => {
    expect(moneyAdd(1000, 2000)).toBe(3000);
  });

  it("adds zero to a value", () => {
    expect(moneyAdd(99999, 0)).toBe(99999);
  });

  it("handles large numbers without overflow", () => {
    expect(moneyAdd(100_000_000, 200_000_000)).toBe(300_000_000);
  });

  it("handles negative addend", () => {
    expect(moneyAdd(500, -200)).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// moneySub
// ---------------------------------------------------------------------------
describe("moneySub", () => {
  it("subtracts two whole numbers", () => {
    expect(moneySub(1000, 400)).toBe(600);
  });

  it("handles floating-point subtraction 0.3 - 0.1 = 0.2", () => {
    expect(moneySub(0.3, 0.1)).toBe(0.2);
  });

  it("returns negative when result is negative", () => {
    expect(moneySub(100, 300)).toBe(-200);
  });

  it("subtracting zero returns same value", () => {
    expect(moneySub(50000, 0)).toBe(50000);
  });
});

// ---------------------------------------------------------------------------
// moneyMul
// ---------------------------------------------------------------------------
describe("moneyMul", () => {
  it("multiplies price by a coefficient: 10000 * 1.1 = 11000", () => {
    expect(moneyMul(10000, 1.1)).toBe(11000);
  });

  it("multiplies by 1 returns same value", () => {
    expect(moneyMul(50000, 1)).toBe(50000);
  });

  it("multiplies by 0 returns 0", () => {
    expect(moneyMul(99999, 0)).toBe(0);
  });

  it("multiplies by decimal coefficient: 100000 * 0.1 = 10000", () => {
    expect(moneyMul(100000, 0.1)).toBe(10000);
  });

  it("multiplies large price by VAT rate: 200000 * 1.08 = 216000", () => {
    expect(moneyMul(200000, 1.08)).toBe(216000);
  });
});

// ---------------------------------------------------------------------------
// moneyDiv
// ---------------------------------------------------------------------------
describe("moneyDiv", () => {
  it("divides by an integer: 10000 / 2 = 5000", () => {
    expect(moneyDiv(10000, 2)).toBe(5000);
  });

  it("returns 0 when dividing by zero (guard)", () => {
    expect(moneyDiv(99999, 0)).toBe(0);
  });

  it("divides by fractional divisor: 1000 / 4 = 250", () => {
    expect(moneyDiv(1000, 4)).toBe(250);
  });
});

// ---------------------------------------------------------------------------
// moneySum
// ---------------------------------------------------------------------------
describe("moneySum", () => {
  it("sums an array of integers", () => {
    expect(moneySum([1000, 2000, 3000])).toBe(6000);
  });

  it("returns 0 for an empty array", () => {
    expect(moneySum([])).toBe(0);
  });

  it("sums an array with floating-point values", () => {
    expect(moneySum([0.1, 0.2, 0.3])).toBe(0.6);
  });

  it("sums an array with a single element", () => {
    expect(moneySum([42000])).toBe(42000);
  });

  it("sums mixed positive and negative values", () => {
    expect(moneySum([5000, -2000, 1000])).toBe(4000);
  });
});

// ---------------------------------------------------------------------------
// moneyLineTotal
// ---------------------------------------------------------------------------
describe("moneyLineTotal", () => {
  it("computes qty * price: 2 * 50000 = 100000", () => {
    expect(moneyLineTotal(2, 50000)).toBe(100000);
  });

  it("returns 0 when qty is 0", () => {
    expect(moneyLineTotal(0, 50000)).toBe(0);
  });

  it("handles decimal quantity: 1.5 * 100 = 150", () => {
    expect(moneyLineTotal(1.5, 100)).toBe(150);
  });

  it("handles fractional qty and price: 3 * 33333.333 rounds correctly", () => {
    // toInt(3)=3000, toInt(33333.333)=33333333
    // Math.round(3000 * 33333333 / 1000) = Math.round(99999999) = 99999999
    // toFloat(99999999) = 99999.999
    expect(moneyLineTotal(3, 33333.333)).toBe(99999.999);
  });

  it("price of 0 returns 0 regardless of qty", () => {
    expect(moneyLineTotal(10, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// moneyVat
// ---------------------------------------------------------------------------
describe("moneyVat", () => {
  it("computes 10% VAT on 100000 = 10000", () => {
    expect(moneyVat(100000, 10)).toBe(10000);
  });

  it("returns 0 when VAT rate is 0%", () => {
    expect(moneyVat(100000, 0)).toBe(0);
  });

  it("computes 8% VAT: 200000 * 8% = 16000", () => {
    expect(moneyVat(200000, 8)).toBe(16000);
  });

  it("computes 5% VAT: 50000 * 5% = 2500", () => {
    expect(moneyVat(50000, 5)).toBe(2500);
  });

  it("handles VAT on zero line total", () => {
    expect(moneyVat(0, 10)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calcInvoiceTotals
// ---------------------------------------------------------------------------
describe("calcInvoiceTotals", () => {
  it("returns zeros for an empty item list", () => {
    const result = calcInvoiceTotals([]);
    expect(result.totalPreTax).toBe(0);
    expect(result.totalTax).toBe(0);
    expect(result.final).toBe(0);
  });

  it("computes totals for a single item with 10% VAT", () => {
    // qty=2, price=50000, vat=10 → lineTotal=100000, tax=10000, final=110000
    const result = calcInvoiceTotals([
      { quantity: 2, unit_price: 50000, vat_rate: 10 },
    ]);
    expect(result.totalPreTax).toBe(100000);
    expect(result.totalTax).toBe(10000);
    expect(result.final).toBe(110000);
  });

  it("aggregates multiple items correctly", () => {
    // item1: qty=1, price=100000, vat=10 → preTax=100000, tax=10000
    // item2: qty=2, price=50000, vat=0  → preTax=100000, tax=0
    const result = calcInvoiceTotals([
      { quantity: 1, unit_price: 100000, vat_rate: 10 },
      { quantity: 2, unit_price: 50000, vat_rate: 0 },
    ]);
    expect(result.totalPreTax).toBe(200000);
    expect(result.totalTax).toBe(10000);
    expect(result.final).toBe(210000);
  });

  it("handles items with undefined/null fields gracefully", () => {
    // Missing fields should default to 0
    const result = calcInvoiceTotals([{}]);
    expect(result.totalPreTax).toBe(0);
    expect(result.totalTax).toBe(0);
    expect(result.final).toBe(0);
  });

  it("returns final = totalPreTax + totalTax", () => {
    const result = calcInvoiceTotals([
      { quantity: 3, unit_price: 30000, vat_rate: 8 },
    ]);
    expect(result.final).toBe(result.totalPreTax + result.totalTax);
  });
});

// ---------------------------------------------------------------------------
// fmtMoney
// ---------------------------------------------------------------------------
describe("fmtMoney", () => {
  it('returns "0" for null input', () => {
    expect(fmtMoney(null)).toBe("0");
  });

  it('returns "0" for undefined input', () => {
    expect(fmtMoney(undefined)).toBe("0");
  });

  it("formats an integer without decimal part", () => {
    // Integer: uses toLocaleString, no decimal digits
    const result = fmtMoney(1000);
    expect(result).not.toContain(".");
    // Should contain the digits 1 and 0s
    expect(result.replace(/[,.\s]/g, "")).toBe("1000");
  });

  it("formats zero as '0'", () => {
    const result = fmtMoney(0);
    expect(result).toBe("0");
  });

  it("strips trailing zeros from decimals", () => {
    // 1000.100 → fixed(3)="1000.100" → replace trailing 0s → "1000.1"
    const result = fmtMoney(1000.1);
    expect(result.endsWith(".1")).toBe(true);
    // Must NOT end with ".10" or ".100"
    expect(result).not.toMatch(/\.10+$/);
  });

  it("keeps significant decimal digits: 1000.123", () => {
    const result = fmtMoney(1000.123);
    expect(result.endsWith(".123")).toBe(true);
  });

  it("strips all decimal digits when all are zero: 1000.000", () => {
    // 1000.000 — JavaScript treats this as integer 1000
    const result = fmtMoney(1000.0);
    expect(result).not.toContain(".");
    expect(result.replace(/[,.\s]/g, "")).toBe("1000");
  });

  it("formats large integer with locale separators", () => {
    // The integer part should be separated (locale-specific commas or dots)
    const result = fmtMoney(1_000_000);
    // Strip separators — the numeric value should be 1000000
    expect(result.replace(/[,.\s\u00A0]/g, "")).toBe("1000000");
    // Should have at least one separator character
    expect(result.length).toBeGreaterThan(7);
  });
});
