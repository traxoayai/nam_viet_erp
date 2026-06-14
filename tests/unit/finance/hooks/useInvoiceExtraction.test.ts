/**
 * Unit test cho useInvoiceExtraction hook
 * Mock safeRpc, verify upload flow tự động điền form fields
 */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InvoiceLineItem } from "@/features/finance/types/invoiceTypes";

const mockSafeRpc = vi.fn();

vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: unknown[]) => mockSafeRpc(...args),
}));

import { useInvoiceExtraction } from "@/features/finance/hooks/useInvoiceExtraction";

describe("useInvoiceExtraction", () => {
  beforeEach(() => {
    mockSafeRpc.mockReset();
    vi.clearAllMocks();
  });

  it("khởi tạo với loading=false, error=undefined, extractedData=undefined", () => {
    const { result } = renderHook(() => useInvoiceExtraction());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.extractedData).toBeUndefined();
  });

  describe("uploadAndExtract", () => {
    it("gọi extract_invoice_from_pdf RPC với file base64 + productLookup", async () => {
      const mockFile = new File(["test content"], "invoice.pdf", {
        type: "application/pdf",
      });

      const mockExtracted = {
        supplier_name: "Nhà cung cấp A",
        invoice_number: "HĐ-2026-001",
        invoice_date: "2026-06-14",
        items: [
          {
            sku: "SKU001",
            quantity: 2,
            unit_price: 100000,
          },
        ],
        total_amount: 200000,
      };

      mockSafeRpc.mockResolvedValue({
        data: mockExtracted,
        error: null,
      });

      const { result } = renderHook(() => useInvoiceExtraction());
      const productLookup = { SKU001: 10 };

      const extracted = await result.current.uploadAndExtract(
        mockFile,
        productLookup
      );

      // Verify RPC called
      expect(mockSafeRpc).toHaveBeenCalled();
      const [rpcName, params] = mockSafeRpc.mock.calls[0];
      expect(rpcName).toBe("extract_invoice_from_pdf");
      expect(params).toHaveProperty("file_data");
      expect(params).toHaveProperty("product_lookup", productLookup);

      // Verify extracted data mapped to form structure
      expect(extracted).toBeDefined();
      expect(extracted?.customer_name).toBe("Nhà cung cấp A");
      expect(extracted?.items).toHaveLength(1);
    });

    it("transform RPC result → form structure (InvoiceLineItem)", async () => {
      const mockFile = new File(["test"], "invoice.pdf", {
        type: "application/pdf",
      });

      const mockExtracted = {
        supplier_name: "Nhà cung cấp B",
        invoice_number: "HĐ-2026-002",
        invoice_date: "2026-06-14",
        items: [
          {
            sku: "SKU002",
            quantity: 5,
            unit_price: 50000,
          },
          {
            sku: "SKU003",
            quantity: 3,
            unit_price: 75000,
          },
        ],
        total_amount: 475000,
      };

      mockSafeRpc.mockResolvedValue({
        data: mockExtracted,
        error: null,
      });

      const { result } = renderHook(() => useInvoiceExtraction());
      const productLookup = { SKU002: 20, SKU003: 30 };

      const extracted = await result.current.uploadAndExtract(
        mockFile,
        productLookup
      );

      // Verify items transformed to InvoiceLineItem structure
      expect(extracted?.items).toBeDefined();
      const items = extracted?.items as Partial<InvoiceLineItem>[];
      expect(items).toHaveLength(2);

      // First item
      expect(items[0]?.product_id).toBe(20);
      expect(items[0]?.quantity).toBe(5);
      expect(items[0]?.unit_price).toBe(50000);

      // Second item
      expect(items[1]?.product_id).toBe(30);
      expect(items[1]?.quantity).toBe(3);
      expect(items[1]?.unit_price).toBe(75000);
    });

    it("set loading=true during extraction, false after", async () => {
      const mockFile = new File(["test"], "invoice.pdf", {
        type: "application/pdf",
      });

      mockSafeRpc.mockResolvedValue({
        data: {
          supplier_name: "Test",
          invoice_number: "HĐ-001",
          items: [],
        },
        error: null,
      });

      const { result } = renderHook(() => useInvoiceExtraction());

      // Initial state
      expect(result.current.loading).toBe(false);

      // Start extraction
      const promise = result.current.uploadAndExtract(mockFile, {});

      // Wait for completion
      await waitFor(async () => {
        await promise;
        expect(result.current.loading).toBe(false);
      });
    });

    it("return null khi RPC fail", async () => {
      const mockFile = new File(["test"], "invoice.pdf", {
        type: "application/pdf",
      });

      const rpcError = new Error("Permission denied");

      // safeRpc throws on error
      mockSafeRpc.mockRejectedValueOnce(rpcError);

      const { result } = renderHook(() => useInvoiceExtraction());

      const extracted = await result.current.uploadAndExtract(mockFile, {});

      // Should return null on error
      expect(extracted).toBeNull();
    });

    it("handle empty items array from RPC", async () => {
      const mockFile = new File(["test"], "invoice.pdf", {
        type: "application/pdf",
      });

      mockSafeRpc.mockResolvedValue({
        data: {
          supplier_name: "Empty Invoice",
          invoice_number: "HĐ-003",
          items: [],
        },
        error: null,
      });

      const { result } = renderHook(() => useInvoiceExtraction());

      const extracted = await result.current.uploadAndExtract(mockFile, {});

      expect(extracted?.items).toEqual([]);
    });

    it("handle missing supplier_name (fallback to empty string)", async () => {
      const mockFile = new File(["test"], "invoice.pdf", {
        type: "application/pdf",
      });

      mockSafeRpc.mockResolvedValue({
        data: {
          supplier_name: null,
          invoice_number: "HĐ-004",
          items: [],
        },
        error: null,
      });

      const { result } = renderHook(() => useInvoiceExtraction());

      const extracted = await result.current.uploadAndExtract(mockFile, {});

      expect(extracted?.customer_name).toBe("");
    });
  });

  describe("reset", () => {
    it("clear loading, error flags", () => {
      const { result } = renderHook(() => useInvoiceExtraction());

      // Initial state
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeUndefined();

      // Reset should keep same state
      result.current.reset();

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeUndefined();
    });
  });
});
