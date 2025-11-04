// src/stores/productStore.ts
import { create } from "zustand";

import { getCategories } from "@/services/categoryService";
import { getManufacturers } from "@/services/manufacturerService";
import { getProducts } from "@/services/productService";
import { getWarehouses } from "@/services/warehouseService";
import { ProductStoreState, type ProductFilters } from "@/types/product";

export const useProductStore = create<ProductStoreState>((set, get) => ({
  // Dữ liệu
  products: [],
  categories: [],
  manufacturers: [],
  warehouses: [],
  loading: false,

  // Lọc & Phân trang
  filters: {},
  page: 1,
  pageSize: 10,
  totalCount: 0,

  // Hành động
  fetchProducts: async () => {
    set({ loading: true });
    try {
      const { filters, page, pageSize } = get();
      const { data, totalCount } = await getProducts({
        filters,
        page,
        pageSize,
      });

      set({
        products: data,
        totalCount: totalCount,
        loading: false,
      });
    } catch (error) {
      console.error("Lỗi khi tải sản phẩm:", error);
      set({ loading: false });
      // Sếp có thể dùng 'message' ở đây để báo lỗi
    }
  },

  fetchFiltersData: async () => {
    // Tải song song 3 API
    try {
      const [categoriesData, manufacturersData, warehousesData] =
        await Promise.all([
          getCategories(),
          getManufacturers(),
          getWarehouses(), // <-- THÊM HÀNH ĐỘNG NÀY
        ]);
      set({
        categories: categoriesData,
        manufacturers: manufacturersData,
        warehouses: warehousesData, // <-- LƯU VÀO KHO
      });
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu lọc:", error);
    }
  },

  setFilters: (newFilters: Partial<ProductFilters>) => {
    const filters = { ...get().filters, ...newFilters };
    set({ filters, page: 1 }); // Reset về trang 1 khi lọc
    get().fetchProducts(); // Tự động gọi API
  },

  setPage: (page: number, pageSize: number) => {
    set({ page, pageSize });
    get().fetchProducts(); // Tự động gọi API
  },
}));
