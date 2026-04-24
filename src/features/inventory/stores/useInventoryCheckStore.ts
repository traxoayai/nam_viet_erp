// src/features/inventory/stores/useInventoryCheckStore.ts
import { message } from "antd";
import { debounce } from "lodash";
import { create } from "zustand";

import { inventoryService } from "../api/inventoryService";
import {
  InventoryCheckItem,
  InventoryCheckSession,
} from "../types/inventory.types";

import { moneyMul, moneyAdd, moneySub } from "@/shared/utils/money";

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
    quantities: {
      wholesale_qty?: number;
      retail_qty?: number;
      base_qty?: number;
    },
    tracking?: { lot_number?: string; expiry_date?: string }
  ) => void;

  // Xác nhận dòng khớp tồn máy (nút "Đủ/OK") — commit actual=system, counted_at=NOW
  confirmItemMatching: (itemId: number) => Promise<void>;

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
          activeSession: session as unknown as InventoryCheckSession,
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
          total = moneyAdd(
            moneyAdd(moneyMul(wQty, wRate), moneyMul(rQty, rRate)),
            bQty
          );
        } else if (
          item.wholesale_unit_name &&
          !item.retail_unit_name &&
          wRate > 1
        ) {
          total = moneyAdd(moneyMul(wQty, wRate), bQty);
        } else if (
          !item.wholesale_unit_name &&
          item.retail_unit_name &&
          rRate > 1
        ) {
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

    confirmItemMatching: async (itemId) => {
      try {
        // Flush debounce trước để không đè lên update RPC tiếp theo
        const pending = debouncedSaveMap.get(itemId);
        if (pending) {
          pending.flush();
          const p = pendingSaves.get(itemId);
          if (p) await p;
        }

        const res = await inventoryService.confirmCheckItemMatching(itemId);
        const row = res as {
          status?: string;
          message?: string;
          actual_quantity?: number;
          system_quantity?: number;
        } | null;

        if (row?.status === "error") {
          message.error(row.message || "Không thể xác nhận khớp");
          return;
        }

        const system = row?.system_quantity ?? 0;
        set((state) => ({
          items: state.items.map((it) => {
            if (it.id !== itemId) return it;
            const wRate = it.wholesale_unit_rate || 1;
            const rRate = it.retail_unit_rate || 1;
            // Phân rã ngược để UI hiển thị consistent: ưu tiên wholesale > retail > base
            let remaining = system;
            let wQty = 0;
            let rQty = 0;
            if (it.wholesale_unit_name && wRate > 1) {
              wQty = Math.floor(remaining / wRate);
              remaining -= wQty * wRate;
            }
            if (it.retail_unit_name && rRate > 1) {
              rQty = Math.floor(remaining / rRate);
              remaining -= rQty * rRate;
            }
            return {
              ...it,
              input_wholesale_qty: wQty,
              input_retail_qty: rQty,
              input_base_qty: remaining,
              actual_quantity: system,
              system_quantity: system,
              diff_quantity: 0,
              counted_at: new Date().toISOString(),
            };
          }),
        }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Lỗi xác nhận khớp";
        message.error(msg);
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
        // Flush tất cả saves đang pending trước khi chốt sổ
        await flushAllPendingSaves();
        await inventoryService.completeCheck(activeSession.id, userId);
        message.success("Đã hoàn tất kiểm kê!");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Lỗi hoàn tất";
        message.error("Lỗi: " + msg);
      }
    },

    saveCheckInfo: async (note) => {
      const { activeSession } = get();
      if (!activeSession) return;
      try {
        message.loading({ content: "Đang lưu...", key: "save_process" });
        await inventoryService.updateCheckInfo(activeSession.id, note);

        // Cập nhật lại note trong state local
        set({
          activeSession: { ...activeSession, note } as InventoryCheckSession,
        });

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
      set({
        activeSession: {
          ...activeSession,
          status: "CANCELLED",
        } as InventoryCheckSession,
      });
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
        const result = res as unknown as {
          status: string;
          item_id: number;
          message?: string;
          inserted_count?: number;
        };
        if (result.status === "exists") {
          message.info("Sản phẩm đã có trong danh sách! Đang di chuyển tới...");
          // Scroll tới sản phẩm đã có
          set({ activeItemId: result.item_id });
        } else if (result.status === "success") {
          const inserted =
            typeof result.inserted_count === "number"
              ? result.inserted_count
              : 1;
          message.success(
            inserted > 1
              ? `Đã thêm ${inserted} dòng kiểm kê (mỗi lô một dòng)`
              : "Đã thêm sản phẩm vào phiếu!"
          );

          // 3. Reload lại danh sách items để có dữ liệu đầy đủ (Join Product, Units...)
          // Vì RPC add chỉ trả về ID, ta cần load lại để có full info hiển thị lên Card
          await get().fetchSessionDetails(activeSession.id);

          // 4. Highlight sản phẩm mới thêm
          set({ activeItemId: result.item_id });
        } else if (result.status === "error") {
          message.error(result.message || "Không thể thêm sản phẩm");
        } else {
          message.error(result.message || "Không thể thêm sản phẩm");
        }
      } catch (error: unknown) {
        console.error(error);
        message.error(
          error instanceof Error ? error.message : "Lỗi thêm sản phẩm"
        );
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
      } catch (err: unknown) {
        message.error(
          "Lỗi xóa sản phẩm: " +
            (err instanceof Error ? err.message : "Lỗi không xác định")
        );
      } finally {
        set({ loading: false });
      }
    },

    splitCheckItem: async (_originItemId, productId) => {
      const { activeSession } = get();
      if (!activeSession) return;
      set({ loading: true });
      try {
        const data = await inventoryService.splitCheckItem(
          activeSession.id,
          productId
        );

        message.success("Đã tách dòng để nhập Lô mới!");
        await get().fetchSessionDetails(activeSession.id);
        set({ activeItemId: data.id });
      } catch (err: unknown) {
        message.error(
          "Lỗi tách lô: " +
            (err instanceof Error ? err.message : "Lỗi không xác định")
        );
      } finally {
        set({ loading: false });
      }
    },
  })
);

