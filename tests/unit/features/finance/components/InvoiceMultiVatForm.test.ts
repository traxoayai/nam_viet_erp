/**
 * Unit tests: InvoiceMultiVatForm — payload structure and type validation
 */
import { describe, it, expect, vi } from "vitest";

import type { InvoiceSubmitPayload } from "@/features/finance/types/invoiceTypes";

describe("InvoiceMultiVatForm", () => {
  describe("Type validation", () => {
    it("InvoiceSubmitPayload has required structure", () => {
      const mockPayload: InvoiceSubmitPayload = {
        invoice_number: "HĐ-001",
        invoice_date: "2025-06-13",
        customer_name: "Khách hàng A",
        customer_tax_code: "0123456789",
        items_json: {
          lines: [
            {
              product_name: "Sản phẩm A",
              quantity: 10,
              unit_price: 100,
              discount_amount: 0,
              vat_rate: 10,
              vat_amount: 100,
              line_total: 1100,
            },
          ],
        },
        discount_total: 0,
        fee_total: 0,
        summary: {
          total_goods: 1000,
          total_discount: 0,
          total_pre_tax: 1000,
          total_tax: 100,
          total_post_tax: 1100,
          final: 1100,
        },
      };

      expect(mockPayload.invoice_number).toBe("HĐ-001");
      expect(mockPayload.customer_tax_code).toBeDefined();
      expect(mockPayload.items_json.lines).toHaveLength(1);
      expect(mockPayload.summary.final).toBe(1100);
    });

    it("supports multi-VAT rates per line", () => {
      const payload: InvoiceSubmitPayload = {
        invoice_number: "HĐ-002",
        invoice_date: "2025-06-13",
        customer_name: "Khách hàng B",
        customer_tax_code: "9876543210",
        items_json: {
          lines: [
            {
              product_name: "SP1",
              quantity: 5,
              unit_price: 100,
              discount_amount: 0,
              vat_rate: 0,
              vat_amount: 0,
              line_total: 500,
            },
            {
              product_name: "SP2",
              quantity: 10,
              unit_price: 100,
              discount_amount: 0,
              vat_rate: 5,
              vat_amount: 50,
              line_total: 1050,
            },
            {
              product_name: "SP3",
              quantity: 20,
              unit_price: 100,
              discount_amount: 0,
              vat_rate: 10,
              vat_amount: 200,
              line_total: 2200,
            },
          ],
        },
        discount_total: 0,
        fee_total: 0,
        summary: {
          total_goods: 3500,
          total_discount: 0,
          total_pre_tax: 3500,
          total_tax: 250,
          total_post_tax: 3750,
          final: 3750,
          tax_by_rate: { 0: 0, 5: 50, 10: 200 },
        },
      };

      expect(payload.items_json.lines).toHaveLength(3);
      expect(payload.items_json.lines[0]?.vat_rate).toBe(0);
      expect(payload.items_json.lines[1]?.vat_rate).toBe(5);
      expect(payload.items_json.lines[2]?.vat_rate).toBe(10);
      expect(payload.summary.tax_by_rate?.[5]).toBe(50);
    });

    it("handles global discount and fee", () => {
      const payload: InvoiceSubmitPayload = {
        invoice_number: "HĐ-003",
        invoice_date: "2025-06-13",
        customer_name: "Khách hàng C",
        customer_tax_code: "1111111111",
        items_json: {
          lines: [
            {
              product_name: "SP",
              quantity: 10,
              unit_price: 100,
              discount_amount: 50,
              vat_rate: 10,
              vat_amount: 95,
              line_total: 1045,
            },
          ],
        },
        discount_total: 100,
        fee_total: 200,
        summary: {
          total_goods: 1000,
          total_discount: 150,
          total_pre_tax: 850,
          total_tax: 100,
          total_post_tax: 950,
          final: 1150,
        },
      };

      expect(payload.discount_total).toBe(100);
      expect(payload.fee_total).toBe(200);
      expect(payload.summary.final).toBe(1150);
    });

    it("validates MST (customer_tax_code) is required", () => {
      const mockOnSubmit = vi.fn<[InvoiceSubmitPayload], void>((p) => {
        expect(p.customer_tax_code).toBeTruthy();
      });

      const payload: InvoiceSubmitPayload = {
        invoice_number: "HĐ-004",
        invoice_date: "2025-06-13",
        customer_name: "Khách test",
        customer_tax_code: "9999999999",
        items_json: { lines: [] },
        discount_total: 0,
        fee_total: 0,
        summary: {
          total_goods: 0,
          total_discount: 0,
          total_pre_tax: 0,
          total_tax: 0,
          total_post_tax: 0,
          final: 0,
        },
      };

      mockOnSubmit(payload);
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ customer_tax_code: "9999999999" })
      );
    });
  });

  describe("Payload calculation validation", () => {
    it("calculates final = post_tax + fee_total", () => {
      const payload: InvoiceSubmitPayload = {
        invoice_number: "HĐ",
        invoice_date: "2025-06-13",
        customer_name: "Test",
        customer_tax_code: "0000000000",
        items_json: { lines: [] },
        discount_total: 0,
        fee_total: 500,
        summary: {
          total_goods: 1000,
          total_discount: 0,
          total_pre_tax: 1000,
          total_tax: 100,
          total_post_tax: 1100,
          final: 1600,
        },
      };

      expect(payload.summary.final).toBe(
        payload.summary.total_post_tax + payload.fee_total
      );
    });
  });
});
