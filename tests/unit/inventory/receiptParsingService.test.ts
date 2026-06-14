// tests/unit/inventory/receiptParsingService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  receiptParsingService,
  ParsedReceiptData,
  AnalyzeReceiptInvoiceResponse,
} from "@/features/inventory/api/receiptParsingService";
import * as safeRpcModule from "@/shared/lib/safeRpc";

// Mock safeRpc
vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: vi.fn(),
}));

describe("receiptParsingService", () => {
  const mockSafeRpc = safeRpcModule.safeRpc as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeReceiptInvoice", () => {
    it("should return parsed receipt data on success", async () => {
      const mockResponse: ParsedReceiptData = {
        supplier_name: "ABC Supplier",
        receipt_date: "2026-06-14",
        receipt_number: "INV-001",
        items: [
          {
            product_name: "Product A",
            quantity: 10,
            unit_price: 100,
            total_price: 1000,
            sku: "SKU-A",
            confidence: 95,
          },
        ],
        total_amount: 1000,
        confidence_score: 95,
      };

      mockSafeRpc.mockResolvedValue({ data: mockResponse, error: null });

      const result = await receiptParsingService.analyzeReceiptInvoice(
        "base64data",
        "image/png"
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(mockSafeRpc).toHaveBeenCalledWith("analyze_receipt_invoice", {
        p_image_base64: "base64data",
        p_image_mime_type: "image/png",
      });
    });

    it("should handle RPC error gracefully", async () => {
      const mockError = new Error("RPC timeout");
      mockSafeRpc.mockResolvedValue({
        data: null,
        error: mockError,
      });

      const result = await receiptParsingService.analyzeReceiptInvoice(
        "base64data",
        "image/jpeg"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should parse multiple items in receipt", async () => {
      const mockResponse: ParsedReceiptData = {
        supplier_name: "Multi Item Supplier",
        receipt_date: "2026-06-14",
        receipt_number: "INV-002",
        items: [
          {
            product_name: "Product A",
            quantity: 5,
            unit_price: 50,
            total_price: 250,
            sku: "SKU-A",
            confidence: 90,
          },
          {
            product_name: "Product B",
            quantity: 10,
            unit_price: 75,
            total_price: 750,
            sku: "SKU-B",
            confidence: 85,
          },
          {
            product_name: "Product C",
            quantity: 3,
            unit_price: 100,
            total_price: 300,
            sku: "SKU-C",
            confidence: 80,
          },
        ],
        total_amount: 1300,
        confidence_score: 85,
      };

      mockSafeRpc.mockResolvedValue({ data: mockResponse, error: null });

      const result = await receiptParsingService.analyzeReceiptInvoice(
        "base64data",
        "image/png"
      );

      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(3);
      expect(result.data?.total_amount).toBe(1300);
    });

    it("should handle receipt with missing optional fields", async () => {
      const mockResponse: ParsedReceiptData = {
        items: [
          {
            product_name: "Product Only",
            quantity: 5,
            confidence: 70,
          },
        ],
        confidence_score: 70,
      };

      mockSafeRpc.mockResolvedValue({ data: mockResponse, error: null });

      const result = await receiptParsingService.analyzeReceiptInvoice(
        "base64data",
        "image/png"
      );

      expect(result.success).toBe(true);
      expect(result.data?.items[0].product_name).toBe("Product Only");
      expect(result.data?.supplier_name).toBeUndefined();
    });

    it("should handle low confidence score", async () => {
      const mockResponse: ParsedReceiptData = {
        supplier_name: "Low Confidence Supplier",
        receipt_date: "2026-06-14",
        receipt_number: "INV-003",
        items: [
          {
            product_name: "Blurry Product",
            quantity: 5,
            confidence: 45,
          },
        ],
        total_amount: 500,
        confidence_score: 45,
        errors: ["Image quality is poor", "Some fields could not be read"],
      };

      mockSafeRpc.mockResolvedValue({ data: mockResponse, error: null });

      const result = await receiptParsingService.analyzeReceiptInvoice(
        "base64data",
        "image/png"
      );

      expect(result.success).toBe(true);
      expect(result.data?.confidence_score).toBeLessThan(50);
      expect(result.data?.errors).toBeDefined();
    });

    it("should handle empty items array", async () => {
      const mockResponse: ParsedReceiptData = {
        supplier_name: "Empty Invoice",
        receipt_date: "2026-06-14",
        receipt_number: "INV-004",
        items: [],
        confidence_score: 50,
        errors: ["No line items detected"],
      };

      mockSafeRpc.mockResolvedValue({ data: mockResponse, error: null });

      const result = await receiptParsingService.analyzeReceiptInvoice(
        "base64data",
        "image/png"
      );

      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(0);
      expect(result.data?.errors).toContain("No line items detected");
    });

    it("should pass correct MIME type to RPC", async () => {
      mockSafeRpc.mockResolvedValue({
        data: { items: [], confidence_score: 50 },
        error: null,
      });

      await receiptParsingService.analyzeReceiptInvoice(
        "base64data",
        "image/jpeg"
      );

      expect(mockSafeRpc).toHaveBeenCalledWith("analyze_receipt_invoice", {
        p_image_base64: "base64data",
        p_image_mime_type: "image/jpeg",
      });
    });

    it("should handle response with raw_text field", async () => {
      const mockResponse: ParsedReceiptData = {
        supplier_name: "Text Supplier",
        receipt_date: "2026-06-14",
        receipt_number: "INV-005",
        items: [
          {
            product_name: "Product",
            quantity: 1,
            confidence: 90,
          },
        ],
        confidence_score: 90,
        raw_text:
          "Supplier: Text Supplier\nDate: 2026-06-14\nProduct: Product\nQty: 1",
      };

      mockSafeRpc.mockResolvedValue({ data: mockResponse, error: null });

      const result = await receiptParsingService.analyzeReceiptInvoice(
        "base64data",
        "image/png"
      );

      expect(result.success).toBe(true);
      expect(result.data?.raw_text).toBeDefined();
    });

    it("should handle JSON response structure correctly", async () => {
      const mockResponse: AnalyzeReceiptInvoiceResponse = {
        success: true,
        data: {
          supplier_name: "Test",
          items: [],
          confidence_score: 80,
        },
      };

      mockSafeRpc.mockResolvedValue({ data: mockResponse.data, error: null });

      const result = await receiptParsingService.analyzeReceiptInvoice(
        "base64data",
        "image/png"
      );

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("data");
      expect(result).not.toHaveProperty("undefined");
    });

    it("should handle null data with error", async () => {
      mockSafeRpc.mockResolvedValue({
        data: null,
        error: { message: "Invalid image format" },
      });

      const result = await receiptParsingService.analyzeReceiptInvoice(
        "invalidBase64",
        "image/gif"
      );

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe("Invalid image format");
    });

    it("should handle large quantity values", async () => {
      const mockResponse: ParsedReceiptData = {
        supplier_name: "Bulk Supplier",
        receipt_date: "2026-06-14",
        receipt_number: "INV-006",
        items: [
          {
            product_name: "Bulk Product",
            quantity: 999999,
            unit_price: 0.01,
            total_price: 9999.99,
            confidence: 95,
          },
        ],
        total_amount: 9999.99,
        confidence_score: 95,
      };

      mockSafeRpc.mockResolvedValue({ data: mockResponse, error: null });

      const result = await receiptParsingService.analyzeReceiptInvoice(
        "base64data",
        "image/png"
      );

      expect(result.data?.items[0].quantity).toBe(999999);
      expect(result.data?.total_amount).toBe(9999.99);
    });

    it("should handle decimal pricing", async () => {
      const mockResponse: ParsedReceiptData = {
        supplier_name: "Decimal Supplier",
        receipt_date: "2026-06-14",
        receipt_number: "INV-007",
        items: [
          {
            product_name: "Decimal Product",
            quantity: 1.5,
            unit_price: 99.99,
            total_price: 149.985,
            confidence: 92,
          },
        ],
        total_amount: 149.985,
        confidence_score: 92,
      };

      mockSafeRpc.mockResolvedValue({ data: mockResponse, error: null });

      const result = await receiptParsingService.analyzeReceiptInvoice(
        "base64data",
        "image/png"
      );

      expect(result.data?.items[0].unit_price).toBe(99.99);
      expect(result.data?.items[0].total_price).toBe(149.985);
    });

    it("should handle error message without throwing", async () => {
      mockSafeRpc.mockResolvedValue({
        data: null,
        error: { message: "Network timeout" },
      });

      const result = await receiptParsingService.analyzeReceiptInvoice(
        "base64data",
        "image/png"
      );

      expect(() => {
        expect(result.error).toBe("Network timeout");
      }).not.toThrow();
    });
  });
});
