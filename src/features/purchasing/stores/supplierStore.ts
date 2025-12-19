// src/stores/supplierStore.ts
import { create } from "zustand";

import { supabase } from "@/shared/lib/supabaseClient";
import {
  SupplierStoreState,
  SupplierFilters,
  Supplier,
} from "@/features/purchasing/types/supplier";

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
        // SỬA LỖI: Đổi từ camelCase sang snake_case để khớp với Form
        p_name: values.name,
        p_tax_code: values.tax_code || null,
        p_contact_person: values.contact_person || null,
        p_phone: values.phone,
        p_email: values.email || null,
        p_address: values.address || null,
        p_payment_term: values.payment_term || null,

        p_bank_account: values.bank_account || null,
        p_bank_name: values.bank_name || null,
        p_bank_holder: values.bank_holder || null,
        p_delivery_method: values.delivery_method || null,
        p_lead_time: values.lead_time || null,

        p_status: values.status,
        p_notes: values.notes || null,
      });

      if (error) throw error;

      await get().fetchSuppliers();
      set({ loading: false });
      return data;
    } catch (error: any) {
      console.error("Lỗi khi thêm NCC:", error.message);
      set({ loading: false });
      return null;
    }
  },

  updateSupplier: async (id: number, values: any) => {
    set({ loadingDetails: true });
    try {
      const { error } = await supabase.rpc("update_supplier", {
        p_id: id,
        // SỬA LỖI: Đổi từ camelCase sang snake_case để khớp với Form
        p_name: values.name,
        p_tax_code: values.tax_code || null,
        p_contact_person: values.contact_person || null,
        p_phone: values.phone,
        p_email: values.email || null,
        p_address: values.address || null,
        p_payment_term: values.payment_term || null,

        p_bank_account: values.bank_account || null,
        p_bank_name: values.bank_name || null,
        p_bank_holder: values.bank_holder || null,
        p_delivery_method: values.delivery_method || null,
        p_lead_time: values.lead_time || null,

        p_status: values.status,
        p_notes: values.notes || null,
      });

      if (error) throw error;

      set({ loadingDetails: false });
      await get().fetchSuppliers();
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
