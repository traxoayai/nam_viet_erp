// src/stores/productStore.ts
import { create } from "zustand";

import { getProducts } from "@/services/productService";
import { getSuppliers } from "@/services/supplierService"; // Mới
import { getWarehouses } from "@/services/warehouseService";
import { ProductStoreState, type ProductFilters } from "@/types/product";

export const useProductStore = create<ProductStoreState>((set, get) => ({
  products: [],
  warehouses: [],
  suppliers: [], // Mới
  loading: false,
  filters: {},
  page: 1,
  pageSize: 10,
  totalCount: 0,

  fetchProducts: async () => {
    set({ loading: true });
    try {
      const { filters, page, pageSize } = get();
      const { data, totalCount } = await getProducts({
        filters,
        page,
        pageSize,
      });
      set({ products: data, totalCount: totalCount, loading: false });
    } catch (error) {
      console.error("Lỗi khi tải sản phẩm:", error);
      set({ loading: false });
    }
  },

  // Đổi tên hàm
  fetchCommonData: async () => {
    try {
      // Tải song song 2 API (Kho và NCC)
      const [warehousesData, suppliersData] = await Promise.all([
        getWarehouses(),
        getSuppliers(),
      ]);
      set({
        warehouses: warehousesData,
        suppliers: suppliersData,
      });
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu chung:", error);
    }
  },

  setFilters: (newFilters: Partial<ProductFilters>) => {
    const filters = { ...get().filters, ...newFilters };
    set({ filters, page: 1 });
    get().fetchProducts();
  },

  setPage: (page: number, pageSize: number) => {
    set({ page, pageSize });
    get().fetchProducts();
  },
}));
