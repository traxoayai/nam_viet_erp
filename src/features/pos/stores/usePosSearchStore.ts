// src/features/pos/stores/usePosSearchStore.ts
import { create } from "zustand";
import { posService } from "../api/posService";
import { PosProductSearchResult } from "../types/pos.types";

interface PosSearchState {
  keyword: string;
  results: PosProductSearchResult[];
  loading: boolean;
  setKeyword: (kw: string) => void;
  searchProducts: (warehouseId: number) => Promise<void>;
  clearResults: () => void;
}

export const usePosSearchStore = create<PosSearchState>((set, get) => ({
  keyword: "",
  results: [],
  loading: false,
  setKeyword: (kw) => set({ keyword: kw }),
  searchProducts: async (warehouseId) => {
    const { keyword } = get();
    if (!keyword.trim()) {
        set({ results: [] });
        return;
    }
    set({ loading: true });
    try {
      const data = await posService.searchProducts(keyword, warehouseId);
      set({ results: data });
    } catch (error) {
      set({ results: [] });
    } finally {
      set({ loading: false });
    }
  },
  clearResults: () => set({ results: [], keyword: "" })
}));
