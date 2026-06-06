// src/features/finance/api/journalLedgerService.ts
// NOTE: journal_entries / journal_entry_lines chưa có trong database.types.ts (typegen chưa chạy).
// Dùng type assertion qua unknown để bypass Supabase generic — hoàn toàn an toàn vì SELECT-only.
import type {
  Book,
  JournalEntry,
  JournalLineDetail,
  JournalStatus,
} from "../types/accounting";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/shared/lib/supabaseClient";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as SupabaseClient<any>;

export interface ListJournalParams {
  book?: Book;
  status?: JournalStatus;
  docType?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

export interface ListJournalResult {
  data: JournalEntry[];
  total: number;
}

export const journalLedgerService = {
  async listJournalEntries(
    params: ListJournalParams
  ): Promise<ListJournalResult> {
    const { book, status, docType, dateFrom, dateTo, page, pageSize } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = db
      .from("journal_entries")
      .select(
        "id,book,entry_date,doc_type,status,total_debit,total_credit,description",
        { count: "exact" }
      )
      .order("entry_date", { ascending: false });

    if (book) query = query.eq("book", book);
    if (status) query = query.eq("status", status);
    if (docType) query = query.eq("doc_type", docType);
    if (dateFrom) query = query.gte("entry_date", dateFrom);
    if (dateTo) query = query.lte("entry_date", dateTo);

    const { data, error, count } = await query.range(from, to);

    if (error) throw new Error((error as { message: string }).message);

    return {
      data: (data ?? []) as JournalEntry[],
      total: count ?? 0,
    };
  },

  async getJournalLines(entryId: number): Promise<JournalLineDetail[]> {
    const { data, error } = await db
      .from("journal_entry_lines")
      .select(
        "id,entry_id,account_id,debit,credit,partner_id,description,line_no,chart_of_accounts(account_code,name)"
      )
      .eq("entry_id", entryId)
      .order("line_no", { ascending: true });

    if (error) throw new Error((error as { message: string }).message);

    interface RawLine {
      id: number;
      entry_id: number;
      account_id: string;
      debit: number;
      credit: number;
      partner_id: string | null;
      description: string | null;
      line_no: number;
      chart_of_accounts:
        | { account_code: string; name: string }
        | { account_code: string; name: string }[]
        | null;
    }

    return (data ?? []).map((rawRow: unknown) => {
      const row = rawRow as RawLine;
      const coaRaw = row.chart_of_accounts;
      const coa = Array.isArray(coaRaw) ? (coaRaw[0] ?? null) : coaRaw;
      return {
        id: row.id,
        entry_id: row.entry_id,
        account_id: row.account_id,
        account_code: coa?.account_code ?? "",
        account_name: coa?.name ?? "",
        debit: row.debit,
        credit: row.credit,
        partner_id: row.partner_id ?? null,
        description: row.description ?? null,
        line_no: row.line_no,
      } satisfies JournalLineDetail;
    });
  },
};
