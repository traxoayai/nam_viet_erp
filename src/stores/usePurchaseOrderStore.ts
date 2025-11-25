import { message } from "antd";
import { create } from "zustand";

import { purchaseOrderService } from "@/services/purchaseOrderService";
import { PurchaseOrderMaster, PurchaseOrderFilters } from "@/types/purchase";

interface StoreState {
  orders: PurchaseOrderMaster[];
  loading: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  filters: PurchaseOrderFilters;

  fetchOrders: () => Promise<void>;
  setFilters: (newFilters: Partial<PurchaseOrderFilters>) => void;
  setPage: (page: number, pageSize: number) => void;
  deleteOrder: (id: number) => Promise<void>;
}

export const usePurchaseOrderStore = create<StoreState>((set, get) => ({
  orders: [],
  loading: false,
  totalCount: 0,
  page: 1,
  pageSize: 10,
  filters: {},

  fetchOrders: async () => {
    set({ loading: true });
    try {
      const { filters, page, pageSize } = get();
      const { data, totalCount } = await purchaseOrderService.getPOs(
        filters,
        page,
        pageSize
      );

      // Map key cho Table
      const mappedData = data.map((item) => ({
        ...item,
        key: item.id.toString(),
      }));
      set({ orders: mappedData, totalCount, loading: false });
    } catch (error) {
      console.error(error);
      set({ loading: false });
    }
  },

  setFilters: (newFilters) => {
    set((state) => ({ filters: { ...state.filters, ...newFilters }, page: 1 }));
    get().fetchOrders();
  },

  setPage: (page, pageSize) => {
    set({ page, pageSize });
    get().fetchOrders();
  },

  deleteOrder: async (id) => {
    try {
      await purchaseOrderService.deletePO(id);
      message.success("Đã hủy đơn hàng");
      get().fetchOrders();
    } catch (error: any) {
      message.error(error.message || "Hủy thất bại");
    }
  },

  autoCreateOrders: async (type: "MIN_MAX" | "AI") => {
    set({ loading: true });
    try {
      if (type === "MIN_MAX") {
        const count = await purchaseOrderService.autoCreateMinMax();
        message.success(`Đã tạo tự động ${count} đơn hàng dự trù cho kho B2B!`);
      } else {
        message.info("Tính năng AI đang phát triển...");
      }
      get().fetchOrders();
    } catch (error: any) {
      message.error(`Lỗi: ${error.message}`);
    } finally {
      set({ loading: false });
    }
  },
}));
