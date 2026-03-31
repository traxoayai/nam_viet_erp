import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSafeRpc = vi.fn();
const mockGetUser = vi.fn();

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
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: {}, error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        ilike: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        not: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
        }),
      }),
    }),
    storage: { from: () => ({ upload: vi.fn(), getPublicUrl: vi.fn() }) },
    auth: { getUser: () => mockGetUser() },
    functions: { invoke: vi.fn() },
  },
}));
vi.mock("uuid", () => ({ v4: () => "mock-uuid" }));

import { inventoryService } from "@/features/inventory/api/inventoryService";

describe("inventoryService", () => {
  beforeEach(() => {
    mockSafeRpc.mockReset();
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
  });

  // --- createReceipt ---
  describe("createReceipt", () => {
    it("calls create_inventory_receipt with correct params", async () => {
      const payload = {
        po_id: 5,
        warehouse_id: 1,
        note: "Receipt note",
        items: [{ product_id: 10, quantity: 50, lot_number: "LOT-1", expiry_date: "2027-01" }],
      };
      mockSafeRpc.mockResolvedValue({ data: { id: 100 } });
      const result = await inventoryService.createReceipt(payload);
      expect(mockSafeRpc).toHaveBeenCalledWith("create_inventory_receipt", {
        p_po_id: 5,
        p_warehouse_id: 1,
        p_note: "Receipt note",
        p_items: payload.items,
      });
      expect(result).toEqual({ id: 100 });
    });
  });

  // --- updateProductLocation ---
  describe("updateProductLocation", () => {
    it("calls update_product_location with mapped params", async () => {
      mockSafeRpc.mockResolvedValue({ data: true });
      const result = await inventoryService.updateProductLocation(1, 10, {
        cabinet: "A", row: "2", slot: "5",
      });
      expect(mockSafeRpc).toHaveBeenCalledWith("update_product_location", {
        p_warehouse_id: 1,
        p_product_id: 10,
        p_cabinet: "A",
        p_row: "2",
        p_slot: "5",
      });
      expect(result).toBe(true);
    });

    it("defaults empty strings for missing location fields", async () => {
      mockSafeRpc.mockResolvedValue({ data: true });
      await inventoryService.updateProductLocation(1, 10, {});
      expect(mockSafeRpc).toHaveBeenCalledWith("update_product_location", {
        p_warehouse_id: 1,
        p_product_id: 10,
        p_cabinet: "",
        p_row: "",
        p_slot: "",
      });
    });
  });

  // --- getCheckSessions (getChecksList) ---
  describe("getCheckSessions", () => {
    it("calls get_inventory_checks_list with full params", async () => {
      mockSafeRpc.mockResolvedValue({ data: [{ id: 1 }] });
      const result = await inventoryService.getCheckSessions({
        warehouseId: 2,
        search: "KK-001",
        status: "in_progress",
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        page: 2,
        pageSize: 10,
      });
      expect(mockSafeRpc).toHaveBeenCalledWith("get_inventory_checks_list", {
        p_warehouse_id: 2,
        p_search: "KK-001",
        p_status: "in_progress",
        p_start_date: "2026-03-01",
        p_end_date: "2026-03-31",
        p_limit: 10,
        p_offset: 10, // (2-1)*10
      });
      expect(result).toEqual([{ id: 1 }]);
    });

    it("defaults page=1 and pageSize=20 when not provided", async () => {
      mockSafeRpc.mockResolvedValue({ data: [] });
      await inventoryService.getCheckSessions({});
      expect(mockSafeRpc).toHaveBeenCalledWith("get_inventory_checks_list", {
        p_warehouse_id: null,
        p_search: null,
        p_status: null,
        p_start_date: null,
        p_end_date: null,
        p_limit: 20,
        p_offset: 0,
      });
    });
  });

  // --- createCheckSession ---
  describe("createCheckSession", () => {
    it("calls create_inventory_check with user id from auth", async () => {
      mockSafeRpc.mockResolvedValue({ data: { id: 50 } });
      const result = await inventoryService.createCheckSession({
        warehouseId: 1,
        note: "Monthly check",
        scope: "ALL",
      });
      expect(mockSafeRpc).toHaveBeenCalledWith("create_inventory_check", {
        p_warehouse_id: 1,
        p_user_id: "user-123",
        p_note: "Monthly check",
        p_scope: "ALL",
        p_text_val: null,
        p_int_val: null,
      });
      expect(result).toEqual({ id: 50 });
    });
  });

  // --- getCabinets ---
  describe("getCabinets", () => {
    it("calls get_warehouse_cabinets and maps to names", async () => {
      mockSafeRpc.mockResolvedValue({ data: [{ cabinet_name: "A" }, { cabinet_name: "B" }] });
      const result = await inventoryService.getCabinets(1);
      expect(mockSafeRpc).toHaveBeenCalledWith("get_warehouse_cabinets", { p_warehouse_id: 1 });
      expect(result).toEqual(["A", "B"]);
    });
  });

  // --- cancelCheck ---
  describe("cancelCheck", () => {
    it("calls cancel_inventory_check with check id and user id", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      await inventoryService.cancelCheck(10);
      expect(mockSafeRpc).toHaveBeenCalledWith("cancel_inventory_check", {
        p_check_id: 10,
        p_user_id: "user-123",
      });
    });
  });

  // --- completeCheck ---
  describe("completeCheck", () => {
    it("calls complete_inventory_check with check id and user id", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      await inventoryService.completeCheck(15, "user-456");
      expect(mockSafeRpc).toHaveBeenCalledWith("complete_inventory_check", {
        p_check_id: 15,
        p_user_id: "user-456",
      });
    });
  });

  // --- addItemToCheck ---
  describe("addItemToCheck", () => {
    it("calls add_item_to_check_session with correct params", async () => {
      mockSafeRpc.mockResolvedValue({ data: { status: "success", item_id: 99 } });
      const result = await inventoryService.addItemToCheck(5, 20);
      expect(mockSafeRpc).toHaveBeenCalledWith("add_item_to_check_session", {
        p_check_id: 5,
        p_product_id: 20,
      });
      expect(result).toEqual({ status: "success", item_id: 99 });
    });
  });

  // --- getProductCardex ---
  describe("getProductCardex", () => {
    it("calls get_product_cardex with all params", async () => {
      mockSafeRpc.mockResolvedValue({ data: [{ type: "in", quantity: 100 }] });
      const result = await inventoryService.getProductCardex(10, 1, "2026-01-01", "2026-03-31");
      expect(mockSafeRpc).toHaveBeenCalledWith("get_product_cardex", {
        p_product_id: 10,
        p_warehouse_id: 1,
        p_from_date: "2026-01-01",
        p_to_date: "2026-03-31",
      });
      expect(result).toEqual([{ type: "in", quantity: 100 }]);
    });

    it("passes null for optional date params", async () => {
      mockSafeRpc.mockResolvedValue({ data: [] });
      await inventoryService.getProductCardex(10, 1);
      expect(mockSafeRpc).toHaveBeenCalledWith("get_product_cardex", {
        p_product_id: 10,
        p_warehouse_id: 1,
        p_from_date: null,
        p_to_date: null,
      });
    });

    it("returns empty array on error", async () => {
      mockSafeRpc.mockRejectedValue(new Error("fail"));
      const result = await inventoryService.getProductCardex(10, 1);
      expect(result).toEqual([]);
    });
  });
});
