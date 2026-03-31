import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSafeRpc = vi.fn();

vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));
vi.mock("@/shared/api/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));
vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  },
}));
vi.mock("@/shared/api/storageService", () => ({
  uploadFile: vi.fn(),
}));

import {
  fetchAssets,
  fetchAssetDetails,
  createAsset,
  updateAsset,
  deleteAsset,
} from "@/features/finance/api/assetService";

describe("assetService", () => {
  beforeEach(() => {
    mockSafeRpc.mockReset();
  });

  // --- fetchAssets (getList) ---
  describe("fetchAssets", () => {
    it("calls get_assets_list with mapped filters", async () => {
      mockSafeRpc.mockResolvedValue({ data: [{ id: 1, name: "May in", total_count: 10 }] });
      const result = await fetchAssets({
        search_query: "May",
        asset_type_id: 2,
        branch_id: 1,
        status: "active",
      });
      expect(mockSafeRpc).toHaveBeenCalledWith("get_assets_list", {
        search_query: "May",
        type_filter: 2,
        branch_filter: 1,
        status_filter: "active",
      });
      expect(result.totalCount).toBe(10);
      expect(result.data).toHaveLength(1);
    });

    it("passes null for empty filters", async () => {
      mockSafeRpc.mockResolvedValue({ data: [] });
      await fetchAssets({});
      expect(mockSafeRpc).toHaveBeenCalledWith("get_assets_list", {
        search_query: null,
        type_filter: null,
        branch_filter: null,
        status_filter: null,
      });
    });

    it("returns 0 count when data is empty array", async () => {
      mockSafeRpc.mockResolvedValue({ data: [] });
      const result = await fetchAssets({});
      expect(result.totalCount).toBe(0);
    });

    it("returns 0 count when data is null", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await fetchAssets({});
      expect(result).toEqual({ data: [], totalCount: 0 });
    });
  });

  // --- fetchAssetDetails (getDetails) ---
  describe("fetchAssetDetails", () => {
    it("calls get_asset_details with p_id", async () => {
      mockSafeRpc.mockResolvedValue({ data: { id: 5, name: "May Tinh", purchase_price: 15000000 } });
      const result = await fetchAssetDetails(5);
      expect(mockSafeRpc).toHaveBeenCalledWith("get_asset_details", { p_id: 5 });
      expect(result).toEqual({ id: 5, name: "May Tinh", purchase_price: 15000000 });
    });
  });

  // --- createAsset (create) ---
  describe("createAsset", () => {
    it("calls create_asset with data, plans, and history", async () => {
      const assetData = { name: "May in HP", purchase_price: 5000000 } as any;
      const plans = [{ schedule: "monthly", description: "Clean" }] as any[];
      const history = [{ date: "2026-01-15", description: "Initial check" }] as any[];
      mockSafeRpc.mockResolvedValue({ data: 99 });
      const result = await createAsset(assetData, plans, history);
      expect(mockSafeRpc).toHaveBeenCalledWith("create_asset", {
        p_asset_data: assetData,
        p_maintenance_plans: plans,
        p_maintenance_history: history,
      });
      expect(result).toBe(99);
    });
  });

  // --- updateAsset (update) ---
  describe("updateAsset", () => {
    it("calls update_asset with id, data, plans, and history", async () => {
      const assetData = { name: "Updated Asset" } as any;
      const plans: any[] = [];
      const history: any[] = [];
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await updateAsset(5, assetData, plans, history);
      expect(mockSafeRpc).toHaveBeenCalledWith("update_asset", {
        p_id: 5,
        p_asset_data: assetData,
        p_maintenance_plans: plans,
        p_maintenance_history: history,
      });
      expect(result).toBe(true);
    });
  });

  // --- deleteAsset (delete) ---
  describe("deleteAsset", () => {
    it("calls delete_asset with p_id", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await deleteAsset(5);
      expect(mockSafeRpc).toHaveBeenCalledWith("delete_asset", { p_id: 5 });
      expect(result).toBe(true);
    });
  });
});
