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
    from: () => ({
      update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      delete: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      select: () => ({ eq: () => ({ single: vi.fn() }), in: vi.fn().mockResolvedValue({ data: [], error: null }) }),
    }),
  },
}));

import { salesService } from "@/features/sales/api/salesService";

describe("salesService", () => {
  beforeEach(() => {
    mockSafeRpc.mockReset();
  });

  // --- searchCustomers ---
  describe("searchCustomers", () => {
    it("calls search_customers_b2b_v2 with keyword", async () => {
      mockSafeRpc.mockResolvedValue({ data: [{ id: 1, name: "ABC Corp" }] });
      const result = await salesService.searchCustomers("ABC");
      expect(mockSafeRpc).toHaveBeenCalledWith("search_customers_b2b_v2", { p_keyword: "ABC" });
      expect(result).toEqual([{ id: 1, name: "ABC Corp" }]);
    });

    it("returns empty array when data is null", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await salesService.searchCustomers("");
      expect(result).toEqual([]);
    });

    it("returns empty array on error", async () => {
      mockSafeRpc.mockRejectedValue(new Error("fail"));
      const result = await salesService.searchCustomers("test");
      expect(result).toEqual([]);
    });
  });

  // --- getShippingPartners ---
  describe("getShippingPartners", () => {
    it("calls get_active_shipping_partners with no params", async () => {
      mockSafeRpc.mockResolvedValue({ data: [{ id: 1, name: "GHTK" }] });
      const result = await salesService.getShippingPartners();
      expect(mockSafeRpc).toHaveBeenCalledWith("get_active_shipping_partners");
      expect(result).toEqual([{ id: 1, name: "GHTK" }]);
    });

    it("returns empty array on error", async () => {
      mockSafeRpc.mockRejectedValue(new Error("fail"));
      const result = await salesService.getShippingPartners();
      expect(result).toEqual([]);
    });
  });

  // --- getVouchers ---
  describe("getVouchers", () => {
    it("calls get_available_vouchers with customer and total", async () => {
      mockSafeRpc.mockResolvedValue({ data: [{ id: 1, code: "V50K" }] });
      const result = await salesService.getVouchers(10, 500000);
      expect(mockSafeRpc).toHaveBeenCalledWith("get_available_vouchers", {
        p_customer_id: 10,
        p_order_total: 500000,
      });
      expect(result).toEqual([{ id: 1, code: "V50K" }]);
    });
  });

  // --- createOrder ---
  describe("createOrder", () => {
    it("passes payload directly to create_sales_order", async () => {
      const payload = {
        p_customer_id: 5,
        p_items: [{ product_id: 1, quantity: 2 }],
        p_delivery_method: "self",
      } as any;
      mockSafeRpc.mockResolvedValue({ data: "uuid-123" });
      const result = await salesService.createOrder(payload);
      expect(mockSafeRpc).toHaveBeenCalledWith("create_sales_order", payload);
      expect(result).toBe("uuid-123");
    });
  });

  // --- updateOrder ---
  describe("updateOrder", () => {
    it("calls update_sales_order with payload and returns true", async () => {
      const payload = {
        p_order_id: "uuid-1",
        p_customer_id: 5,
        p_delivery_address: "123 Main",
        p_delivery_time: "2026-04-01",
        p_note: "note",
        p_discount_amount: 0,
        p_shipping_fee: 0,
        p_items: [],
      };
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await salesService.updateOrder(payload);
      expect(mockSafeRpc).toHaveBeenCalledWith("update_sales_order", payload);
      expect(result).toBe(true);
    });
  });

  // --- getOrders (getOrdersView) ---
  describe("getOrders", () => {
    it("calls get_sales_orders_view with mapped params", async () => {
      mockSafeRpc.mockResolvedValue({
        data: { data: [{ id: 1 }], total: 1, stats: { total_sales: 100 } },
      });
      const result = await salesService.getOrders({
        page: 1,
        pageSize: 20,
        search: "SO-001",
        status: "CONFIRMED",
        orderType: "B2B",
      });
      expect(mockSafeRpc).toHaveBeenCalledWith("get_sales_orders_view", {
        p_page: 1,
        p_page_size: 20,
        p_search: "SO-001",
        p_status: "CONFIRMED",
        p_order_type: "B2B",
        p_remittance_status: undefined,
        p_date_from: undefined,
        p_date_to: undefined,
        p_creator_id: undefined,
        p_payment_status: undefined,
        p_invoice_status: undefined,
        p_payment_method: undefined,
        p_warehouse_id: undefined,
        p_customer_id: undefined,
      });
      expect(result.data).toEqual([{ id: 1 }]);
      expect(result.total).toBe(1);
    });

    it("returns defaults when data is null", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await salesService.getOrders({ page: 1, pageSize: 10 });
      expect(result).toEqual({
        data: [],
        total: 0,
        stats: { total_sales: 0, count_pending_remittance: 0, total_cash_pending: 0 },
      });
    });

    it("returns empty on error", async () => {
      mockSafeRpc.mockRejectedValue(new Error("fail"));
      const result = await salesService.getOrders({ page: 1, pageSize: 10 });
      expect(result).toEqual({ data: [], total: 0, stats: {} });
    });
  });

  // --- confirmPayment ---
  describe("confirmPayment", () => {
    it("calls confirm_order_payment with order ids and fund account", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await salesService.confirmPayment(["uuid-1", "uuid-2"], 3);
      expect(mockSafeRpc).toHaveBeenCalledWith("confirm_order_payment", {
        p_order_ids: ["uuid-1", "uuid-2"],
        p_fund_account_id: 3,
      });
      expect(result).toBe(true);
    });
  });
});
