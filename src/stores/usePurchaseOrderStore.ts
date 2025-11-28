import { create } from "zustand";

import { purchaseOrderService } from "@/services/purchaseOrderService";
import { PurchaseOrderMaster, PurchaseOrderFilters } from "@/types/purchase";

interface PurchaseOrderState {
  orders: PurchaseOrderMaster[];
  loading: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  filters: PurchaseOrderFilters;

  fetchOrders: () => Promise<void>;
  setFilters: (filters: Partial<PurchaseOrderFilters>) => void;
  setPage: (page: number, pageSize?: number) => void;
  deleteOrder: (id: number) => Promise<void>;
  autoCreateOrders: (type: string) => Promise<void>;
}

export const usePurchaseOrderStore = create<PurchaseOrderState>((set, get) => ({
  orders: [],
  loading: false,
  totalCount: 0,
  page: 1,
  pageSize: 10,
  filters: {},

  fetchOrders: async () => {
    set({ loading: true });
    const { page, pageSize, filters } = get();
    try {
      // FIX: Gọi đúng thứ tự tham số của service.getPOs(filters, page, pageSize)
      // (Dựa theo file service mới nhất Sếp đang dùng)
      const { data, totalCount } = await purchaseOrderService.getPOs(
        filters,
        page,
        pageSize
      );

      set({ orders: data, totalCount, loading: false });
    } catch (error) {
      console.error("Error fetching orders:", error);
      set({ loading: false });
    }
  },

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
      page: 1, // Reset về trang 1 khi lọc
    }));
    get().fetchOrders();
  },

  setPage: (page, pageSize) => {
    set({ page, pageSize: pageSize || get().pageSize });
    get().fetchOrders();
  },

  deleteOrder: async (id) => {
    try {
      await purchaseOrderService.deletePO(id);
      get().fetchOrders();
    } catch (error) {
      console.error(error);
    }
  },

  autoCreateOrders: async (type) => {
    try {
      if (type === "MIN_MAX") {
        await purchaseOrderService.autoCreateMinMax();
        get().fetchOrders();
      }
    } catch (error) {
      console.error(error);
    }
  },
}));
