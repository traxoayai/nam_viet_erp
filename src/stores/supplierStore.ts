// src/stores/supplierStore.ts
import { create } from "zustand";

import { supabase } from "@/lib/supabaseClient";
import {
  SupplierStoreState,
  SupplierFilters,
  Supplier,
} from "@/types/supplier";

export const useSupplierStore = create<SupplierStoreState>((set, get) => ({
  suppliers: [],
  currentSupplier: null,
  loading: false,
  loadingDetails: false,
  filters: {},
  page: 1,
  pageSize: 10,
  totalCount: 0,

  fetchSuppliers: async () => {
    set({ loading: true });
    try {
      const { filters, page, pageSize } = get();
      const { data, error } = await supabase.rpc("get_suppliers_list", {
        search_query: filters.search_query || null,
        status_filter: filters.status_filter || null,
        page_num: page,
        page_size: pageSize,
      });

      if (error) throw error;

      const totalCount = data && data.length > 0 ? data[0].total_count : 0;
      set({ suppliers: data || [], totalCount, loading: false });
    } catch (error) {
      console.error("Lỗi khi tải Nhà Cung Cấp:", error);
      set({ loading: false });
    }
  },

  getSupplierDetails: async (id: number) => {
    set({ loadingDetails: true, currentSupplier: null });
    try {
      // (SENKO: Tạm thời chúng ta sẽ tải từ bảng,
      // vì hàm RPC get_product_details quá phức tạp cho NCC)
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      set({ currentSupplier: data as Supplier, loadingDetails: false });
    } catch (error) {
      console.error("Lỗi khi tải chi tiết NCC:", error);
      set({ loadingDetails: false });
    }
  },

  setFilters: (newFilters: Partial<SupplierFilters>) => {
    set((state) => ({ filters: { ...state.filters, ...newFilters }, page: 1 }));
    get().fetchSuppliers();
  },

  setPage: (page: number, pageSize: number) => {
    set({ page, pageSize });
    get().fetchSuppliers();
  },

  addSupplier: async (values: any) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.rpc("create_supplier", {
        // Khớp 100% với Form (camelCase) và "Cỗ máy" (snake_case)
        p_name: values.name,
        p_tax_code: values.taxCode || null, // Sửa 'tax_code' -> 'taxCode'
        p_contact_person: values.contactPerson || null, // Sửa 'contact_person' -> 'contactPerson'
        p_phone: values.phone,
        p_email: values.email || null, // Sửa 'email' -> 'email'
        p_address: values.address || null,
        p_payment_term: values.paymentTerm || null, // Sửa 'payment_term' -> 'paymentTerm'
        p_status: values.status,
        p_notes: values.notes || null,
      });

      if (error) throw error;

      await get().fetchSuppliers(); // Tải lại dữ liệu
      set({ loading: false });

      // Trả về ID (data[0].id) hoặc một giá trị nhận dạng
      // Hàm RPC trả về BIGINT (ID), nên 'data' chính là ID đó
      return data;
    } catch (error: any) {
      console.error("Lỗi khi thêm NCC:", error.message);
      set({ loading: false });
      return null;
    }
  },

  updateSupplier: async (id: number, values: any) => {
    set({ loadingDetails: true }); // Dùng loading của form
    try {
      const { error } = await supabase.rpc("update_supplier", {
        p_id: id,
        p_name: values.name,
        p_tax_code: values.taxCode,
        p_address: values.address,
        p_contact_person: values.contactPerson,
        p_phone: values.phone,
        p_email: values.email,
        p_bank_account: values.bankAccount,
        p_bank_name: values.bankName,
        p_bank_holder: values.bankHolder,
        p_payment_term: values.paymentTerm,
        p_delivery_method: values.deliveryMethod,
        p_lead_time: values.leadTime,
        p_status: values.status,
        p_notes: values.notes,
      });
      if (error) throw error;
      set({ loadingDetails: false });
      await get().fetchSuppliers(); // Tải lại danh sách
      return true;
    } catch (error) {
      console.error("Lỗi khi cập nhật NCC:", error);
      set({ loadingDetails: false });
      return false;
    }
  },

  deleteSupplier: async (id: number) => {
    set({ loading: true });
    try {
      const { error } = await supabase.rpc("delete_supplier", { p_id: id });
      if (error) throw error;
      await get().fetchSuppliers();
      set({ loading: false });
      return true;
    } catch (error) {
      console.error("Lỗi khi xóa NCC:", error);
      set({ loading: false });
      return false;
    }
  },
}));
