// src/features/inventory/stores/useInboundStore.ts
import { create } from "zustand";
import { inboundService } from "../api/inboundService";
import { InboundTask, InboundFilter, InboundDetailResponse, InboundDetailItem } from "../types/inbound";

interface InboundState {
  // List State
  tasks: InboundTask[];
  totalCount: number;
  loading: boolean;
  filters: InboundFilter;
  error: string | null; // Added Error State
  
  // Detail State
  detail: InboundDetailResponse | null;
  workingItems: InboundDetailItem[]; 
  
  // Actions
  setFilters: (filters: Partial<InboundFilter>) => void;
  setPage: (page: number, pageSize: number) => void;
  
  fetchTasks: () => Promise<void>;
  fetchDetail: (poId: number) => Promise<void>;
  
  // Inputs
  updateWorkingItem: (productId: number, changes: Partial<InboundDetailItem>) => void;
  
  submitReceipt: (poId: number, warehouseId: number) => Promise<void>;
  resetDetail: () => void;
}

export const useInboundStore = create<InboundState>((set, get) => ({
  // Initial State
  tasks: [],
  totalCount: 0,
  loading: false,
  error: null,
  filters: {
    page: 1,
    pageSize: 10,
    status: 'all'
  },
  
  detail: null,
  workingItems: [],

  // Actions
  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters, page: 1 }, 
    }));
    get().fetchTasks();
  },

  setPage: (page, pageSize) => {
    set((state) => ({
      filters: { ...state.filters, page, pageSize },
    }));
    get().fetchTasks();
  },

  fetchTasks: async () => {
    set({ loading: true, error: null });
    try {
      const { filters } = get();
      const { data, total } = await inboundService.getInboundTasks(filters);
      set({ tasks: data, totalCount: total, loading: false });
    } catch (error: any) {
      console.error("Failed to fetch inbound tasks", error);
      set({ loading: false, tasks: [], error: error.message || "Lỗi tải danh sách" });
    }
  },

  fetchDetail: async (poId: number) => {
    set({ loading: true, error: null, detail: null });
    
    // Debug Log
    console.log("Fetching Inbound Detail for PO:", poId);

    try {
      const data = await inboundService.getInboundDetail(poId);
      
      console.log("Inbound Detail Data:", data);

      if (!data || !data.po_info) {
          throw new Error("Dữ liệu phiếu nhập không tồn tại hoặc bị lỗi cấu trúc.");
      }
      
      const workingItems = (data.items || []).map(item => ({
          ...item,
          input_quantity: item.quantity_remaining > 0 ? item.quantity_remaining : 0,
          input_lot: '',
          input_expiry: ''
      }));

      set({ detail: data, workingItems, loading: false });
    } catch (error: any) {
      console.error("Failed to fetch inbound detail", error);
      set({ loading: false, detail: null, workingItems: [], error: error.message || "Lỗi tải chi tiết phiếu nhập" });
    }
  },

  updateWorkingItem: (productId, changes) => {
    set((state) => ({
      workingItems: state.workingItems.map(item => 
        item.product_id === productId ? { ...item, ...changes } : item
      )
    }));
  },

  submitReceipt: async (poId, warehouseId) => {
    const { workingItems } = get();
    set({ error: null });
    
    const itemsToProcess = workingItems
       .filter(item => (item.input_quantity || 0) > 0)
       .map(item => ({
          product_id: item.product_id,
          quantity: item.input_quantity || 0,
          unit: item.unit, // [NEW] Gửi đơn vị để Backend xử lý quy đổi
          lot_number: item.input_lot,
          expiry_date: item.input_expiry
       }));

    if (itemsToProcess.length === 0) {
        throw new Error("Vui lòng nhập số lượng nhập cho ít nhất 1 sản phẩm");
    }

    try {
        await inboundService.submitReceipt({
            p_po_id: poId,
            p_warehouse_id: warehouseId,
            p_items: itemsToProcess
        });
        await get().fetchDetail(poId);
    } catch (error: any) {
        set({ error: error.message });
        throw error;
    }
  },

  resetDetail: () => {
      set({ detail: null, workingItems: [], error: null });
  }
}));
