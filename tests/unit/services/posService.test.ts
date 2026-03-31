import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSafeRpc = vi.fn();

vi.mock("@/shared/api/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));
vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));

import { posService } from "@/features/pos/api/posService";

describe("posService", () => {
  beforeEach(() => {
    mockSafeRpc.mockReset();
  });

  // --- searchProducts ---
  describe("searchProducts", () => {
    it("calls search_products_pos with keyword, warehouse, and limit", async () => {
      mockSafeRpc.mockResolvedValue({
        data: [{
          id: 1, name: "Panadol", sku: "PAN-001", retail_price: 5000,
          image_url: null, unit: "Vien", stock_quantity: 100, status: "active",
          location_cabinet: "A", location_row: "1", location_slot: "3",
          usage_instructions: {},
        }],
      });
      const result = await posService.searchProducts("Pan", 2);
      expect(mockSafeRpc).toHaveBeenCalledWith("search_products_pos", {
        p_keyword: "Pan",
        p_warehouse_id: 2,
        p_limit: 20,
      });
      expect(result[0].id).toBe(1);
      expect(result[0].location).toEqual({ cabinet: "A", row: "1", slot: "3" });
    });

    it("uses default warehouseId=1 when not specified", async () => {
      mockSafeRpc.mockResolvedValue({ data: [] });
      await posService.searchProducts("test");
      expect(mockSafeRpc).toHaveBeenCalledWith("search_products_pos", {
        p_keyword: "test",
        p_warehouse_id: 1,
        p_limit: 20,
      });
    });

    it("returns empty array for blank keyword without calling RPC", async () => {
      const result = await posService.searchProducts("  ");
      expect(mockSafeRpc).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("maps response fields correctly", async () => {
      mockSafeRpc.mockResolvedValue({
        data: [{
          id: 2, name: "Aspirin", sku: "ASP-01", retail_price: 3000,
          image_url: "img.jpg", unit: "Hop", stock_quantity: 50, status: "active",
          location_cabinet: null, location_row: null, location_slot: null,
          usage_instructions: { "0_2": "1 vien" },
        }],
      });
      const result = await posService.searchProducts("Asp");
      expect(result[0]).toMatchObject({
        id: 2, name: "Aspirin", sku: "ASP-01", retail_price: 3000,
        unit: "Hop", stock_quantity: 50,
        usage_instructions: { "0_2": "1 vien" },
      });
    });
  });

  // --- searchCustomers ---
  describe("searchCustomers", () => {
    it("calls search_customers_pos with keyword", async () => {
      mockSafeRpc.mockResolvedValue({ data: [{ id: 1, name: "Nguyen Van A", phone: "0901" }] });
      const result = await posService.searchCustomers("Nguyen");
      expect(mockSafeRpc).toHaveBeenCalledWith("search_customers_pos", { p_keyword: "Nguyen" });
      expect(result).toEqual([{ id: 1, name: "Nguyen Van A", phone: "0901" }]);
    });

    it("returns empty for blank keyword without calling RPC", async () => {
      const result = await posService.searchCustomers("  ");
      expect(mockSafeRpc).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("returns empty array on error", async () => {
      mockSafeRpc.mockRejectedValue(new Error("fail"));
      const result = await posService.searchCustomers("test");
      expect(result).toEqual([]);
    });
  });

  // --- getActiveWarehouses ---
  describe("getActiveWarehouses", () => {
    it("calls get_active_warehouses with no params", async () => {
      mockSafeRpc.mockResolvedValue({ data: [{ id: 1, name: "Kho Chinh" }] });
      const result = await posService.getActiveWarehouses();
      expect(mockSafeRpc).toHaveBeenCalledWith("get_active_warehouses");
      expect(result).toEqual([{ id: 1, name: "Kho Chinh" }]);
    });

    it("returns empty array on error", async () => {
      mockSafeRpc.mockRejectedValue(new Error("fail"));
      const result = await posService.getActiveWarehouses();
      expect(result).toEqual([]);
    });
  });

  // --- createOrder ---
  describe("createOrder", () => {
    it("passes payload directly to create_sales_order", async () => {
      const payload = { p_customer_id: 1, p_items: [], p_warehouse_id: 1 };
      mockSafeRpc.mockResolvedValue({ data: "uuid-abc-123" });
      const result = await posService.createOrder(payload);
      expect(mockSafeRpc).toHaveBeenCalledWith("create_sales_order", payload);
      expect(result).toBe("uuid-abc-123");
    });
  });
});
