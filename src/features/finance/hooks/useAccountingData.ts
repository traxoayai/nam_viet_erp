// useAccountingData: TanStack Query hook cho Journal Entries
// - useJournalEntries(filters): list bút toán với filter sổ/kỳ/loại
// - staleTime 5m vì kế toán ít thay đổi liên tục

import { useQuery } from "@tanstack/react-query";

import { journalLedgerService } from "../api/journalLedgerService";

import type { Book, JournalEntry, JournalStatus } from "../types/accounting";

const STALE_MS = 1000 * 60 * 5; // 5 min
const GC_MS = 1000 * 60 * 30; // 30 min

export interface UseJournalEntriesFilters {
  book?: Book;
  status?: JournalStatus;
  docType?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

export interface UseJournalEntriesResult {
  entries: JournalEntry[];
  total: number;
  isLoading: boolean;
  error: Error | null;
}

export function useJournalEntries(
  filters: UseJournalEntriesFilters
): UseJournalEntriesResult {
  const { data, isLoading, error } = useQuery({
    queryKey: [
      "journal-entries",
      filters.book,
      filters.status,
      filters.docType,
      filters.dateFrom,
      filters.dateTo,
      filters.page,
      filters.pageSize,
    ],
    queryFn: () => journalLedgerService.listJournalEntries(filters),
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });

  return {
    entries: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: error as Error | null,
  };
}
