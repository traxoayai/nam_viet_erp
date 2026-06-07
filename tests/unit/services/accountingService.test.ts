import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: vi.fn().mockResolvedValue({ data: 1, error: null }),
}));

import { accountingService } from "@/features/finance/api/accountingService";
import { safeRpc } from "@/shared/lib/safeRpc";

beforeEach(() => {
  (safeRpc as ReturnType<typeof vi.fn>).mockClear();
});

describe("accountingService", () => {
  // Test 1: postPurchase gọi gen_journal_purchase 2 lần với p_book lần lượt 'INTERNAL' và 'TAX'
  it("postPurchase gọi gen_journal_purchase 2 lần với đúng p_book và p_invoice_id", async () => {
    const result = await accountingService.postPurchase(10);

    expect(safeRpc).toHaveBeenCalledTimes(2);
    expect(safeRpc).toHaveBeenNthCalledWith(1, "gen_journal_purchase", {
      p_book: "INTERNAL",
      p_invoice_id: 10,
    });
    expect(safeRpc).toHaveBeenNthCalledWith(2, "gen_journal_purchase", {
      p_book: "TAX",
      p_invoice_id: 10,
    });
    expect(result).toEqual([1, 1]);
  });

  // Test 2: postSale — sổ 'TAX' truyền p_vat=80000, sổ 'INTERNAL' truyền p_vat=0
  it("postSale truyền p_vat đúng theo sổ: vat=80000 cho sổ TAX, vat=0 cho sổ INTERNAL", async () => {
    const args = {
      sourceId: "SO",
      entryDate: "2026-06-13",
      partner: "KH",
      revenue: 1000000,
      vat: 80000,
    };

    const result = await accountingService.postSale(args);

    expect(safeRpc).toHaveBeenCalledTimes(2);
    expect(safeRpc).toHaveBeenNthCalledWith(1, "gen_journal_sale", {
      p_book: "INTERNAL",
      p_source_id: "SO",
      p_entry_date: "2026-06-13",
      p_partner: "KH",
      p_revenue: 1000000,
      p_vat: 0,
    });
    expect(safeRpc).toHaveBeenNthCalledWith(2, "gen_journal_sale", {
      p_book: "TAX",
      p_source_id: "SO",
      p_entry_date: "2026-06-13",
      p_partner: "KH",
      p_revenue: 1000000,
      p_vat: 80000,
    });
    expect(result).toEqual([1, 1]);
  });

  // Test 3: closePeriod gọi acc_close_period với đúng tham số
  it("closePeriod gọi acc_close_period với đúng tham số", async () => {
    await accountingService.closePeriod("TAX", 2026, 6);

    expect(safeRpc).toHaveBeenCalledTimes(1);
    expect(safeRpc).toHaveBeenCalledWith("acc_close_period", {
      p_book: "TAX",
      p_year: 2026,
      p_month: 6,
    });
  });

  // ── postReceipt – tham số books (TASK A) ──────────────────────────────────
  describe("postReceipt — books param", () => {
    const receiptArgs = {
      sourceId: "src-1",
      entryDate: "2026-06-06T00:00:00.000Z",
      amount: 1_000_000,
      categoryAccount: "511",
      fundAccount: "111",
      partner: "Khách A",
      desc: "Thu tiền bán hàng",
    };

    it("gọi gen_journal_receipt cho cả INTERNAL và TAX khi không truyền books (default)", async () => {
      await accountingService.postReceipt(receiptArgs);

      expect(safeRpc).toHaveBeenCalledTimes(2);
      expect(safeRpc).toHaveBeenCalledWith(
        "gen_journal_receipt",
        expect.objectContaining({ p_book: "INTERNAL" })
      );
      expect(safeRpc).toHaveBeenCalledWith(
        "gen_journal_receipt",
        expect.objectContaining({ p_book: "TAX" })
      );
    });

    it("gọi gen_journal_receipt cho cả INTERNAL và TAX khi books=[] (fallback default)", async () => {
      await accountingService.postReceipt(receiptArgs, []);

      expect(safeRpc).toHaveBeenCalledTimes(2);
    });

    it("chỉ gọi sổ INTERNAL khi books=['INTERNAL']", async () => {
      await accountingService.postReceipt(receiptArgs, ["INTERNAL"]);

      expect(safeRpc).toHaveBeenCalledTimes(1);
      expect(safeRpc).toHaveBeenCalledWith(
        "gen_journal_receipt",
        expect.objectContaining({ p_book: "INTERNAL" })
      );
    });

    it("chỉ gọi sổ TAX khi books=['TAX']", async () => {
      await accountingService.postReceipt(receiptArgs, ["TAX"]);

      expect(safeRpc).toHaveBeenCalledTimes(1);
      expect(safeRpc).toHaveBeenCalledWith(
        "gen_journal_receipt",
        expect.objectContaining({ p_book: "TAX" })
      );
    });
  });

  // ── postPayment – tham số books (TASK A) ─────────────────────────────────
  describe("postPayment — books param", () => {
    const paymentArgs = {
      sourceId: "src-2",
      entryDate: "2026-06-06T00:00:00.000Z",
      amount: 500_000,
      categoryAccount: "641",
      fundAccount: "111",
      partner: "NCC B",
      desc: "Chi phí vận chuyển",
    };

    it("gọi gen_journal_payment cho cả INTERNAL và TAX khi không truyền books (default)", async () => {
      await accountingService.postPayment(paymentArgs);

      expect(safeRpc).toHaveBeenCalledTimes(2);
      expect(safeRpc).toHaveBeenCalledWith(
        "gen_journal_payment",
        expect.objectContaining({ p_book: "INTERNAL" })
      );
      expect(safeRpc).toHaveBeenCalledWith(
        "gen_journal_payment",
        expect.objectContaining({ p_book: "TAX" })
      );
    });

    it("chỉ gọi sổ INTERNAL khi books=['INTERNAL']", async () => {
      await accountingService.postPayment(paymentArgs, ["INTERNAL"]);

      expect(safeRpc).toHaveBeenCalledTimes(1);
      expect(safeRpc).toHaveBeenCalledWith(
        "gen_journal_payment",
        expect.objectContaining({ p_book: "INTERNAL" })
      );
    });

    it("chỉ gọi sổ TAX khi books=['TAX']", async () => {
      await accountingService.postPayment(paymentArgs, ["TAX"]);

      expect(safeRpc).toHaveBeenCalledTimes(1);
      expect(safeRpc).toHaveBeenCalledWith(
        "gen_journal_payment",
        expect.objectContaining({ p_book: "TAX" })
      );
    });

    it("gọi đủ 2 sổ khi books=['INTERNAL','TAX']", async () => {
      await accountingService.postPayment(paymentArgs, ["INTERNAL", "TAX"]);

      expect(safeRpc).toHaveBeenCalledTimes(2);
    });
  });

  // ── postSalesOrder (Phase 4: hook bán hàng/COGS) ──────────────────────────
  describe("postSalesOrder", () => {
    it("gọi gen_journal_for_sales_order với p_order_id + trả data passthrough", async () => {
      (safeRpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          entry_sale: 5,
          entry_cogs: 6,
          revenue: 500000,
          cogs: 300000,
          book: "INTERNAL",
        },
        error: null,
      });

      const res = await accountingService.postSalesOrder("ord-uuid-1");

      expect(safeRpc).toHaveBeenCalledTimes(1);
      expect(safeRpc).toHaveBeenCalledWith("gen_journal_for_sales_order", {
        p_order_id: "ord-uuid-1",
      });
      expect(res?.revenue).toBe(500000);
      expect(res?.cogs).toBe(300000);
      expect(res?.book).toBe("INTERNAL");
    });

    it("trả skipped khi DB báo đã book / opening_debt", async () => {
      (safeRpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { skipped: "already_booked" },
        error: null,
      });

      const res = await accountingService.postSalesOrder("ord-uuid-2");

      expect(res?.skipped).toBe("already_booked");
    });
  });
});
