// src/stores/useFundAccountStore.ts
import { create } from "zustand";

import * as service from "@/services/fundAccountService";
import { FundAccountStoreState, FundAccountRecord } from "@/types/fundAccount";

export const useFundAccountStore = create<FundAccountStoreState>(
  (set, get) => ({
    fundAccounts: [],
    loading: false,
    isModalVisible: false,
    editingRecord: null,
    modalAccountType: "cash",

    fetchFundAccounts: async () => {
      set({ loading: true });
      try {
        const data = await service.fetchFundAccounts();
        const records = data.map((acc) => ({ ...acc, key: acc.id }));
        set({ fundAccounts: records, loading: false });
      } catch (error) {
        console.error(error);
        set({ loading: false });
      }
    },

    showAddModal: () => {
      set({
        isModalVisible: true,
        editingRecord: null,
        modalAccountType: "cash", // Mặc định là 'tiền mặt'
      });
    },
    showEditModal: (record: FundAccountRecord) => {
      set({
        isModalVisible: true,
        editingRecord: record,
        modalAccountType: record.type, // Đặt type theo record
      });
    },
    closeModal: () => {
      set({ isModalVisible: false, editingRecord: null });
    },

    setModalAccountType: (type: "cash" | "bank") => {
      set({ modalAccountType: type });
    },

    addFundAccount: async (values) => {
      set({ loading: true });
      try {
        await service.addFundAccount(values);
        await get().fetchFundAccounts(); // Tải lại
        set({ loading: false, isModalVisible: false });
        return true;
      } catch (error) {
        console.error(error);
        set({ loading: false });
        return false;
      }
    },

    updateFundAccount: async (id, values) => {
      set({ loading: true });
      try {
        await service.updateFundAccount(id, values);
        await get().fetchFundAccounts(); // Tải lại
        set({ loading: false, isModalVisible: false });
        return true;
      } catch (error) {
        console.error(error);
        set({ loading: false });
        return false;
      }
    },

    deleteFundAccount: async (id) => {
      set({ loading: true });
      try {
        await service.deleteFundAccount(id);
        await get().fetchFundAccounts(); // Tải lại
        set({ loading: false });
        return true;
      } catch (error) {
        console.error(error);
        set({ loading: false });
        return false;
      }
    },
  })
);
