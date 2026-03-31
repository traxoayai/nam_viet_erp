import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks (available inside vi.mock factories) ---
const { mockSafeRpc, mockMessage, mockSupabaseFrom } = vi.hoisted(() => ({
  mockSafeRpc: vi.fn(),
  mockMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
  mockSupabaseFrom: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}));

vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));

vi.mock("antd", () => ({
  message: mockMessage,
}));

vi.mock("xlsx", () => ({
  utils: { json_to_sheet: vi.fn(), book_new: vi.fn(), book_append_sheet: vi.fn() },
  writeFile: vi.fn(),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: (...args: any[]) => mockSupabaseFrom(...args),
  },
}));

// Mock financeService used by fetchTransactions
vi.mock("@/features/finance/api/financeService", () => ({
  financeService: {
    getTransactions: vi.fn().mockResolvedValue({ data: [], totalCount: 0 }),
  },
}));

// --- Import store AFTER mocks ---
import { useFinanceStore } from "@/features/finance/stores/useFinanceStore";

describe("useFinanceStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFinanceStore.setState({
      transactions: [],
      funds: [],
      openAdvances: [],
      loading: false,
      totalCount: 0,
      page: 1,
      pageSize: 10,
      filters: {},
    });
  });

  describe("createTransaction", () => {
    it("calls safeRpc with 'create_finance_transaction' and the payload", async () => {
      mockSafeRpc.mockResolvedValue({ data: { id: 1 } });

      const payload = {
        p_flow: "out" as const,
        p_business_type: "advance",
        p_amount: 5000000,
        p_fund_account_id: 1,
        p_partner_id: "user-123",
        p_description: "Tam ung",
      };

      await useFinanceStore.getState().createTransaction(payload as any);

      expect(mockSafeRpc).toHaveBeenCalledWith(
        "create_finance_transaction",
        payload
      );
    });

    it("shows success message on success", async () => {
      mockSafeRpc.mockResolvedValue({ data: { id: 1 } });

      await useFinanceStore.getState().createTransaction({} as any);

      expect(mockMessage.success).toHaveBeenCalledWith("Lập phiếu thành công!");
    });

    it("shows error message on failure", async () => {
      mockSafeRpc.mockRejectedValue(new Error("DB error"));

      const result = await useFinanceStore.getState().createTransaction({} as any);

      expect(result).toBe(false);
      expect(mockMessage.error).toHaveBeenCalledWith("Lỗi: DB error");
    });

    it("updates ref_advance_id status when p_ref_advance_id is provided", async () => {
      mockSafeRpc.mockResolvedValue({ data: { id: 2 } });

      const payload = {
        p_flow: "in" as const,
        p_business_type: "settlement",
        p_amount: 3000000,
        p_ref_advance_id: 10,
      };

      await useFinanceStore.getState().createTransaction(payload as any);

      // Verify supabase.from was called to update the old advance
      expect(mockSupabaseFrom).toHaveBeenCalledWith("finance_transactions");
    });
  });

  describe("confirmTransaction", () => {
    it("calls safeRpc with 'confirm_finance_transaction' for approved status", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });

      useFinanceStore.setState({
        transactions: [{ id: 7, status: "pending" } as any],
      });

      await useFinanceStore.getState().confirmTransaction(7, "approved");

      expect(mockSafeRpc).toHaveBeenCalledWith("confirm_finance_transaction", {
        p_id: 7,
        p_target_status: "approved",
      });
    });

    it("calls safeRpc with 'confirm_finance_transaction' for completed status", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });

      useFinanceStore.setState({
        transactions: [{ id: 15, status: "approved" } as any],
      });

      await useFinanceStore.getState().confirmTransaction(15, "completed");

      expect(mockSafeRpc).toHaveBeenCalledWith("confirm_finance_transaction", {
        p_id: 15,
        p_target_status: "completed",
      });
    });

    it("updates transaction status in state on success", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });

      useFinanceStore.setState({
        transactions: [
          { id: 7, status: "pending", flow: "out" } as any,
          { id: 8, status: "pending", flow: "in" } as any,
        ],
      });

      await useFinanceStore.getState().confirmTransaction(7, "approved");

      const state = useFinanceStore.getState();
      expect(state.transactions[0].status).toBe("approved");
      expect(state.transactions[1].status).toBe("pending"); // unchanged
    });

    it("shows success message for approved", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      useFinanceStore.setState({ transactions: [{ id: 1, status: "pending" } as any] });

      await useFinanceStore.getState().confirmTransaction(1, "approved");

      expect(mockMessage.success).toHaveBeenCalledWith("Đã duyệt chi!");
    });

    it("shows success message for completed", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      useFinanceStore.setState({ transactions: [{ id: 1, status: "approved" } as any] });

      await useFinanceStore.getState().confirmTransaction(1, "completed");

      expect(mockMessage.success).toHaveBeenCalledWith("Giao dịch hoàn tất!");
    });

    it("shows error message on failure", async () => {
      mockSafeRpc.mockRejectedValue(new Error("Permission denied"));

      const result = await useFinanceStore.getState().confirmTransaction(1, "approved");

      expect(result).toBe(false);
      expect(mockMessage.error).toHaveBeenCalledWith("Lỗi: Permission denied");
    });
  });
});
