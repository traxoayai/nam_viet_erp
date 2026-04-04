import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSafeRpc = vi.fn();

vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));
vi.mock("@/shared/api/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));
vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: {}, error: null }),
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
          }),
        }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      update: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ error: null }),
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "http://img.jpg" } }),
      }),
    },
  },
}));
vi.mock("uuid", () => ({ v4: () => "mock-uuid" }));
vi.mock("xlsx", () => ({
  read: vi.fn(),
  utils: { sheet_to_json: vi.fn() },
}));

import {
  getProducts,
  upsertProduct,
  checkDependencies,
  exportProducts,
  searchProductsForPurchase,
  searchProductsForTransfer,
} from "@/features/product/api/productService";

describe("productService", () => {
  beforeEach(() => {
    mockSafeRpc.mockReset();
  });

  // --- getProducts ---
  describe("getProducts", () => {
    it("calls search_products_v2 with mapped filters", async () => {
      mockSafeRpc.mockResolvedValue({ data: { data: [{ id: 1 }], total_count: 15 } });
      const result = await getProducts({
        filters: { search_query: "Panadol", category_filter: "Thuoc", manufacturer_filter: "GSK", status_filter: "active" },
        page: 2,
        pageSize: 10,
      });
      expect(mockSafeRpc).toHaveBeenCalledWith("search_products_v2", {
        p_keyword: "Panadol",
        p_category: "Thuoc",
        p_manufacturer: "GSK",
        p_status: "active",
        p_limit: 10,
        p_offset: 10, // (2-1)*10
      });
      expect(result).toEqual({ data: [{ id: 1 }], totalCount: 15 });
    });

    it("passes undefined for empty filter fields", async () => {
      mockSafeRpc.mockResolvedValue({ data: { data: [], total_count: 0 } });
      await getProducts({ filters: {}, page: 1, pageSize: 20 });
      expect(mockSafeRpc).toHaveBeenCalledWith("search_products_v2", {
        p_keyword: undefined,
        p_category: undefined,
        p_manufacturer: undefined,
        p_status: undefined,
        p_limit: 20,
        p_offset: 0,
      });
    });

    it("returns defaults when data is null", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await getProducts({ filters: {}, page: 1, pageSize: 20 });
      expect(result).toEqual({ data: [], totalCount: 0 });
    });
  });

  // --- upsertProduct ---
  describe("upsertProduct", () => {
    it("calls upsert_product_with_units with structured payload", async () => {
      mockSafeRpc.mockResolvedValue({ data: { id: 55 } });
      const result = await upsertProduct({
        id: 55,
        sku: "SKU-001",
        productName: "Test Product",
        manufacturer: "MFG",
        category: "Cat",
        status: "active",
        actualCost: 10000,
        units: [{ id: 1, unit_name: "Vien", unit_type: "base", conversion_rate: 1, price: 10000, barcode: null, is_base: true, is_direct_sale: true }],
        content: { description_html: "<p>Test</p>" },
        inventorySettings: [],
      });
      expect(mockSafeRpc).toHaveBeenCalledWith("upsert_product_with_units", {
        p_product_json: expect.objectContaining({ id: 55, sku: "SKU-001", name: "Test Product" }),
        p_units_json: expect.arrayContaining([expect.objectContaining({ unit_name: "Vien", is_base: true })]),
        p_contents_json: expect.objectContaining({ description_html: "<p>Test</p>" }),
        p_inventory_json: [],
      });
      expect(result).toEqual({ id: 55 });
    });
  });

  // --- checkDependencies ---
  describe("checkDependencies", () => {
    it("calls check_product_dependencies with product ids", async () => {
      mockSafeRpc.mockResolvedValue({ data: [{ product_id: 1, has_orders: true }] });
      const result = await checkDependencies([1, 2, 3]);
      expect(mockSafeRpc).toHaveBeenCalledWith("check_product_dependencies", {
        p_product_ids: [1, 2, 3],
      });
      expect(result).toEqual([{ product_id: 1, has_orders: true }]);
    });

    it("returns empty array when data is null", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await checkDependencies([1]);
      expect(result).toEqual([]);
    });
  });

  // --- exportProducts ---
  describe("exportProducts", () => {
    it("calls export_products_list with filters", async () => {
      mockSafeRpc.mockResolvedValue({ data: [{ id: 1, name: "P1" }] });
      const result = await exportProducts({
        search_query: "test",
        category_filter: "Thuoc",
        manufacturer_filter: null,
        status_filter: "active",
      });
      expect(mockSafeRpc).toHaveBeenCalledWith("export_products_list", {
        search_query: "test",
        category_filter: "Thuoc",
        manufacturer_filter: "",
        status_filter: "active",
      });
      expect(result).toEqual([{ id: 1, name: "P1" }]);
    });

    it("returns empty array when data is null", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await exportProducts({});
      expect(result).toEqual([]);
    });
  });

  // --- searchProductsForPurchase ---
  describe("searchProductsForPurchase", () => {
    it("calls search_products_for_purchase and maps response", async () => {
      mockSafeRpc.mockResolvedValue({
        data: [{
          id: 1, name: "Panadol", sku: "PAN-01", actual_cost: 5000,
          image_url: "img.jpg", items_per_carton: 100,
          wholesale_unit: "Hop", retail_unit: "Vien",
          latest_purchase_price: 4500,
        }],
      });
      const result = await searchProductsForPurchase("Pan");
      expect(mockSafeRpc).toHaveBeenCalledWith("search_products_for_purchase", { p_keyword: "Pan" });
      expect(result[0]).toMatchObject({
        id: 1, name: "Panadol", sku: "PAN-01", type: "product",
        unit: "Hop", price: 5000, last_price: 4500,
      });
    });
  });

  // --- searchProductsForTransfer ---
  describe("searchProductsForTransfer", () => {
    it("calls search_products_for_transfer with warehouse and keyword", async () => {
      mockSafeRpc.mockResolvedValue({ data: [{ id: 1, stock: 50 }] });
      const result = await searchProductsForTransfer("Pan", 2);
      expect(mockSafeRpc).toHaveBeenCalledWith("search_products_for_transfer", {
        p_warehouse_id: 2,
        p_keyword: "Pan",
        p_limit: 20,
      });
      expect(result).toEqual([{ id: 1, stock: 50 }]);
    });

    it("returns empty array when data is null", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await searchProductsForTransfer("test", 1);
      expect(result).toEqual([]);
    });
  });
});
