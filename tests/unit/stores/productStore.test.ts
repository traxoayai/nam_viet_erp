import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---
const mockSafeRpc = vi.fn();
vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));

vi.mock("@/features/inventory/api/warehouseService", () => ({
  getWarehouses: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock("@/features/purchasing/api/supplierService", () => ({
  getSuppliers: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/features/product/api/productService", () => ({
  getProducts: vi.fn().mockResolvedValue({ data: [], totalCount: 0 }),
  getProductDetails: vi.fn().mockResolvedValue(null),
  updateProduct: vi.fn().mockResolvedValue(null),
  addProduct: vi.fn().mockResolvedValue(null),
  updateProductsStatus: vi.fn().mockResolvedValue(null),
  deleteProducts: vi.fn().mockResolvedValue(null),
  checkDependencies: vi.fn().mockResolvedValue([]),
  exportProducts: vi.fn().mockResolvedValue([]),
}));

// --- Import store AFTER mocks ---
import { useProductStore } from "@/features/product/stores/productStore";

describe("useProductStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProductStore.setState({
      products: [],
      warehouses: [],
      suppliers: [],
      uniqueCategories: [],
      uniqueManufacturers: [],
      loading: false,
      loadingDetails: false,
      currentProduct: null,
      filters: {},
      page: 1,
      pageSize: 10,
      totalCount: 0,
    });
  });

  describe("fetchClassifications", () => {
    it("calls safeRpc with 'get_distinct_categories'", async () => {
      mockSafeRpc.mockResolvedValue({ data: [] });

      await useProductStore.getState().fetchClassifications();

      expect(mockSafeRpc).toHaveBeenCalledWith("get_distinct_categories");
    });

    it("calls safeRpc with 'get_distinct_manufacturers'", async () => {
      mockSafeRpc.mockResolvedValue({ data: [] });

      await useProductStore.getState().fetchClassifications();

      expect(mockSafeRpc).toHaveBeenCalledWith("get_distinct_manufacturers");
    });

    it("calls both RPCs in parallel", async () => {
      mockSafeRpc.mockResolvedValue({ data: [] });

      await useProductStore.getState().fetchClassifications();

      // Both should be called (order may vary due to Promise.all)
      const rpcNames = mockSafeRpc.mock.calls.map((call: any[]) => call[0]);
      expect(rpcNames).toContain("get_distinct_categories");
      expect(rpcNames).toContain("get_distinct_manufacturers");
      expect(mockSafeRpc).toHaveBeenCalledTimes(2);
    });

    it("updates uniqueCategories from RPC data", async () => {
      mockSafeRpc.mockImplementation((fnName: string) => {
        if (fnName === "get_distinct_categories") {
          return Promise.resolve({
            data: [
              { category_name: "Thuoc" },
              { category_name: "Thuc pham chuc nang" },
            ],
          });
        }
        return Promise.resolve({ data: [] });
      });

      await useProductStore.getState().fetchClassifications();

      const state = useProductStore.getState();
      expect(state.uniqueCategories).toEqual(["Thuoc", "Thuc pham chuc nang"]);
    });

    it("updates uniqueManufacturers from RPC data", async () => {
      mockSafeRpc.mockImplementation((fnName: string) => {
        if (fnName === "get_distinct_manufacturers") {
          return Promise.resolve({
            data: [
              { manufacturer_name: "Hang A" },
              { manufacturer_name: "Hang B" },
            ],
          });
        }
        return Promise.resolve({ data: [] });
      });

      await useProductStore.getState().fetchClassifications();

      const state = useProductStore.getState();
      expect(state.uniqueManufacturers).toEqual(["Hang A", "Hang B"]);
    });

    it("handles null data gracefully", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });

      await useProductStore.getState().fetchClassifications();

      const state = useProductStore.getState();
      expect(state.uniqueCategories).toEqual([]);
      expect(state.uniqueManufacturers).toEqual([]);
    });
  });
});
