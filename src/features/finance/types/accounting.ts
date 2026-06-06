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

/** Dòng bút toán kèm thông tin tài khoản (JOIN chart_of_accounts) */
export interface JournalLineDetail {
  id: number;
  entry_id: number;
  account_id: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  partner_id: string | null;
  description: string | null;
  line_no: number;
}
