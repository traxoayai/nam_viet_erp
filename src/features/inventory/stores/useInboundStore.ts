// src/features/inventory/stores/useInboundStore.ts
import { message } from "antd";
import { create } from "zustand";

import { inboundService } from "../api/inboundService";
import {
  InboundTask,
  InboundFilter,
  InboundDetailResponse,
  InboundDetailItem,
} from "../types/inbound";

import { supabase } from "@/shared/lib/supabaseClient";

// ID kho tổng B2B — ưu tiên hiển thị vị trí kệ của kho này nếu product có ở nhiều kho.
// TODO: di chuyển sang config/warehouse_settings table khi multi-tenant.
const WAREHOUSE_B2B_MAIN_ID = 1;
const UNSHELVED_LABEL = "Chưa xếp";

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
  updateWorkingItem: (
    productId: number,
    changes: Partial<InboundDetailItem>
  ) => void;

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
    status: "all",
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
    } catch (error: unknown) {
      console.error("Failed to fetch inbound tasks", error);
      set({
        loading: false,
        tasks: [],
        error: error.message || "Lỗi tải danh sách",
      });
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
        throw new Error(
          "Dữ liệu phiếu nhập không tồn tại hoặc bị lỗi cấu trúc."
        );
      }

      const draftItems = data.po_info?.draft_data;
      const hasDraft = Array.isArray(draftItems) && draftItems.length > 0;

      if (hasDraft) {
        message.info("Đã phục hồi tiến độ làm việc lưu nháp.");
      }

      const baseWorkingItems = hasDraft
        ? draftItems
        : (data.items || []).map((item) => ({
            ...item,
            input_quantity:
              item.quantity_remaining > 0 ? item.quantity_remaining : 0,
            input_lot: "",
            input_expiry: "",
          }));

      let workingItems = [...baseWorkingItems];

      // Fetch shelf_location from product_inventory
      if (workingItems.length > 0) {
        const productIds = workingItems.map((i) => i.product_id);
        const { data: invData, error: invError } = await supabase
          .from("product_inventory")
          .select("product_id, shelf_location, warehouse_id")
          .in("product_id", productIds)
          .order("warehouse_id", { ascending: true })
          .order("shelf_location", { ascending: true });

        if (invError) {
          console.warn(
            "[useInboundStore] RLS block product_inventory:",
            invError.message
          );
        } else if (invData) {
          const locationMap = new Map<
            number,
            { shelf_location: string; warehouse_id: number }
          >();
          for (const row of invData) {
            if (!row.shelf_location) continue;
            const current = locationMap.get(row.product_id);

            // Đã có vị trí từ kho B2B chính và không phải "Chưa xếp" → giữ nguyên
            if (
              current &&
              current.warehouse_id === WAREHOUSE_B2B_MAIN_ID &&
              current.shelf_location !== UNSHELVED_LABEL
            ) {
              continue;
            }

            // Ưu tiên: chưa có | row là kho chính | đang "Chưa xếp" mà row mới có vị trí thật
            const shouldReplace =
              !current ||
              row.warehouse_id === WAREHOUSE_B2B_MAIN_ID ||
              (current.shelf_location === UNSHELVED_LABEL &&
                row.shelf_location !== UNSHELVED_LABEL);

            if (shouldReplace) {
              locationMap.set(row.product_id, {
                shelf_location: row.shelf_location,
                warehouse_id: row.warehouse_id,
              });
            }
          }
          workingItems = workingItems.map((item) => ({
            ...item,
            shelf_location:
              locationMap.get(item.product_id)?.shelf_location || "",
          }));

          // Sort A-Z by shelf_location
          workingItems.sort((a, b) => {
            const sa = (a.shelf_location || "").trim();
            const sb = (b.shelf_location || "").trim();
            if (!sa && !sb) return 0;
            if (!sa) return 1;
            if (!sb) return -1;
            return sa.localeCompare(sb, "vi", {
              numeric: true,
              sensitivity: "base",
            });
          });
        }
      }

      set({ detail: data, workingItems, loading: false });
    } catch (error: unknown) {
      console.error("Failed to fetch inbound detail", error);
      set({
        loading: false,
        detail: null,
        workingItems: [],
        error: error.message || "Lỗi tải chi tiết phiếu nhập",
      });
    }
  },

  updateWorkingItem: (productId, changes) => {
    set((state) => ({
      workingItems: state.workingItems.map((item) =>
        item.product_id === productId ? { ...item, ...changes } : item
      ),
    }));
  },

  submitReceipt: async (poId, warehouseId) => {
    const { workingItems } = get();
    set({ error: null });

    const itemsToProcess = workingItems
      .filter((item) => (item.input_quantity || 0) > 0)
      .map((item) => ({
        product_id: item.product_id,
        quantity: item.input_quantity || 0,
        unit: item.unit, // [NEW] Gửi đơn vị để Backend xử lý quy đổi
        lot_number: item.input_lot,
        expiry_date: item.input_expiry,
      }));

    if (itemsToProcess.length === 0) {
      throw new Error("Vui lòng nhập số lượng nhập cho ít nhất 1 sản phẩm");
    }

    try {
      await inboundService.submitReceipt({
        p_po_id: poId,
        p_warehouse_id: warehouseId,
        p_items: itemsToProcess,
      });
      await get().fetchDetail(poId);
    } catch (error: unknown) {
      set({ error: error.message });
      throw error;
    }
  },

  resetDetail: () => {
    set({ detail: null, workingItems: [], error: null });
  },
}));
