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
};
