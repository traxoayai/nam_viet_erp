// src/stores/usePromotionStore.ts
import { message } from "antd";
import { create } from "zustand";

import type { Promotion } from "@/services/promotionService";

import { promotionService } from "@/services/promotionService";

// 1. Re-export Type để các file khác dùng được (Tránh lỗi TS2459)
export type { Promotion };

// 2. Định nghĩa State của Store
interface PromotionStoreState {
  promotions: Promotion[];
  loading: boolean;

  // Cập nhật hàm fetch để nhận tham số tìm kiếm
  fetchPromotions: (search?: string, status?: string) => Promise<void>;

  createPromotion: (data: any) => Promise<boolean>;
  deletePromotion: (id: string) => Promise<void>;
}

// 3. Khởi tạo Store
export const usePromotionStore = create<PromotionStoreState>((set, get) => ({
  promotions: [],
  loading: false,

  // Cập nhật Logic Fetch
  fetchPromotions: async (search = "", status = "") => {
    set({ loading: true });
    try {
      const data = await promotionService.fetchPromotions(
        search,
        status || undefined
      );
      // Map key cho Antd Table (dùng id làm key)
      set({ promotions: data.map((p) => ({ ...p, key: p.id })) });
    } catch (error) {
      console.error("Lỗi tải danh sách mã:", error);
    } finally {
      set({ loading: false });
    }
  },

  createPromotion: async (data) => {
    set({ loading: true });
    try {
      await promotionService.createPromotion(data);
      message.success("Tạo mã thành công");
      get().fetchPromotions(); // Tải lại danh sách mới nhất
      return true;
    } catch (error: any) {
      message.error(`Lỗi: ${error.message}`);
      return false;
    } finally {
      set({ loading: false });
    }
  },

  deletePromotion: async (id: string) => {
    set({ loading: true });
    try {
      await promotionService.deletePromotion(id);
      message.success("Đã xóa mã");
      get().fetchPromotions();
    } catch (error) {
      message.error("Xóa thất bại");
    } finally {
      set({ loading: false });
    }
  },
}));
