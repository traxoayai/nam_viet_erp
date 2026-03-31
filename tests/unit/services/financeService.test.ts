import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSafeRpc = vi.fn();

vi.mock("@/shared/api/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));
vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));
vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { actual_current_debt: 500000 }, error: null }),
        }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
        not: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  },
}));
vi.mock("@/shared/constants/defaults", () => ({
  DEFAULT_WAREHOUSE_ID: 1,
}));

import { financeService } from "@/features/finance/api/financeService";

describe("financeService", () => {
  beforeEach(() => {
    mockSafeRpc.mockReset();
  });

  // --- searchCustomersB2C ---
  describe("searchCustomersB2C", () => {
    it("calls search_customers_pos with keyword, limit, and default warehouse", async () => {
      mockSafeRpc.mockResolvedValue({ data: [{ id: 1, name: "KH B2C" }] });
      const result = await financeService.searchCustomersB2C("test");
      expect(mockSafeRpc).toHaveBeenCalledWith("search_customers_pos", {
        p_keyword: "test",
        p_limit: 20,
        p_warehouse_id: 1,
      });
      expect(result).toEqual([{ id: 1, name: "KH B2C" }]);
    });

    it("returns empty array when data is null", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await financeService.searchCustomersB2C("");
      expect(result).toEqual([]);
    });
  });

  // --- searchCustomersB2B ---
  describe("searchCustomersB2B", () => {
    it("calls search_customers_b2b_v2 with keyword", async () => {
      mockSafeRpc.mockResolvedValue({ data: [{ id: 2, name: "Corp B2B" }] });
      const result = await financeService.searchCustomersB2B("Corp");
      expect(mockSafeRpc).toHaveBeenCalledWith("search_customers_b2b_v2", { p_keyword: "Corp" });
      expect(result).toEqual([{ id: 2, name: "Corp B2B" }]);
    });
  });

  // --- processBulkPayment ---
  describe("processBulkPayment", () => {
    it("passes payload directly to process_bulk_payment", async () => {
      const payload = {
        p_customer_id: 10,
        p_total_amount: 1000000,
        p_allocations: [{ order_id: "uuid-1", allocated_amount: 500000 }],
        p_fund_account_id: 1,
        p_description: "Gach no thang 3",
      };
      mockSafeRpc.mockResolvedValue({ data: { success: true } });
      const result = await financeService.processBulkPayment(payload);
      expect(mockSafeRpc).toHaveBeenCalledWith("process_bulk_payment", payload);
      expect(result).toEqual({ success: true });
    });
  });

  // --- getPartnerDebt ---
  describe("getPartnerDebt", () => {
    it("calls get_partner_debt_live for non-B2B types", async () => {
      mockSafeRpc.mockResolvedValue({ data: 250000 });
      const result = await financeService.getPartnerDebt(5, "supplier");
      expect(mockSafeRpc).toHaveBeenCalledWith("get_partner_debt_live", {
        p_partner_id: 5,
        p_partner_type: "supplier",
      });
      expect(result).toBe(250000);
    });

    it("returns 0 when data is null/falsy for non-B2B", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await financeService.getPartnerDebt(5, "customer_b2c");
      expect(result).toBe(0);
    });
  });

  // --- getTransactions ---
  describe("getTransactions", () => {
    it("calls get_transactions with mapped params", async () => {
      mockSafeRpc.mockResolvedValue({
        data: [{ id: 1, full_count: 50, amount: 100000 }],
      });
      const result = await financeService.getTransactions({
        page: 1,
        pageSize: 20,
        search: "PT-001",
        flow: "inflow",
        status: "completed",
        date_from: "2026-03-01",
        date_to: "2026-03-31",
        creatorId: "user-uuid",
      });
      expect(mockSafeRpc).toHaveBeenCalledWith("get_transactions", {
        p_page: 1,
        p_page_size: 20,
        p_search: "PT-001",
        p_flow: "inflow",
        p_status: "completed",
        p_date_from: "2026-03-01",
        p_date_to: "2026-03-31",
        p_creator_id: "user-uuid",
      });
      expect(result.totalCount).toBe(50);
      expect(result.data).toHaveLength(1);
    });

    it("returns empty data and 0 count when data is null", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await financeService.getTransactions({ page: 1, pageSize: 10 });
      expect(result).toEqual({ data: [], totalCount: 0 });
    });

    it("passes null for optional empty params", async () => {
      mockSafeRpc.mockResolvedValue({ data: [] });
      await financeService.getTransactions({ page: 1, pageSize: 10 });
      expect(mockSafeRpc).toHaveBeenCalledWith("get_transactions", {
        p_page: 1,
        p_page_size: 10,
        p_search: null,
        p_flow: null,
        p_status: null,
        p_date_from: null,
        p_date_to: null,
        p_creator_id: null,
      });
    });
  });
});
