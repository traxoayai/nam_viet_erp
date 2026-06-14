import { safeRpc } from "@/shared/lib/safeRpc";

export interface ReconciliationReportRow {
  account_code: string;
  account_name: string;
  gl_balance: number;
  bs_balance: number;
  difference: number;
  is_reconciled: boolean;
  notes: string;
}

export interface ReconciliationReportParams {
  periodYear: number;
  periodMonth: number;
  book: "INTERNAL" | "TAX";
}

export const reconciliationService = {
  /**
   * Gọi RPC get_reconciliation_report — so sánh GL balance vs BS balance.
   * Trả danh sách account với reconciliation status.
   *
   * GL balance = SUM(debit - credit) từ journal_entry_lines của posted entries
   * BS balance = closing_debit - closing_credit từ account_balances
   *
   * Nếu GL_balance ≠ BS_balance → is_reconciled = false, notes nêu discrepancy
   */
  async getReconciliationReport(
    params: ReconciliationReportParams
  ): Promise<ReconciliationReportRow[]> {
    const { data } = await safeRpc("get_reconciliation_report", {
      p_period_year: params.periodYear,
      p_period_month: params.periodMonth,
      p_book: params.book,
    });

    return (data ?? []) as ReconciliationReportRow[];
  },
};
