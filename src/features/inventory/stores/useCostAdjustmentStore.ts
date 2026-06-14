// src/features/inventory/stores/useCostAdjustmentStore.ts
// Zustand store cho màn "Điều chỉnh Giá Vốn" (Batch Cost Adjustment).
// Nhiệm vụ: quản lý pending edits (batch_id -> new_price), apply, reset.

import { message } from "antd";
import { create } from "zustand";

import {
  BatchCostChange,
  BatchValuationRow,
  CostAdjustmentReason,
  InventoryTotalValue,
  costAdjustmentService,
} from "../api/costAdjustmentService";

interface CostAdjustmentState {
  // Filters
  warehouseId: number | null;
  search: string;
  onlyMissingPrice: boolean;

  // Grid data
  rows: BatchValuationRow[];
  totalCount: number;
  loading: boolean;
  page: number;
  pageSize: number;

  // Header stats
  stats: InventoryTotalValue;
  statsLoading: boolean;

  // Pending edits: batch_id -> new_price (number) or undefined khi đã reset
  pendingChanges: Map<number, number>;

  // Actions
  setWarehouse: (id: number | null) => void;
  setSearch: (s: string) => void;
  setOnlyMissingPrice: (v: boolean) => void;
  setPage: (page: number, pageSize?: number) => void;

  fetchGrid: () => Promise<void>;
  fetchStats: () => Promise<void>;

  setPendingPrice: (batchId: number, newPrice: number | null) => void;
  clearPending: () => void;

  getDirtyChanges: () => BatchCostChange[];
  getDirtyCount: () => number;
  getDirtyDelta: () => number;

  applyChanges: (
    reason: CostAdjustmentReason,
    note?: string
  ) => Promise<boolean>;
}

const defaultStats: InventoryTotalValue = {
  total_value: 0,
  total_qty: 0,
  count_batches: 0,
  count_zero_price_batches: 0,
};

export const useCostAdjustmentStore = create<CostAdjustmentState>(
  (set, get) => ({
    warehouseId: null,
    search: "",
    onlyMissingPrice: false,

    rows: [],
    totalCount: 0,
    loading: false,
    page: 1,
    pageSize: 50,

    stats: defaultStats,
    statsLoading: false,

    pendingChanges: new Map(),

    setWarehouse: (id) => {
      set({ warehouseId: id, page: 1 });
      void get().fetchGrid();
      void get().fetchStats();
    },

    setSearch: (s) => {
      set({ search: s, page: 1 });
    },

    setOnlyMissingPrice: (v) => {
      set({ onlyMissingPrice: v, page: 1 });
      void get().fetchGrid();
    },

    setPage: (page, pageSize) => {
      set({ page, pageSize: pageSize ?? get().pageSize });
      void get().fetchGrid();
    },

    fetchGrid: async () => {
      const s = get();
      set({ loading: true });
      try {
        const rows = await costAdjustmentService.getValuationGrid({
          warehouseId: s.warehouseId,
          search: s.search,
          onlyMissingPrice: s.onlyMissingPrice,
          limit: s.pageSize,
          offset: (s.page - 1) * s.pageSize,
        });
        const totalCount = rows[0]?.total_count ?? 0;
        set({ rows, totalCount });
      } catch (err) {
        console.error("[CostAdjustment] fetchGrid failed", err);
        message.error("Không tải được danh sách lô");
      } finally {
        set({ loading: false });
      }
    },

    fetchStats: async () => {
      set({ statsLoading: true });
      try {
        const stats = await costAdjustmentService.getTotalValue(
          get().warehouseId
        );
        set({ stats });
      } catch (err) {
        console.error("[CostAdjustment] fetchStats failed", err);
      } finally {
        set({ statsLoading: false });
      }
    },

    setPendingPrice: (batchId, newPrice) => {
      const next = new Map(get().pendingChanges);
      if (newPrice === null || Number.isNaN(newPrice)) {
        next.delete(batchId);
      } else {
        next.set(batchId, Math.max(0, Math.floor(newPrice)));
      }
      set({ pendingChanges: next });
    },

    clearPending: () => {
      set({ pendingChanges: new Map() });
    },

    getDirtyChanges: () => {
      const { rows, pendingChanges } = get();
      const changes: BatchCostChange[] = [];
      pendingChanges.forEach((newPrice, batchId) => {
        const row = rows.find((r) => r.batch_id === batchId);
        if (!row) return;
        if (Math.abs(row.inbound_price - newPrice) < 0.0001) return;
        changes.push({ batch_id: batchId, new_price: newPrice });
      });
      return changes;
    },

    getDirtyCount: () => get().getDirtyChanges().length,

    getDirtyDelta: () => {
      const { rows } = get();
      return get()
        .getDirtyChanges()
        .reduce((sum, c) => {
          const row = rows.find((r) => r.batch_id === c.batch_id);
          if (!row) return sum;
          return sum + row.quantity * (c.new_price - row.inbound_price);
        }, 0);
    },

    applyChanges: async (reason, note) => {
      const changes = get().getDirtyChanges();
      if (!changes.length) {
        message.warning("Không có thay đổi để lưu");
        return false;
      }
      try {
        const res = await costAdjustmentService.bulkUpdate(
          changes,
          reason,
          note
        );
        message.success(
          `Đã cập nhật ${res.updated_count ?? 0} lô${
            res.skipped_count ? ` (bỏ qua ${res.skipped_count})` : ""
          }`
        );
        get().clearPending();
        await Promise.all([get().fetchGrid(), get().fetchStats()]);
        return true;
      } catch (err: unknown) {
        console.error("[CostAdjustment] apply failed", err);
        message.error(err?.message || "Không lưu được thay đổi");
        return false;
      }
    },
  })
);
