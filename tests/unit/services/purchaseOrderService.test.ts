import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mock
const mockSafeRpc = vi.fn();

vi.mock("@/shared/api/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));
vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));
vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: () => ({ delete: () => ({ in: vi.fn() }), update: () => ({ in: vi.fn() }), select: () => ({ eq: vi.fn() }) }),
    storage: { from: () => ({ upload: vi.fn(), getPublicUrl: vi.fn() }) },
    auth: { getUser: vi.fn() },
  },
}));
vi.mock("dayjs", () => {
  const d = (val?: any) => ({
    format: () => "2026-03-25",
    toISOString: () => "2026-03-25T00:00:00.000Z",
  });
  d.default = d;
  return { default: d };
});

import { purchaseOrderService } from "@/features/purchasing/api/purchaseOrderService";

describe("purchaseOrderService", () => {
  beforeEach(() => {
    mockSafeRpc.mockReset();
  });

  // --- getPOs ---
  describe("getPOs", () => {
    it("calls get_purchase_orders_master with correct params", async () => {
      mockSafeRpc.mockResolvedValue({ data: [{ id: 1, full_count: 5 }] });
      await purchaseOrderService.getPOs({ search: "test", delivery_status: "PENDING" }, 2, 10);
      expect(mockSafeRpc).toHaveBeenCalledWith("get_purchase_orders_master", {
        p_page: 2,
        p_page_size: 10,
        p_search: "test",
        p_status_delivery: "PENDING",
        p_status_payment: null,
        p_date_from: null,
        p_date_to: null,
      });
    });

    it("returns data and totalCount from full_count", async () => {
      mockSafeRpc.mockResolvedValue({ data: [{ id: 1, full_count: 42 }] });
      const result = await purchaseOrderService.getPOs({}, 1, 20);
      expect(result.totalCount).toBe(42);
      expect(result.data).toHaveLength(1);
    });

    it("returns empty array and 0 count when data is null", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await purchaseOrderService.getPOs({}, 1, 20);
      expect(result).toEqual({ data: [], totalCount: 0 });
    });
  });

  // --- getPODetail ---
  describe("getPODetail", () => {
    it("calls get_purchase_order_detail with p_po_id", async () => {
      mockSafeRpc.mockResolvedValue({ data: { id: 5, code: "PO-001" } });
      const result = await purchaseOrderService.getPODetail(5);
      expect(mockSafeRpc).toHaveBeenCalledWith("get_purchase_order_detail", { p_po_id: 5 });
      expect(result).toEqual({ id: 5, code: "PO-001" });
    });
  });

  // --- createPO ---
  describe("createPO", () => {
    it("maps payload to RPC params correctly", async () => {
      mockSafeRpc.mockResolvedValue({ data: { id: 10, code: "PO-NEW" } });
      await purchaseOrderService.createPO({
        supplier_id: 3,
        expected_date: "2026-04-01",
        note: "Test note",
        delivery_method: "partner_shipping",
        shipping_partner_id: 7,
        shipping_fee: 50000,
        status: "DRAFT",
        items: [
          { product_id: 1, quantity: 10, unit_price: 5000, unit: "Hop", is_bonus: false, bonus_quantity: 0 },
        ],
      });
      expect(mockSafeRpc).toHaveBeenCalledWith("create_purchase_order", {
        p_supplier_id: 3,
        p_expected_date: "2026-04-01",
        p_note: "Test note",
        p_delivery_method: "partner_shipping",
        p_shipping_partner_id: 7,
        p_shipping_fee: 50000,
        p_status: "DRAFT",
        p_items: [
          { product_id: 1, quantity: 10, unit_price: 5000, unit: "Hop", is_bonus: false, bonus_quantity: 0 },
        ],
      });
    });

    it("returns created PO data", async () => {
      mockSafeRpc.mockResolvedValue({ data: { id: 10, code: "PO-NEW", status: "DRAFT", message: "ok" } });
      const result = await purchaseOrderService.createPO({
        supplier_id: 1, status: "DRAFT", items: [],
      });
      expect(result).toEqual({ id: 10, code: "PO-NEW", status: "DRAFT", message: "ok" });
    });

    it("sends 0 when shipping_partner_id is undefined", async () => {
      mockSafeRpc.mockResolvedValue({ data: { id: 11, code: "PO-INT" } });
      await purchaseOrderService.createPO({
        supplier_id: 1,
        delivery_method: "internal",
        status: "DRAFT",
        items: [{ product_id: 1, quantity: 5, unit_price: 1000, unit: "Hop" }],
      });
      const call = mockSafeRpc.mock.calls[0];
      expect(call[1].p_shipping_partner_id).toBe(0);
    });

    it("sends current ISO date when expected_date is undefined (prevents PG timestamptz cast error)", async () => {
      mockSafeRpc.mockResolvedValue({ data: { id: 13, code: "PO-NODATE" } });
      await purchaseOrderService.createPO({
        supplier_id: 1,
        status: "DRAFT",
        items: [],
      });
      const call = mockSafeRpc.mock.calls[0];
      // Should be a valid ISO date string, not null or empty
      expect(typeof call[1].p_expected_date).toBe("string");
      expect(call[1].p_expected_date.length).toBeGreaterThan(0);
    });

    it("sends 0 when shipping_partner_id is 0", async () => {
      mockSafeRpc.mockResolvedValue({ data: { id: 12, code: "PO-ZERO" } });
      await purchaseOrderService.createPO({
        supplier_id: 1,
        shipping_partner_id: 0,
        status: "DRAFT",
        items: [],
      });
      const call = mockSafeRpc.mock.calls[0];
      expect(call[1].p_shipping_partner_id).toBe(0);
    });
  });

  // --- confirmPO ---
  describe("confirmPO", () => {
    it("calls confirm_purchase_order with id and PENDING status", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await purchaseOrderService.confirmPO(5);
      expect(mockSafeRpc).toHaveBeenCalledWith("confirm_purchase_order", {
        p_po_id: 5,
        p_status: "PENDING",
      });
      expect(result).toBe(true);
    });
  });

  // --- deletePO ---
  describe("deletePO", () => {
    it("calls delete_purchase_order with p_id", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await purchaseOrderService.deletePO(9);
      expect(mockSafeRpc).toHaveBeenCalledWith("delete_purchase_order", { p_id: 9 });
      expect(result).toBe(true);
    });
  });

  // --- cancelPO ---
  describe("cancelPO", () => {
    it("calls cancel_purchase_order with p_po_id", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await purchaseOrderService.cancelPO(12);
      expect(mockSafeRpc).toHaveBeenCalledWith("cancel_purchase_order", { p_po_id: 12 });
      expect(result).toBe(true);
    });
  });

  // --- updatePO ---
  describe("updatePO", () => {
    it("sends null (not undefined) when shipping_partner_id is missing", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      await purchaseOrderService.updatePO(5, {
        supplier_id: 1,
        delivery_method: "internal",
        note: "",
        status: "DRAFT",
      }, [{ product_id: 1, quantity: 10, uom: "Hop", unit_price: 5000 }]);
      const call = mockSafeRpc.mock.calls[0];
      expect(call[1].p_shipping_partner_id).toBeNull();
    });

    it("preserves valid shipping_partner_id when provided", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      await purchaseOrderService.updatePO(5, {
        supplier_id: 1,
        shipping_partner_id: 7,
        status: "DRAFT",
      }, [{ product_id: 1, quantity: 10, uom: "Hop", unit_price: 5000 }]);
      const call = mockSafeRpc.mock.calls[0];
      expect(call[1].p_shipping_partner_id).toBe(7);
    });
  });

  // --- confirmCosting ---
  describe("confirmCosting", () => {
    it("calls confirm_purchase_costing with correct payload", async () => {
      mockSafeRpc.mockResolvedValue({ data: { success: true, rebate_earned: 0 } });
      const payload = {
        p_po_id: 10,
        p_total_shipping_fee: 30000,
        p_items_data: [
          {
            id: 1,
            product_id: 100,
            final_unit_cost: 99000,
            rebate_rate: 0,
            vat_rate: 0,
            quantity_received: 40,
            bonus_quantity: 0,
          },
        ],
        p_gifts_data: [],
      };
      const result = await purchaseOrderService.confirmCosting(payload);
      expect(mockSafeRpc).toHaveBeenCalledWith("confirm_purchase_costing", payload);
      expect(result).toEqual({ success: true, rebate_earned: 0 });
    });

    it("sends shipping fee as metadata (not added to final_amount by frontend)", async () => {
      mockSafeRpc.mockResolvedValue({ data: { success: true } });
      const payload = {
        p_po_id: 10,
        p_total_shipping_fee: 50000,
        p_items_data: [
          {
            id: 1,
            product_id: 100,
            final_unit_cost: 105000, // includes allocated shipping in unit cost
            rebate_rate: 0,
            vat_rate: 0,
            quantity_received: 40,
            bonus_quantity: 0,
          },
        ],
        p_gifts_data: [],
      };
      await purchaseOrderService.confirmCosting(payload);
      // Verify shipping fee is passed as-is, RPC handles it
      const call = mockSafeRpc.mock.calls[0];
      expect(call[1].p_total_shipping_fee).toBe(50000);
    });

    it("includes gifts data in payload", async () => {
      mockSafeRpc.mockResolvedValue({ data: { success: true } });
      const payload = {
        p_po_id: 10,
        p_total_shipping_fee: 0,
        p_items_data: [],
        p_gifts_data: [
          { name: "Qua tang", code: "GIFT-001", quantity: 1, estimated_value: 0, unit_name: "Cai" },
        ],
      };
      await purchaseOrderService.confirmCosting(payload);
      expect(mockSafeRpc.mock.calls[0][1].p_gifts_data).toHaveLength(1);
      expect(mockSafeRpc.mock.calls[0][1].p_gifts_data[0].name).toBe("Qua tang");
    });
  });

  // --- updateLogistics ---
  describe("updateLogistics", () => {
    it("calls update_purchase_order_logistics with correct params", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await purchaseOrderService.updateLogistics(7, {
        delivery_method: "partner_shipping",
        shipping_partner_id: 2,
        shipping_fee: 30000,
        total_packages: 5,
        expected_delivery_date: "2026-04-10",
        note: "Fragile",
      });
      expect(mockSafeRpc).toHaveBeenCalledWith("update_purchase_order_logistics", {
        p_po_id: 7,
        p_delivery_method: "partner_shipping",
        p_shipping_partner_id: 2,
        p_shipping_fee: 30000,
        p_total_packages: 5,
        p_expected_delivery_date: "2026-04-10",
        p_note: "Fragile",
      });
      expect(result).toBe(true);
    });

    it("passes null/empty defaults for missing fields", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      await purchaseOrderService.updateLogistics(7, {});
      expect(mockSafeRpc).toHaveBeenCalledWith("update_purchase_order_logistics", {
        p_po_id: 7,
        p_delivery_method: null,
        p_shipping_partner_id: null,
        p_shipping_fee: null,
        p_total_packages: null,
        p_expected_delivery_date: null,
        p_note: "",
      });
    });
  });
});
