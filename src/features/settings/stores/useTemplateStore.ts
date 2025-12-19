// src/stores/useTemplateStore.ts
import { create } from "zustand";

import * as service from "@/features/settings/api/templateService";
import {
  TemplateStoreState,
  TemplateRecord,
} from "@/features/settings/types/template";

// Dữ liệu Biến (Variables) (tạm thời mock)
const mockVariables = [
  {
    key: "1",
    label: "Biến Chung (Công ty & Người dùng)",
    tags: [
      "{TenCongTy}",
      "{DiaChiCongTy}",
      "{MaSoThueCongTy}",
      "{TenNguoiDung}",
    ],
  },
  {
    key: "2",
    label: "Biến Khách hàng / Nhân viên",
    tags: [
      "{TenKhachHang}",
      "{TenNhanVien}",
      "{DiaChi}",
      "{SoDienThoai}",
      "{MaSoThue}",
    ],
  },
  {
    key: "3",
    label: "Biến Đơn hàng / Hóa đơn",
    tags: [
      "{MaDonHang}",
      "{NgayTaoDon}",
      "{DanhSachSanPham}",
      "{TongTienHang}",
      "{ChietKhau}",
      "{TongThanhToan}",
      "{SoTienNo}",
    ],
  },
];

export const useTemplateStore = create<TemplateStoreState>((set, get) => ({
  templates: [],
  loading: false,
  viewMode: "list",
  editingRecord: null,
  variables: [],

  fetchTemplates: async () => {
    set({ loading: true });
    try {
      const data = await service.fetchTemplates();
      const records = data.map((t) => ({ ...t, key: t.id }));
      set({ templates: records, loading: false });
    } catch (error) {
      console.error(error);
      set({ loading: false });
    }
  },

  fetchVariables: () => {
    // Tạm thời chỉ tải mock data
    set({ variables: mockVariables });
  },

  showEditor: (record: TemplateRecord | null = null) => {
    if (record) {
      set({ viewMode: "editor", editingRecord: record });
    } else {
      set({ viewMode: "editor", editingRecord: null });
    }
  },

  showList: () => {
    set({ viewMode: "list", editingRecord: null });
  },

  addTemplate: async (values) => {
    set({ loading: true });
    try {
      await service.addTemplate(values);
      await get().fetchTemplates(); // Tải lại
      set({ loading: false, viewMode: "list" });
      return true;
    } catch (error) {
      console.error(error);
      set({ loading: false });
      return false;
    }
  },

  updateTemplate: async (id, values) => {
    set({ loading: true });
    try {
      await service.updateTemplate(id, values);
      await get().fetchTemplates(); // Tải lại
      set({ loading: false, viewMode: "list" });
      return true;
    } catch (error) {
      console.error(error);
      set({ loading: false });
      return false;
    }
  },

  deleteTemplate: async (record) => {
    set({ loading: true });
    try {
      await service.deleteTemplate(record.id);
      await get().fetchTemplates(); // Tải lại
      set({ loading: false });
      return true;
    } catch (error) {
      console.error(error);
      set({ loading: false });
      return false;
    }
  },
}));
