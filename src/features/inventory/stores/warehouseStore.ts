// src/stores/warehouseStore.ts
import { create } from "zustand";

import * as warehouseService from "@/features/inventory/api/warehouseService";
import {
  WarehouseStoreState,
  WarehouseFilters,
} from "@/features/inventory/types/warehouse";

export const useWarehouseStore = create<WarehouseStoreState>((set, get) => ({
  warehouses: [],
  loading: false,
  filters: {},
  page: 1,
  pageSize: 10,
  totalCount: 0,

  fetchWarehouses: async () => {
    set({ loading: true });
    try {
      const { filters, page, pageSize } = get();
      const { data, totalCount } = await warehouseService.getWarehouses(
        filters,
        page,
        pageSize
      );
      set({ warehouses: data, totalCount, loading: false });
    } catch (error) {
      console.error("Lỗi khi tải Kho:", error);
      set({ loading: false });
    }
  },

  setFilters: (newFilters: Partial<WarehouseFilters>) => {
    set((state) => ({ filters: { ...state.filters, ...newFilters }, page: 1 }));
    get().fetchWarehouses();
  },

  setPage: (page: number, pageSize: number) => {
    set({ page, pageSize });
    get().fetchWarehouses();
  },

  addWarehouse: async (values: any) => {
    set({ loading: true });
    try {
      await warehouseService.addWarehouse(values);
      await get().fetchWarehouses(); // Tải lại
      return true;
    } catch (error) {
      console.error("Lỗi khi thêm Kho:", error);
      set({ loading: false });
      return false;
    }
  },

  updateWarehouse: async (id: number, values: any) => {
    set({ loading: true });
    try {
      await warehouseService.updateWarehouse(id, values);
      await get().fetchWarehouses(); // Tải lại
      return true;
    } catch (error) {
      console.error("Lỗi khi cập nhật Kho:", error);
      set({ loading: false });
      return false;
    }
  },

  deleteWarehouse: async (id: number) => {
    set({ loading: true });
    try {
      await warehouseService.deleteWarehouse(id);
      await get().fetchWarehouses(); // Tải lại
      return true;
    } catch (error) {
      console.error("Lỗi khi xóa Kho:", error);
      set({ loading: false });
      return false;
    }
  },
}));
