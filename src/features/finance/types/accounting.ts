export type Book = "vat" | "actual";
export type JournalStatus = "draft" | "posted" | "void";

export interface JournalLine {
  account_code: string;
  debit: number;
  credit: number;
  partner_id?: string | null;
  description?: string;
}

export interface JournalEntry {
  id: number;
  book: Book;
  entry_date: string;
  doc_type: string;
  status: JournalStatus;
  total_debit: number;
  total_credit: number;
  description: string | null;
}
