import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSafeRpc = vi.fn();

vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: unknown[]) => mockSafeRpc(...args),
}));

const mockFrom = vi.fn();
vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { costAdjustmentService } from "@/features/inventory/api/costAdjustmentService";

describe("costAdjustmentService", () => {
  beforeEach(() => {
    mockSafeRpc.mockReset();
    mockFrom.mockReset();
  });

  describe("getValuationGrid", () => {
    it("calls get_batch_valuation_grid with defaults and silent", async () => {
      mockSafeRpc.mockResolvedValue({
        data: [{ batch_id: 1, total_count: 1 }],
      });

      const rows = await costAdjustmentService.getValuationGrid({});

      expect(mockSafeRpc).toHaveBeenCalledWith(
        "get_batch_valuation_grid",
        {
          p_warehouse_id: null,
          p_search: "",
          p_only_missing_price: false,
          p_limit: 50,
          p_offset: 0,
        },
        { silent: true }
      );
      expect(rows).toHaveLength(1);
    });

    it("forwards filters & pagination", async () => {
      mockSafeRpc.mockResolvedValue({ data: [] });

      await costAdjustmentService.getValuationGrid({
        warehouseId: 3,
        search: "para",
        onlyMissingPrice: true,
        limit: 20,
        offset: 40,
      });

      expect(mockSafeRpc).toHaveBeenCalledWith(
        "get_batch_valuation_grid",
        {
          p_warehouse_id: 3,
          p_search: "para",
          p_only_missing_price: true,
          p_limit: 20,
          p_offset: 40,
        },
        { silent: true }
      );
    });
  });

  describe("getTotalValue", () => {
    it("normalizes return shape", async () => {
      mockSafeRpc.mockResolvedValue({
        data: {
          total_value: "1500000",
          total_qty: 12,
          count_batches: 3,
          count_zero_price_batches: 1,
        },
      });

      const stats = await costAdjustmentService.getTotalValue(5);

      expect(mockSafeRpc).toHaveBeenCalledWith(
        "get_inventory_total_value",
        { p_warehouse_id: 5 },
        { silent: true }
      );
      expect(stats).toEqual({
        total_value: 1500000,
        total_qty: 12,
        count_batches: 3,
        count_zero_price_batches: 1,
      });
    });

    it("returns zero-defaults on empty response", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const stats = await costAdjustmentService.getTotalValue();
      expect(stats).toEqual({
        total_value: 0,
        total_qty: 0,
        count_batches: 0,
        count_zero_price_batches: 0,
      });
    });
  });

  describe("bulkUpdate", () => {
    it("short-circuits on empty changes", async () => {
      const r = await costAdjustmentService.bulkUpdate([], "data_fix");
      expect(r.status).toBe("error");
      expect(mockSafeRpc).not.toHaveBeenCalled();
    });

    it("calls bulk_update_batch_costs with reason & note", async () => {
      mockSafeRpc.mockResolvedValue({
        data: { status: "success", updated_count: 2 },
      });

      const r = await costAdjustmentService.bulkUpdate(
        [{ batch_id: 1, new_price: 22000 }],
        "supplier_adjust",
        "Credit note NCC"
      );

      expect(mockSafeRpc).toHaveBeenCalledWith("bulk_update_batch_costs", {
        p_changes: [{ batch_id: 1, new_price: 22000 }],
        p_reason: "supplier_adjust",
        p_note: "Credit note NCC",
      });
      expect(r.updated_count).toBe(2);
    });

    it("throws when RPC returns status=error", async () => {
      mockSafeRpc.mockResolvedValue({
        data: { status: "error", message: "Thiếu reason_code" },
      });

      await expect(
        costAdjustmentService.bulkUpdate(
          [{ batch_id: 1, new_price: 100 }],
          "data_fix"
        )
      ).rejects.toThrow("Thiếu reason_code");
    });
  });
});
