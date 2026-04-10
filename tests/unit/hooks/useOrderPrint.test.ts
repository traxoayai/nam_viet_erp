import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSafeRpc = vi.fn();
vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));

// Mock antd
vi.mock("antd", () => ({
  message: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(() => vi.fn()), // loading returns a hide function
  },
}));

// Mock print utilities
vi.mock("@/shared/utils/printTemplates", () => ({
  generateB2BOrderHTML: vi.fn(() => "<html>mock</html>"),
}));

vi.mock("@/shared/utils/printUtils", () => ({
  printHTML: vi.fn(),
}));

// Mock b2bService — use a variable so we can change the return per test
const mockGetOrderDetail = vi.fn();
vi.mock("@/features/sales/api/b2bService", () => ({
  b2bService: {
    getOrderDetail: (...args: any[]) => mockGetOrderDetail(...args),
  },
}));

import { useOrderPrint } from "@/features/sales/hooks/useOrderPrint";

describe("useOrderPrint - safeRpc calls", () => {
  beforeEach(() => {
    mockSafeRpc.mockReset();
    mockGetOrderDetail.mockReset();
  });

  it("printOrder calls safeRpc with get_customer_debt_info and { silent: true }", async () => {
    mockGetOrderDetail.mockResolvedValue({
      id: 1,
      customer_id: 100,
      status: "CONFIRMED",
      final_amount: 500000,
      paid_amount: 200000,
      payment_status: "partial",
      items: [],
    });
    mockSafeRpc.mockResolvedValue({
      data: [{ current_debt: 1000000 }],
      error: null,
    });

    const { printOrder } = useOrderPrint();

    await printOrder({
      id: 1,
      customer_id: 100,
      status: "CONFIRMED",
      final_amount: 500000,
      paid_amount: 200000,
      payment_status: "partial",
    });

    expect(mockSafeRpc).toHaveBeenCalledWith(
      "get_customer_debt_info",
      { p_customer_id: 100 },
      { silent: true }
    );
  });

  it("passes p_customer_id as a Number", async () => {
    mockGetOrderDetail.mockResolvedValue({
      id: 2,
      customer_id: "55",
      status: "DELIVERED",
      final_amount: 100000,
      paid_amount: 100000,
      payment_status: "paid",
      items: [],
    });
    mockSafeRpc.mockResolvedValue({
      data: [{ current_debt: 0 }],
      error: null,
    });

    const { printOrder } = useOrderPrint();

    await printOrder({
      id: 2,
      customer_id: "55", // string customer_id from order
      status: "DELIVERED",
      final_amount: 100000,
      paid_amount: 100000,
      payment_status: "paid",
    });

    const call = mockSafeRpc.mock.calls.find(
      (c: any[]) => c[0] === "get_customer_debt_info"
    );
    expect(call).toBeDefined();
    expect(call![1].p_customer_id).toBe(55); // Should be Number, not string
  });

  it("does not call safeRpc when customer_id is missing", async () => {
    // fullOrder also has no customer_id
    mockGetOrderDetail.mockResolvedValue({
      id: 3,
      status: "DRAFT",
      final_amount: 100000,
      paid_amount: 0,
      payment_status: "unpaid",
      items: [],
      // No customer_id, no customer.id, no partner_id
    });

    const { printOrder } = useOrderPrint();

    await printOrder({
      id: 3,
      status: "DRAFT",
      final_amount: 100000,
      paid_amount: 0,
      payment_status: "unpaid",
    });

    expect(mockSafeRpc).not.toHaveBeenCalled();
  });

  it("proceeds without error when safeRpc throws (silent mode)", async () => {
    mockGetOrderDetail.mockResolvedValue({
      id: 4,
      customer_id: 100,
      status: "CONFIRMED",
      final_amount: 300000,
      paid_amount: 0,
      payment_status: "unpaid",
      items: [],
    });
    mockSafeRpc.mockRejectedValue(new Error("Network error"));

    const { printOrder } = useOrderPrint();

    // Should not throw - the catch block in the source handles it
    await expect(
      printOrder({
        id: 4,
        customer_id: 100,
        status: "CONFIRMED",
        final_amount: 300000,
        paid_amount: 0,
        payment_status: "unpaid",
      })
    ).resolves.not.toThrow();
  });

  it.each([
    ["CONFIRMED", "CONFIRMED"],
    ["PACKED", "PACKED"],
    ["SHIPPING", "SHIPPING"],
    ["DELIVERED", "DELIVERED"],
    ["COMPLETED", "COMPLETED"],
  ])(
    "status %s: oldDebt = serverDebt - thisOrderUnpaid, totalPayable = serverDebt",
    async (status) => {
      const serverDebt = 1_000_000;
      const finalAmount = 300_000;
      const paidAmount = 100_000;
      const thisOrderUnpaid = finalAmount - paidAmount; // 200_000

      mockGetOrderDetail.mockResolvedValue({
        id: 10,
        customer_id: 100,
        status,
        final_amount: finalAmount,
        paid_amount: paidAmount,
        payment_status: "partial",
        items: [],
      });
      mockSafeRpc.mockResolvedValue({
        data: [{ current_debt: serverDebt }],
        error: null,
      });

      const { generateB2BOrderHTML } = await import(
        "@/shared/utils/printTemplates"
      );

      const { printOrder } = useOrderPrint();
      await printOrder({
        id: 10,
        customer_id: 100,
        status,
        final_amount: finalAmount,
        paid_amount: paidAmount,
        payment_status: "partial",
      });

      const callArgs = (generateB2BOrderHTML as ReturnType<typeof vi.fn>).mock
        .calls.at(-1)?.[0];
      expect(callArgs.old_debt).toBe(serverDebt - thisOrderUnpaid); // 800_000
      expect(callArgs.total_payable_display).toBe(serverDebt); // 1_000_000
    }
  );

  it.each([
    ["DRAFT", "DRAFT"],
    ["QUOTE", "QUOTE"],
  ])(
    "status %s (not debt-recorded): oldDebt = serverDebt, totalPayable = serverDebt + thisOrderUnpaid",
    async (status) => {
      const serverDebt = 500_000;
      const finalAmount = 200_000;
      const paidAmount = 0;
      const thisOrderUnpaid = finalAmount - paidAmount; // 200_000

      mockGetOrderDetail.mockResolvedValue({
        id: 11,
        customer_id: 100,
        status,
        final_amount: finalAmount,
        paid_amount: paidAmount,
        payment_status: "unpaid",
        items: [],
      });
      mockSafeRpc.mockResolvedValue({
        data: [{ current_debt: serverDebt }],
        error: null,
      });

      const { generateB2BOrderHTML } = await import(
        "@/shared/utils/printTemplates"
      );

      const { printOrder } = useOrderPrint();
      await printOrder({
        id: 11,
        customer_id: 100,
        status,
        final_amount: finalAmount,
        paid_amount: paidAmount,
        payment_status: "unpaid",
      });

      const callArgs = (generateB2BOrderHTML as ReturnType<typeof vi.fn>).mock
        .calls.at(-1)?.[0];
      expect(callArgs.old_debt).toBe(serverDebt); // 500_000
      expect(callArgs.total_payable_display).toBe(serverDebt + thisOrderUnpaid); // 700_000
    }
  );

  it("falls back to customer.id when customer_id is not set", async () => {
    // fullOrder also has no customer_id, only customer.id
    mockGetOrderDetail.mockResolvedValue({
      id: 5,
      customer: { id: 77 },
      status: "SHIPPING",
      final_amount: 200000,
      paid_amount: 0,
      payment_status: "unpaid",
      items: [],
    });
    mockSafeRpc.mockResolvedValue({
      data: [{ current_debt: 500000 }],
      error: null,
    });

    const { printOrder } = useOrderPrint();

    await printOrder({
      id: 5,
      customer: { id: 77 },
      status: "SHIPPING",
      final_amount: 200000,
      paid_amount: 0,
      payment_status: "unpaid",
    });

    expect(mockSafeRpc).toHaveBeenCalledWith(
      "get_customer_debt_info",
      { p_customer_id: 77 },
      { silent: true }
    );
  });
});
