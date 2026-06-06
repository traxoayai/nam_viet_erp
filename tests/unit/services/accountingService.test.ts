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
  // Test 1: postPurchase gọi gen_journal_purchase 2 lần với p_book lần lượt 'vat' và 'actual'
  it("postPurchase gọi gen_journal_purchase 2 lần với đúng p_book và p_invoice_id", async () => {
    const result = await accountingService.postPurchase(10);

    expect(safeRpc).toHaveBeenCalledTimes(2);
    expect(safeRpc).toHaveBeenNthCalledWith(1, "gen_journal_purchase", {
      p_book: "vat",
      p_invoice_id: 10,
    });
    expect(safeRpc).toHaveBeenNthCalledWith(2, "gen_journal_purchase", {
      p_book: "actual",
      p_invoice_id: 10,
    });
    expect(result).toEqual([1, 1]);
  });

  // Test 2: postSale — sổ 'vat' truyền p_vat=80000, sổ 'actual' truyền p_vat=0
  it("postSale truyền p_vat đúng theo sổ: vat=80000 cho sổ vat, vat=0 cho sổ actual", async () => {
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
      p_book: "vat",
      p_source_id: "SO",
      p_entry_date: "2026-06-13",
      p_partner: "KH",
      p_revenue: 1000000,
      p_vat: 80000,
    });
    expect(safeRpc).toHaveBeenNthCalledWith(2, "gen_journal_sale", {
      p_book: "actual",
      p_source_id: "SO",
      p_entry_date: "2026-06-13",
      p_partner: "KH",
      p_revenue: 1000000,
      p_vat: 0,
    });
    expect(result).toEqual([1, 1]);
  });

  // Test 3: closePeriod gọi acc_close_period với đúng tham số
  it("closePeriod gọi acc_close_period với đúng tham số", async () => {
    await accountingService.closePeriod("vat", 2026, 6);

    expect(safeRpc).toHaveBeenCalledTimes(1);
    expect(safeRpc).toHaveBeenCalledWith("acc_close_period", {
      p_book: "vat",
      p_year: 2026,
      p_month: 6,
    });
  });
});
