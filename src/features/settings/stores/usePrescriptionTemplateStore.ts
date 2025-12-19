import { message } from "antd";
import { create } from "zustand";

import { prescriptionTemplateService } from "@/features/settings/api/prescriptionTemplateService";
import {
  PrescriptionTemplate,
  PrescriptionTemplateItem,
  PrescriptionTemplateInput,
} from "@/features/settings/types/prescriptionTemplate";

interface StoreState {
  templates: PrescriptionTemplate[];
  loading: boolean;
  // Cấu trúc này khác với Mock một chút để chứa cả items chi tiết
  editingTemplate: {
    data: PrescriptionTemplate;
    items: PrescriptionTemplateItem[];
  } | null;
  viewMode: "list" | "form";

  fetchTemplates: (search?: string, status?: string) => Promise<void>;
  getTemplateDetails: (id: number) => Promise<void>;
  createTemplate: (
    data: PrescriptionTemplateInput,
    items: any[]
  ) => Promise<boolean>;
  updateTemplate: (
    id: number,
    data: PrescriptionTemplateInput,
    items: any[]
  ) => Promise<boolean>;
  deleteTemplate: (id: number) => Promise<void>;

  showForm: (record?: PrescriptionTemplate) => void;
  showList: () => void;
}

export const usePrescriptionTemplateStore = create<StoreState>((set, get) => ({
  templates: [],
  loading: false,
  editingTemplate: null,
  viewMode: "list",

  fetchTemplates: async (search = "", status = "") => {
    set({ loading: true });
    try {
      const data = await prescriptionTemplateService.getTemplates(
        search,
        status || undefined
      );
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
        await prescriptionTemplateService.getTemplateDetails(id);
      set({ editingTemplate: { data: template, items }, loading: false });
    } catch (error) {
      message.error("Lỗi tải chi tiết đơn mẫu");
      set({ loading: false });
    }
  },

  createTemplate: async (data, items) => {
    set({ loading: true });
    try {
      await prescriptionTemplateService.createTemplate(data, items);
      message.success("Tạo đơn mẫu thành công");
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
      await prescriptionTemplateService.updateTemplate(id, data, items);
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
    try {
      await prescriptionTemplateService.deleteTemplate(id);
      message.success("Đã xóa đơn mẫu");
      get().fetchTemplates();
    } catch (error) {
      message.error("Xóa thất bại");
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
