// src/stores/useCustomerB2CStore.ts
import { create } from "zustand";

import * as service from "@/services/customerService";
import {
  CustomerB2CStoreState,
  CustomerB2CType,
  CustomerListRecord,
  //   CustomerDetailsData,
} from "@/types/customer";

export const useCustomerB2CStore = create<CustomerB2CStoreState>(
  (set, get) => ({
    customers: [],
    loading: false,
    isModalVisible: false,
    loadingDetails: false,
    isFormView: false,
    editingCustomer: null,
    editingCustomerType: "CaNhan",
    totalCount: 0,
    filters: {}, // SỬA LỖI 1: Thêm filters
    // --- HÀM TẢI DỮ LIỆU ---

    fetchCustomers: async (filters: any) => {
      // SỬA LỖI 1: Merge filters
      const finalFilters = { ...get().filters, ...filters };
      set({ loading: true, filters: finalFilters });
      try {
        const { data, totalCount } = await service.fetchCustomers(finalFilters);
        set({ customers: data, totalCount, loading: false });
      } catch (error: any) {
        console.error("Lỗi tải danh sách khách hàng:", error);
        set({ loading: false });
        throw error; // SỬA LỖI 4: Ném lỗi ra
      }
    },

    getCustomerDetails: async (id: number) => {
      set({ loadingDetails: true, editingCustomer: null }); // <-- SỬA LỖI 2
      try {
        const data = await service.fetchCustomerDetails(id);
        set({ editingCustomer: data, loadingDetails: false }); // <-- SỬA LỖI 2
      } catch (error: any) {
        console.error("Lỗi tải chi tiết khách hàng:", error);
        set({ loadingDetails: false }); // <-- SỬA LỖI 2
        throw error; // SỬA LỖI 4: Ném lỗi ra
      }
    }, // --- HÀM CRUD ---

    createCustomer: async (data: any, guardians: any) => {
      set({ loading: true });
      try {
        const newId = await service.createCustomer(data, guardians);
        await get().fetchCustomers({}); // Tải lại danh sách
        set({ loading: false, isFormView: false });
        return newId;
      } catch (error: any) {
        console.error("Lỗi tạo khách hàng:", error);
        set({ loading: false });
        throw error; // SỬA LỖI 4: Ném lỗi ra
      }
    },

    updateCustomer: async (id: number, data: any, guardians: any) => {
      set({ loading: true });
      try {
        await service.updateCustomer(id, data, guardians);
        await get().fetchCustomers({}); // Tải lại danh sách
        set({ loading: false, isFormView: false });
        return true;
      } catch (error: any) {
        console.error("Lỗi cập nhật khách hàng:", error);
        set({ loading: false });
        throw error; // SỬA LỖI 4: Ném lỗi ra
      }
    },

    deleteCustomer: async (id: number) => {
      set({ loading: true });
      try {
        await service.deleteCustomer(id);
        await get().fetchCustomers({}); // Tải lại danh sách
        set({ loading: false });
        return true;
      } catch (error: any) {
        console.error("Lỗi xóa (mềm) khách hàng:", error);
        set({ loading: false });
        throw error; // SỬA LỖI 4: Ném lỗi ra
      }
    },

    reactivateCustomer: async (id: number) => {
      set({ loading: true });
      try {
        await service.reactivateCustomer(id);
        await get().fetchCustomers(get().filters); // Tải lại danh sách
        set({ loading: false });
        return true;
      } catch (error: any) {
        console.error("Lỗi khôi phục khách hàng:", error);
        set({ loading: false });
        throw error;
      }
    },

    // Xuất Excel
    exportToExcel: async () => {
      set({ loading: true });
      const filters = get().filters; // Lấy filter hiện tại
      try {
        const data = await service.exportCustomers(filters);
        set({ loading: false });
        return data;
      } catch (error: any) {
        console.error("Lỗi xuất Excel:", error);
        set({ loading: false });
        throw error;
      }
    },
    // Nhập File Excel Danh sách khách hàng
    importCustomers: async (file: File) => {
      set({ loading: true });
      try {
        const count = await service.importCustomers(file);
        await get().fetchCustomers(get().filters); // Tải lại
        set({ loading: false });
        return count;
      } catch (error: any) {
        console.error("Lỗi Store Import:", error);
        set({ loading: false });
        throw error;
      }
    },

    // --- QUẢN LÝ UI ---

    showListView: () => {
      set({ isFormView: false, editingCustomer: null });
    },

    showFormView: (type: CustomerB2CType, record?: CustomerListRecord) => {
      set({
        isFormView: true,
        editingCustomerType: type,
        editingCustomer: null, // Xóa chi tiết cũ
      });
      if (record) {
        get().getCustomerDetails(record.id);
      }
    },
    closeModal: () => {
      set({ isModalVisible: false });
    }, // --- NGHIỆP VỤ PHỤ (TÌM GIÁM HỘ) ---
    // SỬA LỖI 2: Xóa "section"

    searchGuardians: async (phone: string) => {
      // Không set loading toàn trang, để modal tự xoay
      try {
        const results = await service.searchGuardians(phone);
        return results;
      } catch (error: any) {
        console.error("Lỗi tìm kiếm giám hộ:", error);
        AGAIN: throw error; // SỬA LỖI 4: Ném lỗi ra
      }
    },
  })
);
