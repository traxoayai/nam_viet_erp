// Unit test cho synonymApi (Gap 1 Chatbot P2.5).
// Mock safeRpc, verify mỗi function gọi đúng RPC name + params.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSafeRpc = vi.fn();

vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: unknown[]) => mockSafeRpc(...args),
}));

import {
  addProductSynonym,
  bulkImportSynonyms,
  deleteProductSynonym,
  listProductSynonyms,
  searchProductsForSynonym,
} from "@/features/chatbot/api/synonymApi";

describe("synonymApi unit", () => {
  beforeEach(() => {
    mockSafeRpc.mockReset();
  });

  it("listProductSynonyms gọi list_product_synonyms với p_product_id", async () => {
    mockSafeRpc.mockResolvedValue({ data: [], error: null });
    const result = await listProductSynonyms(42);
    expect(mockSafeRpc).toHaveBeenCalledWith("list_product_synonyms", {
      p_product_id: 42,
    });
    expect(result).toEqual([]);
  });

  it("addProductSynonym truyền default weight=1.0 khi không có", async () => {
    mockSafeRpc.mockResolvedValue({ data: 99, error: null });
    const id = await addProductSynonym(5, "xa20");
    expect(mockSafeRpc).toHaveBeenCalledWith("add_product_synonym", {
      p_product_id: 5,
      p_synonym: "xa20",
      p_weight: 1.0,
    });
    expect(id).toBe(99);
  });

  it("addProductSynonym truyền weight custom", async () => {
    mockSafeRpc.mockResolvedValue({ data: 100, error: null });
    await addProductSynonym(5, "xarelto20", 2.5);
    expect(mockSafeRpc).toHaveBeenCalledWith("add_product_synonym", {
      p_product_id: 5,
      p_synonym: "xarelto20",
      p_weight: 2.5,
    });
  });

  it("addProductSynonym throw khi safeRpc trả error", async () => {
    const fakeErr = { code: "42501", message: "denied" };
    mockSafeRpc.mockResolvedValue({ data: null, error: fakeErr });
    await expect(addProductSynonym(1, "xx")).rejects.toBe(fakeErr);
  });

  it("deleteProductSynonym gọi đúng p_id", async () => {
    mockSafeRpc.mockResolvedValue({ data: null, error: null });
    await deleteProductSynonym(7);
    expect(mockSafeRpc).toHaveBeenCalledWith("delete_product_synonym", {
      p_id: 7,
    });
  });

  it("searchProductsForSynonym dùng default limit=20", async () => {
    mockSafeRpc.mockResolvedValue({ data: [], error: null });
    await searchProductsForSynonym("xarelto");
    expect(mockSafeRpc).toHaveBeenCalledWith(
      "search_products_for_synonym_admin",
      {
        p_query: "xarelto",
        p_limit: 20,
      }
    );
  });

  it("bulkImportSynonyms forward p_rows + trả result", async () => {
    const fakeRes = { inserted: 2, skipped: 1, errors: [] };
    mockSafeRpc.mockResolvedValue({ data: fakeRes, error: null });
    const rows = [
      { sku: "A", synonym: "alpha" },
      { sku: "B", synonym: "beta", weight: 2 },
    ];
    const out = await bulkImportSynonyms(rows);
    expect(mockSafeRpc).toHaveBeenCalledWith("bulk_import_synonyms", {
      p_rows: rows,
    });
    expect(out).toEqual(fakeRes);
  });
});
