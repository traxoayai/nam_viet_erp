import { message } from "antd";
import { create } from "zustand";

import type { Promotion } from "@/services/promotionService";

import { promotionService } from "@/services/promotionService";
export type { Promotion };

interface PromotionState {
  promotions: Promotion[];
  loading: boolean;
  fetchPromotions: () => Promise<void>;
  createPromotion: (data: any) => Promise<boolean>;
  deletePromotion: (id: string) => Promise<void>;
}

export const usePromotionStore = create<PromotionState>((set, get) => ({
  promotions: [],
  loading: false,

  fetchPromotions: async () => {
    set({ loading: true });
    try {
      const data = await promotionService.fetchPromotions();
      // Map key cho Antd Table
      set({ promotions: data.map((p) => ({ ...p, key: p.id })) });
    } catch (error) {
      console.error(error);
    } finally {
      set({ loading: false });
    }
  },

  createPromotion: async (data) => {
    set({ loading: true });
    try {
      await promotionService.createPromotion(data);
      message.success("Tạo mã thành công");
      get().fetchPromotions();
      return true;
    } catch (error: any) {
      message.error(`Lỗi: ${error.message}`);
      return false;
    } finally {
      set({ loading: false });
    }
  },

  deletePromotion: async (id) => {
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
