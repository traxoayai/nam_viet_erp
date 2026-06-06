// src/features/finance/api/financialReportsService.ts
import type { Book } from "../types/accounting";

import { safeRpc } from "@/shared/lib/safeRpc";

// ─── Types: Trial Balance ────────────────────────────────────────────────────

export interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  opening_debit: number;
  opening_credit: number;
  period_debit: number;
  period_credit: number;
  closing_debit: number;
  closing_credit: number;
}

// ─── Types: Income Statement ─────────────────────────────────────────────────

export interface IncomeStatement {
  doanh_thu_ban_hang: number;
  doanh_thu_thuan: number;
  gia_von: number;
  loi_nhuan_gop: number;
  doanh_thu_tai_chinh: number;
  chi_phi_tai_chinh: number;
  chi_phi_qlkd: number;
  loi_nhuan_thuan: number;
  thu_nhap_khac: number;
  chi_phi_khac: number;
  loi_nhuan_khac: number;
  tong_loi_nhuan_truoc_thue: number;
  chi_phi_thue_tndn: number;
  loi_nhuan_sau_thue: number;
}

export interface GetReportParams {
  book: Book;
  year: number;
  month: number;
}

// ─── Types: Balance Sheet / VAT / Cash Flow ─────────────────────────────────

export interface BalanceSheetRow {
  ma_so: string;
  ten_chi_tieu: string;
  so_tien: number;
}

export interface VatDeclarationRow {
  tax_rate: number;
  sum_pre_tax: number;
  sum_vat: number;
}

export interface CashFlow {
  dong_tien_vao: number;
  dong_tien_ra: number;
  luu_chuyen_thuan: number;
}

export type InvoiceDirection = "inbound" | "outbound";

// ─── Service ────────────────────────────────────────────────────────────────

export const financialReportsService = {
  /**
   * Gọi RPC get_trial_balance — trả danh sách dòng bảng CĐTK.
   */
  async getTrialBalance(params: GetReportParams): Promise<TrialBalanceRow[]> {
    const { data } = await safeRpc("get_trial_balance", {
      p_book: params.book,
      p_year: params.year,
      p_month: params.month,
    });

    return (data ?? []) as TrialBalanceRow[];
  },

  /**
   * Gọi RPC get_income_statement — trả object 14 chỉ tiêu KQKD.
   */
  async getIncomeStatement(params: GetReportParams): Promise<IncomeStatement> {
    const { data } = await safeRpc("get_income_statement", {
      p_book: params.book,
      p_year: params.year,
      p_month: params.month,
    });

    const zero: IncomeStatement = {
      doanh_thu_ban_hang: 0,
      doanh_thu_thuan: 0,
      gia_von: 0,
      loi_nhuan_gop: 0,
      doanh_thu_tai_chinh: 0,
      chi_phi_tai_chinh: 0,
      chi_phi_qlkd: 0,
      loi_nhuan_thuan: 0,
      thu_nhap_khac: 0,
      chi_phi_khac: 0,
      loi_nhuan_khac: 0,
      tong_loi_nhuan_truoc_thue: 0,
      chi_phi_thue_tndn: 0,
      loi_nhuan_sau_thue: 0,
    };

    if (!data || typeof data !== "object") return zero;

    const raw = data as Record<string, unknown>;
    return {
      doanh_thu_ban_hang: Number(raw.doanh_thu_ban_hang ?? 0),
      doanh_thu_thuan: Number(raw.doanh_thu_thuan ?? 0),
      gia_von: Number(raw.gia_von ?? 0),
      loi_nhuan_gop: Number(raw.loi_nhuan_gop ?? 0),
      doanh_thu_tai_chinh: Number(raw.doanh_thu_tai_chinh ?? 0),
      chi_phi_tai_chinh: Number(raw.chi_phi_tai_chinh ?? 0),
      chi_phi_qlkd: Number(raw.chi_phi_qlkd ?? 0),
      loi_nhuan_thuan: Number(raw.loi_nhuan_thuan ?? 0),
      thu_nhap_khac: Number(raw.thu_nhap_khac ?? 0),
      chi_phi_khac: Number(raw.chi_phi_khac ?? 0),
      loi_nhuan_khac: Number(raw.loi_nhuan_khac ?? 0),
      tong_loi_nhuan_truoc_thue: Number(raw.tong_loi_nhuan_truoc_thue ?? 0),
      chi_phi_thue_tndn: Number(raw.chi_phi_thue_tndn ?? 0),
      loi_nhuan_sau_thue: Number(raw.loi_nhuan_sau_thue ?? 0),
    };
  },

  /**
   * Gọi RPC get_balance_sheet — trả danh sách dòng Bảng cân đối kế toán (B01a-DNN).
   */
  async getBalanceSheet(params: GetReportParams): Promise<BalanceSheetRow[]> {
    const { data } = await safeRpc("get_balance_sheet", {
      p_book: params.book,
      p_year: params.year,
      p_month: params.month,
    });

    return ((data ?? []) as BalanceSheetRow[]).map((r) => ({
      ma_so: String(r.ma_so),
      ten_chi_tieu: String(r.ten_chi_tieu),
      so_tien: Number(r.so_tien ?? 0),
    }));
  },

  /**
   * Gọi RPC get_vat_declaration — trả bảng kê thuế GTGT theo chiều (mua/bán).
   */
  async getVatDeclaration(params: {
    direction: InvoiceDirection;
    year: number;
    month: number;
  }): Promise<VatDeclarationRow[]> {
    const { data } = await safeRpc("get_vat_declaration", {
      p_direction: params.direction,
      p_year: params.year,
      p_month: params.month,
    });

    return ((data ?? []) as VatDeclarationRow[]).map((r) => ({
      tax_rate: Number(r.tax_rate ?? 0),
      sum_pre_tax: Number(r.sum_pre_tax ?? 0),
      sum_vat: Number(r.sum_vat ?? 0),
    }));
  },

  /**
   * Gọi RPC get_cash_flow — trả 1 dòng lưu chuyển tiền tệ (vào/ra/thuần).
   */
  async getCashFlow(params: GetReportParams): Promise<CashFlow> {
    const { data } = await safeRpc("get_cash_flow", {
      p_book: params.book,
      p_year: params.year,
      p_month: params.month,
    });

    const row = (Array.isArray(data) ? data[0] : data) as
      | CashFlow
      | null
      | undefined;
    return {
      dong_tien_vao: Number(row?.dong_tien_vao ?? 0),
      dong_tien_ra: Number(row?.dong_tien_ra ?? 0),
      luu_chuyen_thuan: Number(row?.luu_chuyen_thuan ?? 0),
    };
  },
};
