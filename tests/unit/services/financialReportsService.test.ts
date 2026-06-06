import { describe, it, expect, vi, beforeEach } from "vitest";

// ────────────────────────────────────────────────────────────────────────────
// Mock safeRpc — phải factory (bị hoist) và không tham chiếu biến ngoài
// ────────────────────────────────────────────────────────────────────────────
vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: vi.fn(),
}));

// Mock supabaseClient (safeRpc import nó, cần tránh lỗi khởi tạo)
vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: { rpc: vi.fn() },
}));

// Mock antd message (safeRpc import message từ antd)
vi.mock("antd", () => ({
  message: { error: vi.fn() },
}));

import { financialReportsService } from "@/features/finance/api/financialReportsService";
import { safeRpc } from "@/shared/lib/safeRpc";

const mockSafeRpc = safeRpc as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getTrialBalance ──────────────────────────────────────────────────────────

describe("financialReportsService.getTrialBalance", () => {
  it("gọi đúng RPC get_trial_balance với tham số p_book, p_year, p_month", async () => {
    const mockRows = [
      {
        account_code: "111",
        account_name: "Tiền mặt",
        opening_debit: 1000000,
        opening_credit: 0,
        period_debit: 500000,
        period_credit: 200000,
        closing_debit: 1300000,
        closing_credit: 0,
      },
    ];
    mockSafeRpc.mockResolvedValueOnce({ data: mockRows, error: null });

    const result = await financialReportsService.getTrialBalance({
      book: "INTERNAL",
      year: 2026,
      month: 6,
    });

    expect(mockSafeRpc).toHaveBeenCalledWith("get_trial_balance", {
      p_book: "INTERNAL",
      p_year: 2026,
      p_month: 6,
    });
    expect(result).toEqual(mockRows);
  });

  it("gọi đúng với sổ TAX", async () => {
    mockSafeRpc.mockResolvedValueOnce({ data: [], error: null });

    await financialReportsService.getTrialBalance({
      book: "TAX",
      year: 2025,
      month: 12,
    });

    expect(mockSafeRpc).toHaveBeenCalledWith("get_trial_balance", {
      p_book: "TAX",
      p_year: 2025,
      p_month: 12,
    });
  });

  it("trả về [] khi data là null", async () => {
    mockSafeRpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await financialReportsService.getTrialBalance({
      book: "INTERNAL",
      year: 2026,
      month: 1,
    });

    expect(result).toEqual([]);
  });

  it("ném lỗi khi safeRpc throw", async () => {
    mockSafeRpc.mockRejectedValueOnce(new Error("RPC failed"));

    await expect(
      financialReportsService.getTrialBalance({
        book: "INTERNAL",
        year: 2026,
        month: 6,
      })
    ).rejects.toThrow("RPC failed");
  });
});

// ─── getIncomeStatement ───────────────────────────────────────────────────────

describe("financialReportsService.getIncomeStatement", () => {
  it("gọi đúng RPC get_income_statement với tham số p_book, p_year, p_month", async () => {
    const mockData = {
      doanh_thu_ban_hang: 100000000,
      doanh_thu_thuan: 95000000,
      gia_von: 60000000,
      loi_nhuan_gop: 35000000,
      doanh_thu_tai_chinh: 500000,
      chi_phi_tai_chinh: 1000000,
      chi_phi_qlkd: 10000000,
      loi_nhuan_thuan: 24500000,
      thu_nhap_khac: 0,
      chi_phi_khac: 0,
      loi_nhuan_khac: 0,
      tong_loi_nhuan_truoc_thue: 24500000,
      chi_phi_thue_tndn: 4900000,
      loi_nhuan_sau_thue: 19600000,
    };
    mockSafeRpc.mockResolvedValueOnce({ data: mockData, error: null });

    const result = await financialReportsService.getIncomeStatement({
      book: "INTERNAL",
      year: 2026,
      month: 6,
    });

    expect(mockSafeRpc).toHaveBeenCalledWith("get_income_statement", {
      p_book: "INTERNAL",
      p_year: 2026,
      p_month: 6,
    });
    expect(result.doanh_thu_ban_hang).toBe(100000000);
    expect(result.loi_nhuan_sau_thue).toBe(19600000);
  });

  it("trả về object zero khi data là null", async () => {
    mockSafeRpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await financialReportsService.getIncomeStatement({
      book: "TAX",
      year: 2026,
      month: 3,
    });

    expect(result.loi_nhuan_sau_thue).toBe(0);
    expect(result.doanh_thu_ban_hang).toBe(0);
    expect(result.tong_loi_nhuan_truoc_thue).toBe(0);
  });

  it("trả về object zero khi data là non-object (e.g. string)", async () => {
    mockSafeRpc.mockResolvedValueOnce({ data: "bad data", error: null });

    const result = await financialReportsService.getIncomeStatement({
      book: "INTERNAL",
      year: 2026,
      month: 1,
    });

    expect(result.loi_nhuan_sau_thue).toBe(0);
  });

  it("ép kiểu số từ string nếu DB trả về string", async () => {
    mockSafeRpc.mockResolvedValueOnce({
      data: {
        doanh_thu_ban_hang: "50000000",
        doanh_thu_thuan: "48000000",
        gia_von: "30000000",
        loi_nhuan_gop: "18000000",
        doanh_thu_tai_chinh: "0",
        chi_phi_tai_chinh: "0",
        chi_phi_qlkd: "5000000",
        loi_nhuan_thuan: "13000000",
        thu_nhap_khac: "0",
        chi_phi_khac: "0",
        loi_nhuan_khac: "0",
        tong_loi_nhuan_truoc_thue: "13000000",
        chi_phi_thue_tndn: "2600000",
        loi_nhuan_sau_thue: "10400000",
      },
      error: null,
    });

    const result = await financialReportsService.getIncomeStatement({
      book: "INTERNAL",
      year: 2026,
      month: 5,
    });

    expect(typeof result.doanh_thu_ban_hang).toBe("number");
    expect(result.doanh_thu_ban_hang).toBe(50000000);
    expect(result.loi_nhuan_sau_thue).toBe(10400000);
  });

  it("ném lỗi khi safeRpc throw", async () => {
    mockSafeRpc.mockRejectedValueOnce(new Error("DB error"));

    await expect(
      financialReportsService.getIncomeStatement({
        book: "INTERNAL",
        year: 2026,
        month: 6,
      })
    ).rejects.toThrow("DB error");
  });
});
