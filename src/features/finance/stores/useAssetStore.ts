// src/stores/useAssetStore.ts
import { create } from "zustand";

import * as service from "@/features/finance/api/assetService";
import { AssetStoreState } from "@/features/finance/types/asset";

export const useAssetStore = create<AssetStoreState>((set, get) => ({
  assets: [],
  assetTypes: [],
  currentAssetDetails: null,
  loading: false,
  loadingDetails: false,
  filters: {},
  totalCount: 0,

  fetchAssetTypes: async () => {
    try {
      const data = await service.fetchAssetTypes();
      set({ assetTypes: data });
    } catch (error) {
      console.error("Lỗi tải danh mục loại tài sản:", error);
    }
  },

  fetchAssets: async (newFilters: any) => {
    // Merge filter mới vào filter cũ
    const filters = { ...get().filters, ...newFilters };
    set({ loading: true, filters: filters }); // Cập nhật filters mới
    try {
      const { data, totalCount } = await service.fetchAssets(filters); // Gửi filter đã merge
      set({ assets: data, totalCount, loading: false });
    } catch (error) {
      console.error("Lỗi tải danh sách tài sản:", error);
      set({ loading: false });
      throw error;
    }
  },

  getAssetDetails: async (id: number) => {
    set({ loadingDetails: true, currentAssetDetails: null });
    try {
      const data = await service.fetchAssetDetails(id);
      set({ currentAssetDetails: data, loadingDetails: false });
    } catch (error) {
      console.error("Lỗi tải chi tiết tài sản:", error);
      set({ loadingDetails: false });
      throw error;
    }
  },

  createAsset: async (assetData, plans, history) => {
    set({ loading: true });
    try {
      const newId = await service.createAsset(assetData, plans, history);
      await get().fetchAssets(get().filters); // SỬA LỖI 3: Thêm đối số filters
      return newId;
    } catch (error) {
      console.error("Lỗi khi tạo tài sản:", error);
      set({ loading: false });
      throw error;
    }
  },

  updateAsset: async (id, assetData, plans, history) => {
    set({ loadingDetails: true });
    try {
      await service.updateAsset(id, assetData, plans, history);
      await get().fetchAssets(get().filters);
      set({ loadingDetails: false });
      return true;
    } catch (error) {
      console.error("Lỗi khi cập nhật tài sản:", error);
      set({ loadingDetails: false });
      throw error;
    }
  },

  deleteAsset: async (id: number) => {
    set({ loading: true });
    try {
      await service.deleteAsset(id);
      await get().fetchAssets(get().filters);
      return true;
    } catch (error) {
      console.error("Lỗi khi xóa tài sản:", error);
      set({ loading: false });
      throw error;
    }
  },
}));
