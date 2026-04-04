// src/features/inventory/stores/useInventoryCheckStore.ts
import { message } from "antd";
import { debounce } from "lodash";
import { create } from "zustand";

import { moneyMul, moneyAdd, moneySub } from "@/shared/utils/money";
import { inventoryService } from "../api/inventoryService";
import {
  InventoryCheckItem,
  InventoryCheckSession,
} from "../types/inventory.types";

interface InventoryCheckState {
  activeSession: InventoryCheckSession | null;
  items: InventoryCheckItem[];
  loading: boolean;

  // [LOGIC FOCUS]: ID sản phẩm đang được highlight
  activeItemId: number | null;

  // Actions
  fetchSessionDetails: (checkId: number) => Promise<void>;

  // Hàm update 3 tiers + tracking
  updateItemQuantity: (
    itemId: number,
    quantities: { wholesale_qty?: number; retail_qty?: number; base_qty?: number },
    tracking?: { lot_number?: string; expiry_date?: string }
  ) => void;

  // Điều hướng
  setActiveItem: (id: number) => void;
  moveToNextItem: () => void;

  completeSession: (userId: string) => Promise<void>;

  // [NEW ACTIONS]
  saveCheckInfo: (note: string) => Promise<void>;
  cancelSession: () => Promise<void>;
  addItemToCheck: (productId: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  splitCheckItem: (originItemId: number, productId: number) => Promise<void>;
}

export const useInventoryCheckStore = create<InventoryCheckState>(
  (set, get) => ({
    activeSession: null,
    items: [],
    loading: false,
    activeItemId: null,

    fetchSessionDetails: async (checkId) => {
      set({ loading: true });
      try {
        const { session, items } =
          await inventoryService.getCheckSession(checkId);
        set({
          activeSession: session as any,
          items,
          // Mặc định highlight thằng đầu tiên
          activeItemId: items.length > 0 ? items[0].id : null,
        });
      } catch (error) {
        console.error(error);
        message.error("Lỗi tải phiếu kiểm kê");
      } finally {
        set({ loading: false });
      }
    },

    updateItemQuantity: (itemId, quantities, tracking) => {
      const { items } = get();

      const updatedItems = items.map((item) => {
        if (item.id !== itemId) return item;

        const wQty = quantities.wholesale_qty ?? item.input_wholesale_qty ?? 0;
        const rQty = quantities.retail_qty ?? item.input_retail_qty ?? 0;
        const bQty = quantities.base_qty ?? item.input_base_qty ?? 0;

        const wRate = item.wholesale_unit_rate || 1;
        const rRate = item.retail_unit_rate || 1;

        let total = 0;
        if (item.wholesale_unit_name && item.retail_unit_name) {
          // Always sum all 3 tiers when both units exist
          total = moneyAdd(moneyAdd(moneyMul(wQty, wRate), moneyMul(rQty, rRate)), bQty);
        } else if (item.wholesale_unit_name && !item.retail_unit_name && wRate > 1) {
          total = moneyAdd(moneyMul(wQty, wRate), bQty);
        } else if (!item.wholesale_unit_name && item.retail_unit_name && rRate > 1) {
          total = moneyAdd(moneyMul(rQty, rRate), bQty);
        } else if (wRate > 1) {
          total = moneyAdd(moneyMul(wQty, wRate), bQty);
        } else {
          total = bQty;
        }

        return {
          ...item,
          input_wholesale_qty: wQty,
          input_retail_qty: rQty,
          input_base_qty: bQty,
          batch_code: tracking?.lot_number ?? item.batch_code,
          expiry_date: tracking?.expiry_date ?? item.expiry_date,
          actual_quantity: total,
          diff_quantity: moneySub(total, item.system_quantity || 0),
        };
      });

      set({ items: updatedItems });

      const item = updatedItems.find((i) => i.id === itemId);
      if (item) {
        saveToDbDebounced(itemId, {
          wholesale_qty: item.input_wholesale_qty,
          retail_qty: item.input_retail_qty,
          base_qty: item.input_base_qty,
          lot_number: item.batch_code,
          expiry_date: item.expiry_date,
        });
      }
    },

    setActiveItem: (id) => set({ activeItemId: id }),

    moveToNextItem: () => {
      const { items, activeItemId } = get();
      if (!activeItemId) return;

      const currentIndex = items.findIndex((i) => i.id === activeItemId);
      if (currentIndex !== -1 && currentIndex < items.length - 1) {
        const nextId = items[currentIndex + 1].id;
        set({ activeItemId: nextId });
      } else {
        message.success("Đã đi đến cuối danh sách!");
      }
    },

    completeSession: async (userId) => {
      const { activeSession } = get();
      if (!activeSession) return;
      try {
        await inventoryService.completeCheck(activeSession.id, userId);
        message.success("Đã hoàn tất kiểm kê!");
      } catch (err: any) {
        message.error("Lỗi: " + err.message);
      }
    },

    saveCheckInfo: async (note) => {
      const { activeSession } = get();
      if (!activeSession) return;
      try {
        message.loading({ content: "Đang lưu...", key: "save_process" });
        await inventoryService.updateCheckInfo(activeSession.id, note);

        // Cập nhật lại note trong state local
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set({ activeSession: { ...activeSession, note } as any });

        message.success({
          content: "Đã lưu thông tin phiếu!",
          key: "save_process",
        });
      } catch (error) {
        message.error({ content: "Lỗi lưu phiếu", key: "save_process" });
        console.error(error);
      }
    },

    cancelSession: async () => {
      const { activeSession } = get();
      if (!activeSession) return;

      await inventoryService.cancelCheck(activeSession.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set({ activeSession: { ...activeSession, status: "CANCELLED" } as any });
    },

    // [IMPLEMENTATION]
    addItemToCheck: async (productId) => {
      const { activeSession } = get();
      if (!activeSession) return;

      set({ loading: true });
      try {
        // 1. Gọi RPC thêm
        const res = await inventoryService.addItemToCheck(
          activeSession.id,
          productId
        );

        // 2. Xử lý phản hồi
        const result = res as unknown as { status: string; item_id: number; message?: string };
        if (result.status === "exists") {
          message.info("Sản phẩm đã có trong danh sách! Đang di chuyển tới...");
          // Scroll tới sản phẩm đã có
          set({ activeItemId: result.item_id });
        } else if (result.status === "success") {
          message.success("Đã thêm sản phẩm mới vào phiếu!");

          // 3. Reload lại danh sách items để có dữ liệu đầy đủ (Join Product, Units...)
          // Vì RPC add chỉ trả về ID, ta cần load lại để có full info hiển thị lên Card
          await get().fetchSessionDetails(activeSession.id);

          // 4. Highlight sản phẩm mới thêm
          set({ activeItemId: result.item_id });
        } else {
          message.error(result.message || "Không thể thêm sản phẩm");
        }
      } catch (error: any) {
        console.error(error);
        message.error(error.message || "Lỗi thêm sản phẩm");
      } finally {
        set({ loading: false });
      }
    },

    removeItem: async (itemId: number) => {
      set({ loading: true });
      try {
        await inventoryService.removeCheckItem(itemId);
        // Xóa khỏi state local
        set((state) => ({ items: state.items.filter((i) => i.id !== itemId) }));
        message.success("Đã xóa sản phẩm khỏi phiếu");
      } catch (err: any) {
        message.error("Lỗi xóa sản phẩm: " + err.message);
      } finally {
        set({ loading: false });
      }
    },

    splitCheckItem: async (_originItemId, productId) => {
      const { activeSession } = get();
      if (!activeSession) return;
      set({ loading: true });
      try {
        const data = await inventoryService.splitCheckItem(activeSession.id, productId);
        
        message.success("Đã tách dòng để nhập Lô mới!");
        await get().fetchSessionDetails(activeSession.id);
        set({ activeItemId: data.id });
      } catch (err: any) {
        message.error("Lỗi tách lô: " + err.message);
      } finally {
        set({ loading: false });
      }
    },
  })
);

// Helper debounce save
const saveToDbDebounced = debounce((itemId: number, payload: any) => {
  inventoryService
    .updateCheckItemQuantity(itemId, payload)
    .catch((err) => console.error(err));
}, 500);