// Helper debounce save — PER-ITEM debounce để tránh mất data khi sửa nhiều item liên tiếp
const debouncedSaveMap = new Map<number, ReturnType<typeof debounce>>();
const pendingSaves = new Map<number, Promise<unknown>>();

function saveToDbDebounced(itemId: number, payload: Record<string, unknown>) {
  if (!debouncedSaveMap.has(itemId)) {
    debouncedSaveMap.set(
      itemId,
      debounce((id: number, p: Record<string, unknown>) => {
        const promise = inventoryService
          .updateCheckItemQuantity(
            id,
            p as {
              wholesale_qty?: number;
              retail_qty?: number;
              base_qty?: number;
              lot_number?: string;
              expiry_date?: string;
            }
          )
          .then((res: unknown) => {
            const row = res as { system_quantity?: number } | null;
            if (row && typeof row.system_quantity === "number") {
              useInventoryCheckStore.setState((state) => ({
                items: state.items.map((it) => {
                  if (it.id !== id) return it;
                  const actual = it.actual_quantity ?? 0;
                  return {
                    ...it,
                    system_quantity: row.system_quantity!,
                    diff_quantity: moneySub(actual, row.system_quantity!),
                  };
                }),
              }));
            }
          })
          .catch((err) => console.error("Lỗi lưu item", id, err))
          .finally(() => pendingSaves.delete(id));
        pendingSaves.set(id, promise);
      }, 500)
    );
  }
  debouncedSaveMap.get(itemId)!(itemId, payload);
}

/** Flush tất cả pending debounce saves và đợi hoàn tất — gọi trước khi complete */
async function flushAllPendingSaves() {
  // Force-fire tất cả debounce timers đang chờ
  for (const fn of debouncedSaveMap.values()) {
    fn.flush();
  }
  // Đợi tất cả RPC calls hoàn tất
  if (pendingSaves.size > 0) {
    await Promise.all(pendingSaves.values());
  }
}
