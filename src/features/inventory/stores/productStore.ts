// src/stores/productStore.ts
import { create } from "zustand";

import { supabase } from "@/shared/lib/supabaseClient"; // <-- MỚI: Import để gọi RPC
import * as productService from "@/features/inventory/api/productService";
import * as supplierService from "@/features/purchasing/api/supplierService";
import * as warehouseService from "@/features/inventory/api/warehouseService";
import {
  ProductStoreState,
  ProductFilters,
} from "@/features/inventory/types/product";

export const useProductStore = create<ProductStoreState>((set, get) => ({
  // Dữ liệu
  products: [],
  warehouses: [],
  suppliers: [],

  // --- MỚI: Khởi tạo rỗng ---
  uniqueCategories: [],
  uniqueManufacturers: [],
  // -------------------------

  // Trạng thái
  loading: false,
  loadingDetails: false,
  currentProduct: null,

  // Lọc & Phân trang
  filters: {},
  page: 1,
  pageSize: 10,
  totalCount: 0,

  // --- HÀNH ĐỘNG ĐỌC DỮ LIỆU ---

  fetchProducts: async () => {
    set({ loading: true });
    try {
      const { filters, page, pageSize } = get();
      const { data, totalCount } = await productService.getProducts({
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
    }
  },

  fetchCommonData: async () => {
    if (get().warehouses.length > 0) return;
    try {
      const defaultPage = 1;
      const largePageSize = 99999;
      const defaultFilters = {};

      const [warehousesResult, suppliersResult] = await Promise.all([
        warehouseService.getWarehouses(
          defaultFilters,
          defaultPage,
          largePageSize
        ),
        supplierService.getSuppliers(),
      ]);

      set({
        warehouses: warehousesResult.data,
        suppliers: suppliersResult,
      });
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu chung (kho, ncc):", error);
      set({ warehouses: [], suppliers: [] });
    }
  },

  // --- HÀM MỚI: Gọi RPC để lấy danh sách Nhóm & Hãng ---
  fetchClassifications: async () => {
    try {
      const [catRes, manRes] = await Promise.all([
        supabase.rpc("get_distinct_categories"),
        supabase.rpc("get_distinct_manufacturers"),
      ]);

      if (catRes.error) throw catRes.error;
      if (manRes.error) throw manRes.error;

      set({
        uniqueCategories: (catRes.data || []).map((i: any) => i.category_name),
        uniqueManufacturers: (manRes.data || []).map(
          (i: any) => i.manufacturer_name
        ),
      });
    } catch (error) {
      console.error("Lỗi tải phân loại:", error);
    }
  },
  // -----------------------------------------------------

  getProductDetails: async (id: number) => {
    set({ loadingDetails: true, currentProduct: null });
    try {
      const data = await productService.getProductDetails(id);
      set({ currentProduct: data, loadingDetails: false });
    } catch (error) {
      console.error("Lỗi tải chi tiết sản phẩm:", error);
      set({ loadingDetails: false });
    }
  },

  // --- HÀNH ĐỘNG CẬP NHẬT DỮ LIỆU ---

  updateProduct: async (id: number, data: any) => {
    set({ loading: true });
    await productService.updateProduct(id, data);
    await get().fetchProducts();
    set({ loading: false });
  },

  addProduct: async (data: any) => {
    set({ loading: true });
    await productService.addProduct(data);
    await get().fetchProducts();
    set({ loading: false });
  },

  updateStatus: async (ids: React.Key[], status: "active" | "inactive") => {
    set({ loading: true });
    await productService.updateProductsStatus(ids, status);
    await get().fetchProducts();
    set({ loading: false });
  },

  deleteProducts: async (ids: React.Key[]) => {
    set({ loading: true });
    await productService.deleteProducts(ids);
    await get().fetchProducts();
    set({ loading: false });
  },

  exportToExcel: async () => {
    set({ loading: true });
    const filters = get().filters;
    const data = await productService.exportProducts(filters);
    set({ loading: false });
    return data;
  },

  // --- HÀNH ĐỘNG CỤC BỘ ---
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
