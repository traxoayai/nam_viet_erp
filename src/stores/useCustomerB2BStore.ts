// src/stores/useCustomerB2BStore.ts
import { create } from "zustand";

import * as service from "@/services/customerB2BService";
import {
  CustomerB2BStoreState,
  CustomerB2BListRecord,
  //   CustomerB2BFormData,
  //   CustomerB2BContact,
} from "@/types/customerB2B";

export const useCustomerB2BStore = create<CustomerB2BStoreState>(
  (set, get) => ({
    // State
    customers: [],
    loading: false,
    loadingDetails: false,
    isFormView: false,
    editingCustomer: null,
    totalCount: 0,
    page: 1,
    pageSize: 10,
    filters: {}, // --- HÀM TẢI DỮ LIỆU ---

    fetchCustomers: async (newFilters: any) => {
      const filters = { ...get().filters, ...newFilters };
      const { page, pageSize } = get();
      set({ loading: true, filters: filters });
      try {
        const { data, totalCount } = await service.fetchCustomers(
          filters,
          page,
          pageSize
        );
        set({ customers: data, totalCount, loading: false });
      } catch (error: any) {
        console.error("Lỗi tải danh sách khách hàng B2B:", error);
        set({ loading: false });
        throw error;
      }
    },

    getCustomerDetails: async (id: number) => {
      set({ loadingDetails: true, editingCustomer: null });
      try {
        const data = await service.fetchCustomerDetails(id);
        set({ editingCustomer: data, loadingDetails: false });
      } catch (error: any) {
        console.error("Lỗi tải chi tiết khách hàng B2B:", error);
        set({ loadingDetails: false });
        throw error;
      }
    }, // --- HÀM CRUD ---

    createCustomer: async (data, contacts) => {
      set({ loading: true });
      try {
        const newId = await service.createCustomer(data, contacts);
        await get().fetchCustomers(get().filters);
        set({ loading: false, isFormView: false });
        return newId;
      } catch (error: any) {
        console.error("Lỗi tạo khách hàng B2B:", error);
        set({ loading: false });
        throw error;
      }
    },

    updateCustomer: async (id, data, contacts) => {
      set({ loading: true });
      try {
        await service.updateCustomer(id, data, contacts);
        await get().fetchCustomers(get().filters);
        set({ loading: false, isFormView: false });
        return true;
      } catch (error: any) {
        console.error("Lỗi cập nhật khách hàng B2B:", error);
        set({ loading: false });
        throw error;
      }
    },

    deleteCustomer: async (id: number) => {
      set({ loading: true });
      try {
        await service.deleteCustomer(id);
        await get().fetchCustomers(get().filters);
        set({ loading: false });
        return true;
      } catch (error: any) {
        console.error("Lỗi xóa (mềm) khách hàng B2B:", error);
        set({ loading: false });
        throw error;
      }
    },

    reactivateCustomer: async (id: number) => {
      set({ loading: true });
      try {
        await service.reactivateCustomer(id);
        await get().fetchCustomers(get().filters);
        set({ loading: false });
        return true;
      } catch (error: any) {
        console.error("Lỗi khôi phục khách hàng B2B:", error);
        set({ loading: false });
        throw error;
      }
    },

    // Xuất Excel
    exportToExcel: async () => {
      set({ loading: true });
      const filters = get().filters;
      try {
        const data = await service.exportCustomers(filters);
        set({ loading: false });
        return data;
      } catch (error: any) {
        console.error("Lỗi xuất Excel B2B:", error);
        set({ loading: false });
        throw error;
      }
    },

    // Nhập File Excel

    importCustomers: async (file: File) => {
      set({ loading: true });
      try {
        const count = await service.importCustomers(file);
        await get().fetchCustomers(get().filters); // Tải lại
        set({ loading: false });
        return count;
      } catch (error: any) {
        console.error("Lỗi Store Import B2B:", error);
        set({ loading: false });
        throw error;
      }
    },

    // --- QUẢN LÝ UI & PHÂN TRANG ---

    setPage: (page: number, pageSize: number) => {
      set({ page, pageSize });
      get().fetchCustomers(get().filters); // Tự động tải lại trang
    },

    showListView: () => {
      set({ isFormView: false, editingCustomer: null });
    },

    showFormView: (record?: CustomerB2BListRecord) => {
      set({
        isFormView: true,
        editingCustomer: null,
      });
      if (record) {
        get().getCustomerDetails(record.id);
      }
    },
  })
);
