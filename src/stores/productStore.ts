// src/stores/productStore.ts
import { create } from "zustand";

import * as productService from "@/services/productService"; // Import tất cả
import * as supplierService from "@/services/supplierService";
import * as warehouseService from "@/services/warehouseService";
import { ProductStoreState, ProductFilters } from "@/types/product";

export const useProductStore = create<ProductStoreState>((set, get) => ({
  // Dữ liệu
  products: [],
  warehouses: [],
  suppliers: [],

  // Trạng thái
  loading: false,
  loadingDetails: false, // Thêm loading cho form
  currentProduct: null, // Thêm sản phẩm đang sửa

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
    try {
      const defaultPage = 1;
      const largePageSize = 99999;
      const defaultFilters = {}; // Tham số filters rỗng

      const [warehousesResult, suppliersResult] = await Promise.all([
        // SỬA LỖI (TS2554): Truyền 3 tham số riêng lẻ
        warehouseService.getWarehouses(
          defaultFilters, // 1. filters
          defaultPage, // 2. page
          largePageSize // 3. pageSize
        ),

        // Giữ nguyên: Gọi supplierService không có tham số
        supplierService.getSuppliers(),
      ]);

      set({
        // Giữ nguyên: Lấy .data từ kết quả của warehouse
        warehouses: warehousesResult.data,

        // Giữ nguyên: Lấy trực tiếp kết quả của supplier
        suppliers: suppliersResult,
      });
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu chung (kho, ncc):", error);
      set({ warehouses: [], suppliers: [] });
    }
  },

  // HÀM MỚI (CHO FORM SỬA)
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

  // HÀM MỚI (CHO FORM SỬA)
  updateProduct: async (id: number, data: any) => {
    set({ loading: true }); // Dùng loading chung
    await productService.updateProduct(id, data);
    await get().fetchProducts(); // Tải lại danh sách
    set({ loading: false });
  },

  // HÀM MỚI
  addProduct: async (data: any) => {
    set({ loading: true });
    await productService.addProduct(data);
    await get().fetchProducts(); // Tải lại danh sách
    set({ loading: false });
  },

  // HÀM MỚI (HÀNG LOẠT)
  updateStatus: async (ids: React.Key[], status: "active" | "inactive") => {
    set({ loading: true });
    await productService.updateProductsStatus(ids, status);
    await get().fetchProducts(); // Tải lại danh sách
    set({ loading: false });
  },

  // HÀM MỚI (HÀNG LOẠT)
  deleteProducts: async (ids: React.Key[]) => {
    set({ loading: true });
    await productService.deleteProducts(ids);
    await get().fetchProducts(); // Tải lại danh sách
    set({ loading: false });
  },

  // HÀM MỚI
  exportToExcel: async () => {
    set({ loading: true });
    const filters = get().filters;
    const data = await productService.exportProducts(filters);
    set({ loading: false });
    return data; // Trả data về cho UI xử lý
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
