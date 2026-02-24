// src/stores/useServicePackageStore.ts
import { message } from "antd";
import { create } from "zustand";

import { servicePackageService } from "@/features/marketing/api/servicePackageService";
import {
  ServicePackageRecord,
  ServicePackageInput,
  ServicePackageItemInput,
} from "@/features/marketing/types/servicePackage";

interface StoreState {
  packages: ServicePackageRecord[];
  loading: boolean;
  totalCount: number;
  viewMode: "list" | "form";
  editingPackage: any | null; // Sẽ là ServicePackageDetail

  // Actions
  fetchPackages: (params?: any) => Promise<void>;
  createPackage: (
    data: ServicePackageInput,
    items: ServicePackageItemInput[]
  ) => Promise<boolean>;
  updatePackage: (
    id: number,
    data: ServicePackageInput,
    items: ServicePackageItemInput[]
  ) => Promise<boolean>;
  deletePackage: (id: number) => Promise<boolean>;
  deletePackages: (ids: number[]) => Promise<boolean>; // [NEW]
  updateStatus: (
    ids: number[],
    status: "active" | "inactive"
  ) => Promise<boolean>; // [NEW]
  getPackageDetails: (id: number) => Promise<void>;
  calculateCost: (items: ServicePackageItemInput[]) => Promise<number>;

  // UI Actions
  showForm: (record?: ServicePackageRecord) => void;
  showList: () => void;
}

export const useServicePackageStore = create<StoreState>((set, get) => ({
  packages: [],
  loading: false,
  totalCount: 0,
  viewMode: "list",
  editingPackage: null,

  fetchPackages: async (params = {}) => {
    set({ loading: true });
    try {
      const { data, totalCount } =
        await servicePackageService.fetchPackages(params);
      set({ packages: data, totalCount, loading: false });
    } catch (error) {
      console.error(error);
      set({ loading: false });
    }
  },

  getPackageDetails: async (id) => {
    set({ loading: true });
    try {
      const data = await servicePackageService.getPackageDetails(id);
      set({ editingPackage: data, loading: false });
    } catch (error) {
      console.error(error);
      set({ loading: false });
    }
  },

  createPackage: async (data, items) => {
    set({ loading: true });
    try {
      await servicePackageService.createPackage(data, items);
      message.success("Tạo gói thành công!");
      get().fetchPackages();
      return true;
    } catch (error) {
      console.error(error);
      message.error("Tạo thất bại");
      return false;
    } finally {
      set({ loading: false });
    }
  },

  updatePackage: async (id, data, items) => {
    set({ loading: true });
    try {
      await servicePackageService.updatePackage(id, data, items);
      message.success("Cập nhật thành công!");
      get().fetchPackages();
      return true;
    } catch (error) {
      message.error("Cập nhật thất bại");
      return false;
    } finally {
      set({ loading: false });
    }
  },

  deletePackage: async (id) => {
    set({ loading: true });
    try {
      await servicePackageService.deletePackage([id]); // Update service to accept array
      message.success("Đã xóa gói dịch vụ");
      get().fetchPackages();
      return true;
    } catch (error) {
      message.error("Xóa thất bại");
      return false;
    } finally {
      set({ loading: false });
    }
  },

  deletePackages: async (ids) => {
    set({ loading: true });
    try {
      await servicePackageService.deletePackage(ids);
      message.success(`Đã xóa ${ids.length} gói dịch vụ`);
      get().fetchPackages();
      return true;
    } catch (error) {
      message.error("Xóa thất bại");
      return false;
    } finally {
      set({ loading: false });
    }
  },

  updateStatus: async (ids, status) => {
    set({ loading: true });
    try {
      await servicePackageService.updatePackagesStatus(ids, status);
      message.success(`Đã cập nhật trạng thái ${ids.length} gói`);
      get().fetchPackages();
      return true;
    } catch (error) {
      message.error("Cập nhật trạng thái thất bại");
      return false;
    } finally {
      set({ loading: false });
    }
  },

  calculateCost: async (items) => {
    // Gọi service tính giá
    return await servicePackageService.calculateCost(items);
  },

  showForm: (record) => {
    if (record) {
      set({ viewMode: "form", editingPackage: null }); // Reset trước
      get().getPackageDetails(record.id);
    } else {
      set({ viewMode: "form", editingPackage: null });
    }
  },

  showList: () => {
    set({ viewMode: "list", editingPackage: null });
  },
}));
