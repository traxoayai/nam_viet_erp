import { useEffect, useState } from "react";

import { reconciliationService } from "../api/reconciliationService";

import type {
  ReconciliationReportRow,
  ReconciliationReportParams,
} from "../api/reconciliationService";

interface UseReconciliationReportOptions {
  periodYear: number;
  periodMonth: number;
  book: "INTERNAL" | "TAX";
}

export function useReconciliationReport(
  options: UseReconciliationReportOptions
) {
  const [data, setData] = useState<ReconciliationReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params: ReconciliationReportParams = {
          periodYear: options.periodYear,
          periodMonth: options.periodMonth,
          book: options.book,
        };
        const result =
          await reconciliationService.getReconciliationReport(params);
        setData(result);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReport();
  }, [options.periodYear, options.periodMonth, options.book]);

  return {
    data,
    isLoading,
    error,
  };
}
