// src/stores/useVaccinationTemplateStore.ts
import { message } from "antd";
import { create } from "zustand";

// 1. Import đúng tên Service
import { vaccinationService } from "@/features/marketing/api/vaccinationService";
// 2. Import Type từ đúng file định nghĩa (Không lấy từ Service)
import {
  VaccinationTemplate,
  VaccinationTemplateItem,
  VaccinationTemplateInput,
} from "@/features/marketing/types/vaccination";

interface StoreState {
  templates: VaccinationTemplate[];
  loading: boolean;
  editingTemplate: {
    data: VaccinationTemplate;
    items: VaccinationTemplateItem[];
  } | null;
  viewMode: "list" | "form";

  // Actions
  fetchTemplates: (search?: string, status?: string) => Promise<void>;
  getTemplateDetails: (id: number) => Promise<void>;
  createTemplate: (
    data: VaccinationTemplateInput,
    items: any[]
  ) => Promise<boolean>;
  updateTemplate: (
    id: number,
    data: VaccinationTemplateInput,
    items: any[]
  ) => Promise<boolean>;
  deleteTemplate: (id: number) => Promise<void>;

  // UI Helpers
  showForm: (record?: VaccinationTemplate) => void;
  showList: () => void;
}

export const useVaccinationTemplateStore = create<StoreState>((set, get) => ({
  templates: [],
  loading: false,
  editingTemplate: null,
  viewMode: "list",

  fetchTemplates: async (search = "", status = "") => {
    set({ loading: true });
    try {
      // Gọi đúng tên service
      const data = await vaccinationService.getTemplates(search, status);
      set({ templates: data, loading: false });
    } catch (error) {
      console.error(error);
      set({ loading: false });
    }
  },

  getTemplateDetails: async (id) => {
    set({ loading: true });
    try {
      const { template, items } =
        await vaccinationService.getTemplateDetails(id);
      set({ editingTemplate: { data: template, items }, loading: false });
    } catch (error) {
      console.error(error);
      message.error("Lỗi tải chi tiết phác đồ");
      set({ loading: false });
    }
  },

  createTemplate: async (data, items) => {
    set({ loading: true });
    try {
      await vaccinationService.createTemplate(data, items);
      message.success("Tạo phác đồ thành công");
      get().fetchTemplates();
      return true;
    } catch (error) {
      message.error("Tạo thất bại");
      return false;
    } finally {
      set({ loading: false });
    }
  },

  updateTemplate: async (id, data, items) => {
    set({ loading: true });
    try {
      await vaccinationService.updateTemplate(id, data, items);
      message.success("Cập nhật thành công");
      get().fetchTemplates();
      return true;
    } catch (error) {
      message.error("Cập nhật thất bại");
      return false;
    } finally {
      set({ loading: false });
    }
  },

  deleteTemplate: async (id) => {
    set({ loading: true });
    try {
      await vaccinationService.deleteTemplate(id);
      message.success("Đã xóa phác đồ");
      get().fetchTemplates();
    } catch (error) {
      message.error("Xóa thất bại");
    } finally {
      set({ loading: false });
    }
  },

  showForm: (record) => {
    if (record) {
      set({ viewMode: "form" });
      get().getTemplateDetails(record.id);
    } else {
      set({ viewMode: "form", editingTemplate: null });
    }
  },

  showList: () => set({ viewMode: "list", editingTemplate: null }),
}));
