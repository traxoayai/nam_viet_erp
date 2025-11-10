// src/stores/useBankStore.ts
import { create } from "zustand";

import * as bankService from "@/services/bankService";
import { BankStoreState, BankRecord } from "@/types/bank";

export const useBankStore = create<BankStoreState>((set, get) => ({
  banks: [],
  loading: false,
  isModalVisible: false,
  editingRecord: null,

  fetchBanks: async () => {
    set({ loading: true });
    try {
      const data = await bankService.fetchBanks();
      // Thêm 'key' cho AntD Table
      const records = data.map((b) => ({ ...b, key: b.id }));
      set({ banks: records, loading: false });
    } catch (error) {
      console.error(error);
      set({ loading: false });
    }
  },

  syncFromVietQR: async () => {
    set({ loading: true });
    try {
      const count = await bankService.syncBanksFromVietQR();
      await get().fetchBanks(); // Tải lại danh sách
      set({ loading: false });
      return count; // Trả về số lượng cho thông báo
    } catch (error) {
      console.error(error);
      set({ loading: false });
      throw error; // Ném lỗi ra để component bắt
    }
  },

  showAddModal: () => {
    set({ isModalVisible: true, editingRecord: null });
  },
  showEditModal: (record: BankRecord) => {
    set({ isModalVisible: true, editingRecord: record });
  },
  closeModal: () => {
    set({ isModalVisible: false, editingRecord: null });
  },

  addBank: async (values) => {
    set({ loading: true });
    try {
      await bankService.addBank(values);
      await get().fetchBanks();
      set({ loading: false, isModalVisible: false });
      return true;
    } catch (error) {
      console.error(error);
      set({ loading: false });
      return false;
    }
  },

  updateBank: async (id, values) => {
    set({ loading: true });
    try {
      await bankService.updateBank(id, values);
      await get().fetchBanks();
      set({ loading: false, isModalVisible: false });
      return true;
    } catch (error) {
      console.error(error);
      set({ loading: false });
      return false;
    }
  },

  deleteBank: async (id) => {
    set({ loading: true });
    try {
      await bankService.deleteBank(id);
      await get().fetchBanks();
      set({ loading: false });
      return true;
    } catch (error) {
      console.error(error);
      set({ loading: false });
      return false;
    }
  },
}));
