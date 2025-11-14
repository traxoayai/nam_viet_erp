// src/stores/useShippingPartnerStore.ts
import { create } from "zustand";

import * as service from "@/services/shippingPartnerService";
import {
  ShippingPartnerStoreState,
  ShippingPartnerListRecord,
  //   ShippingPartnerFormData,
  //   ShippingRule,
} from "@/types/shippingPartner";

export const useShippingPartnerStore = create<ShippingPartnerStoreState>(
  (set, get) => ({
    // State
    partners: [],
    loading: false,
    loadingDetails: false,
    isModalVisible: false, // Dùng Modal (theo Canvas)
    editingPartner: null,
    totalCount: 0,
    filters: {}, // --- HÀM TẢI DỮ LIỆU ---

    fetchPartners: async (newFilters: any) => {
      const filters = { ...get().filters, ...newFilters };
      set({ loading: true, filters: filters });
      try {
        const { data, totalCount } = await service.fetchPartners(filters);
        set({ partners: data, totalCount, loading: false });
      } catch (error: any) {
        console.error("Lỗi tải danh sách đối tác vận chuyển:", error);
        set({ loading: false });
        throw error;
      }
    },

    getPartnerDetails: async (id: number) => {
      set({ loadingDetails: true, editingPartner: null });
      try {
        const data = await service.fetchPartnerDetails(id);
        set({ editingPartner: data, loadingDetails: false });
      } catch (error: any) {
        console.error("Lỗi tải chi tiết đối tác:", error);
        set({ loadingDetails: false });
        throw error;
      }
    }, // --- HÀM CRUD (Cho Modal) ---

    createPartner: async (data, rules) => {
      set({ loading: true }); // Dùng loading chung cho modal
      try {
        const newId = await service.createPartner(data, rules);
        await get().fetchPartners(get().filters); // Tải lại danh sách
        set({ loading: false, isModalVisible: false, editingPartner: null });
        return newId;
      } catch (error: any) {
        console.error("Lỗi tạo đối tác:", error);
        set({ loading: false });
        throw error;
      }
    },

    updatePartner: async (id, data, rules) => {
      set({ loading: true });
      try {
        await service.updatePartner(id, data, rules);
        await get().fetchPartners(get().filters);
        set({ loading: false, isModalVisible: false, editingPartner: null });
        return true;
      } catch (error: any) {
        console.error("Lỗi cập nhật đối tác:", error);
        set({ loading: false });
        throw error;
      }
    },

    deletePartner: async (id: number) => {
      set({ loading: true });
      try {
        await service.deletePartner(id);
        await get().fetchPartners(get().filters);
        set({ loading: false });
        return true;
      } catch (error: any) {
        console.error("Lỗi xóa (mềm) đối tác:", error);
        set({ loading: false });
        throw error;
      }
    },

    reactivatePartner: async (id: number) => {
      set({ loading: true });
      try {
        await service.reactivatePartner(id);
        await get().fetchPartners(get().filters);
        set({ loading: false });
        return true;
      } catch (error: any) {
        console.error("Lỗi khôi phục đối tác:", error);
        set({ loading: false });
        throw error;
      }
    }, // --- QUẢN LÝ UI (Modal) ---

    showModal: (record?: ShippingPartnerListRecord) => {
      set({
        isModalVisible: true,
        editingPartner: null,
      });
      if (record) {
        get().getPartnerDetails(record.id);
      }
    },

    closeModal: () => {
      set({ isModalVisible: false, editingPartner: null });
    },
  })
);
