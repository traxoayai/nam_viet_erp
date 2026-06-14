import { useQuery } from "@tanstack/react-query";

import type {
  BalanceSheetRow,
  VatDeclarationRow,
  CashFlow,
} from "@/features/finance/api/financialReportsService";

import { financialReportsService } from "@/features/finance/api/financialReportsService";
import { downloadBctcPdf } from "@/features/finance/utils/bctcPdfGenerator";

export interface UseBctcReportParams {
  year: number;
  month: number;
}

export interface UseBctcReportResult {
  balanceSheet: BalanceSheetRow[];
  vatDeclaration: VatDeclarationRow[];
  cashFlow: CashFlow;
  isLoading: boolean;
}

/**
 * Hook fetch BCTC data (Balance Sheet B01a-DNN, VAT Declaration, Cash Flow)
 * - Gọi 3 RPC song song: getBalanceSheet, getVatDeclaration, getCashFlow
 * - Cache với staleTime=1 hour
 * - Trả [] khi null error
 */
export function useBctcReport(
  params: UseBctcReportParams
): UseBctcReportResult {
  const { data: balanceSheet = [], isLoading: bsLoading } = useQuery({
    queryKey: ["bctc", "balance_sheet", params.year, params.month],
    queryFn: async () => {
      const result = await financialReportsService.getBalanceSheet({
        book: "INTERNAL",
        year: params.year,
        month: params.month,
      });
      return result || [];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const { data: vatDeclaration = [], isLoading: vatLoading } = useQuery({
    queryKey: ["bctc", "vat_declaration", params.year, params.month],
    queryFn: async () => {
      const result = await financialReportsService.getVatDeclaration({
        direction: "outbound",
        year: params.year,
        month: params.month,
      });
      return result || [];
    },
    staleTime: 1000 * 60 * 60,
  });

  const { data: cashFlow, isLoading: cfLoading } = useQuery({
    queryKey: ["bctc", "cash_flow", params.year, params.month],
    queryFn: async () => {
      const result = await financialReportsService.getCashFlow({
        book: "INTERNAL",
        year: params.year,
        month: params.month,
      });
      return (
        result || {
          dong_tien_vao: 0,
          dong_tien_ra: 0,
          luu_chuyen_thuan: 0,
        }
      );
    },
    staleTime: 1000 * 60 * 60,
  });

  return {
    balanceSheet,
    vatDeclaration,
    cashFlow: cashFlow || {
      dong_tien_vao: 0,
      dong_tien_ra: 0,
      luu_chuyen_thuan: 0,
    },
    isLoading: bsLoading || vatLoading || cfLoading,
  };
}

/**
 * Export BCTC Balance Sheet to PDF
 */
export async function exportBctcBalanceSheetPdf(
  balanceSheet: BalanceSheetRow[],
  year: number,
  month: number,
  companyName: string = "Nam Việt Pharmacy"
) {
  const period = `${year}${String(month).padStart(2, "0")}`;
  const filename = `BCTC-${period}.pdf`;

  await downloadBctcPdf(
    {
      period,
      year,
      month,
      companyName,
      lines: balanceSheet,
    },
    filename
  );
}
