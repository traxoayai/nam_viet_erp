/**
 * Unit tests: invoiceLineCalculations — verify per-line VAT, discount, fee logic
 * TDD: Pure function tests without React dependency
 */
import { describe, it, expect } from "vitest";
import {
  calculateLineSubtotal,
  calculateLineAfterDiscount,
  calculateLineTax,
  calculateLineTotal,
  calculateInvoiceSummary,
} from "@/features/finance/utils/invoiceLineCalculations";

describe("invoiceLineCalculations", () => {
  describe("calculateLineSubtotal", () => {
    it("qty=10, unit_price=100 → subtotal=1000", () => {
      expect(calculateLineSubtotal(10, 100)).toBe(1000);
    });

    it("qty=1, unit_price=0 → 0", () => {
      expect(calculateLineSubtotal(1, 0)).toBe(0);
    });

    it("decimal qty: 2.5 * 100 = 250", () => {
      expect(calculateLineSubtotal(2.5, 100)).toBe(250);
    });
  });

  describe("calculateLineAfterDiscount", () => {
    it("subtotal=1000, discount=100 → 900", () => {
      expect(calculateLineAfterDiscount(1000, 100)).toBe(900);
    });

    it("subtotal=1000, discount=0 → 1000", () => {
      expect(calculateLineAfterDiscount(1000, 0)).toBe(1000);
    });

    it("never goes negative: subtotal=100, discount=200 → 0", () => {
      expect(calculateLineAfterDiscount(100, 200)).toBe(0);
    });
  });

  describe("calculateLineTax", () => {
    it("amount=1000, vat_rate=10% → 100", () => {
      expect(calculateLineTax(1000, 10)).toBe(100);
    });

    it("amount=1000, vat_rate=5% → 50", () => {
      expect(calculateLineTax(1000, 5)).toBe(50);
    });

    it("amount=1000, vat_rate=0% → 0", () => {
      expect(calculateLineTax(1000, 0)).toBe(0);
    });

    it("amount=1000, vat_rate=0.1 (decimal) → 100", () => {
      expect(calculateLineTax(1000, 0.1)).toBe(100);
    });
  });

  describe("calculateLineTotal", () => {
    it("qty=10, unit_price=100, vat=10%, no discount → (10*100)*(1+0.1)=1100", () => {
      expect(
        calculateLineTotal({
          quantity: 10,
          unit_price: 100,
          vat_rate: 10,
          discount_amount: 0,
        })
      ).toBe(1100);
    });

    it("qty=10, unit_price=100, vat=10%, discount=50 → (10*100-50)*(1+0.1)=1045", () => {
      expect(
        calculateLineTotal({
          quantity: 10,
          unit_price: 100,
          vat_rate: 10,
          discount_amount: 50,
        })
      ).toBe(1045);
    });

    it("qty=5, unit_price=200, vat=0%, discount=100 → 5*200-100=900", () => {
      expect(
        calculateLineTotal({
          quantity: 5,
          unit_price: 200,
          vat_rate: 0,
          discount_amount: 100,
        })
      ).toBe(900);
    });

    it("qty=100, unit_price=1000, vat=5%, discount=5000 → (100000-5000)*1.05=99750", () => {
      expect(
        calculateLineTotal({
          quantity: 100,
          unit_price: 1000,
          vat_rate: 5,
          discount_amount: 5000,
        })
      ).toBe(99750);
    });
  });

  describe("calculateInvoiceSummary", () => {
    it("single line: qty=10, price=100, vat=10%, no discount", () => {
      const lines = [
        {
          quantity: 10,
          unit_price: 100,
          vat_rate: 10,
          discount_amount: 0,
        },
      ];

      const summary = calculateInvoiceSummary(lines, 0, 0);

      expect(summary.total_goods).toBe(1000); // 10*100
      expect(summary.total_discount).toBe(0);
      expect(summary.total_pre_tax).toBe(1000);
      expect(summary.total_tax).toBe(100); // 1000*0.1
      expect(summary.total_post_tax).toBe(1100); // 1000+100
      expect(summary.final).toBe(1100);
    });

    it("multiple lines with different VAT rates", () => {
      const lines = [
        {
          quantity: 10,
          unit_price: 100,
          vat_rate: 10,
          discount_amount: 0,
        },
        {
          quantity: 5,
          unit_price: 100,
          vat_rate: 5,
          discount_amount: 0,
        },
        {
          quantity: 20,
          unit_price: 100,
          vat_rate: 0,
          discount_amount: 0,
        },
      ];

      const summary = calculateInvoiceSummary(lines, 0, 0);

      expect(summary.total_goods).toBe(3500); // 1000+500+2000
      expect(summary.total_pre_tax).toBe(3500);
      // VAT: 1000*0.1 + 500*0.05 + 2000*0 = 100 + 25 + 0 = 125
      expect(summary.total_tax).toBe(125); // 100 + 25 + 0
      expect(summary.total_post_tax).toBe(3625);
      expect(summary.final).toBe(3625);
    });

    it("with line-level discount: qty=10, price=100, vat=10%, discount=50", () => {
      const lines = [
        {
          quantity: 10,
          unit_price: 100,
          vat_rate: 10,
          discount_amount: 50,
        },
      ];

      const summary = calculateInvoiceSummary(lines, 0, 0);

      expect(summary.total_goods).toBe(1000);
      expect(summary.total_discount).toBe(50);
      expect(summary.total_pre_tax).toBe(950);
      expect(summary.total_tax).toBe(95); // 950*0.1
      expect(summary.total_post_tax).toBe(1045);
      expect(summary.final).toBe(1045);
    });

    it("with global discount_total and fee_total", () => {
      const lines = [
        {
          quantity: 10,
          unit_price: 100,
          vat_rate: 10,
          discount_amount: 0,
        },
      ];

      const summary = calculateInvoiceSummary(lines, 50, 100);

      expect(summary.total_goods).toBe(1000);
      expect(summary.total_discount).toBe(50); // global
      expect(summary.total_pre_tax).toBe(950);
      // VAT calculated on line items only: 1000*0.1 = 100 (not affected by global discount)
      expect(summary.total_tax).toBe(100);
      expect(summary.total_post_tax).toBe(1050);
      expect(summary.fee_total).toBe(100);
      expect(summary.final).toBe(1150); // 1050 + 100
    });

    it("empty lines → all zeros", () => {
      const summary = calculateInvoiceSummary([], 0, 0);

      expect(summary.total_goods).toBe(0);
      expect(summary.total_discount).toBe(0);
      expect(summary.total_pre_tax).toBe(0);
      expect(summary.total_tax).toBe(0);
      expect(summary.total_post_tax).toBe(0);
      expect(summary.final).toBe(0);
    });

    it("breakdown by VAT rate included", () => {
      const lines = [
        { quantity: 10, unit_price: 100, vat_rate: 10, discount_amount: 0 },
        { quantity: 5, unit_price: 100, vat_rate: 5, discount_amount: 0 },
      ];

      const summary = calculateInvoiceSummary(lines, 0, 0);

      expect(summary.tax_by_rate).toBeDefined();
      expect(summary.tax_by_rate?.[10]).toBe(100); // 1000*0.1
      expect(summary.tax_by_rate?.[5]).toBe(25); // 500*0.05
    });
  });
});
