import type { Book } from "../types/accounting";

import { safeRpc } from "@/shared/lib/safeRpc";

const BOOKS: Book[] = ["vat", "actual"];

export const accountingService = {
  /** Sinh bút toán mua hàng (nháp) cho cả 2 sổ từ 1 finance_invoices */
  async postPurchase(invoiceId: number): Promise<number[]> {
    const ids: number[] = [];
    for (const book of BOOKS) {
      const { data } = await safeRpc("gen_journal_purchase", {
        p_book: book,
        p_invoice_id: invoiceId,
      });
      ids.push(data as number);
    }
    return ids;
  },

  /** Bán hàng: revenue + vat (sổ vat). Sổ actual chỉ doanh thu thật (vat=0). */
  async postSale(args: {
    sourceId: string;
    entryDate: string;
    partner: string;
    revenue: number;
    vat: number;
  }): Promise<number[]> {
    const ids: number[] = [];
    for (const book of BOOKS) {
      const { data } = await safeRpc("gen_journal_sale", {
        p_book: book,
        p_source_id: args.sourceId,
        p_entry_date: args.entryDate,
        p_partner: args.partner,
        p_revenue: args.revenue,
        p_vat: book === "vat" ? args.vat : 0,
      });
      ids.push(data as number);
    }
    return ids;
  },

  /** Giá vốn (cả 2 sổ) */
  async postCogs(args: {
    sourceId: string;
    entryDate: string;
    cogs: number;
  }): Promise<number[]> {
    const ids: number[] = [];
    for (const book of BOOKS) {
      const { data } = await safeRpc("gen_journal_cogs", {
        p_book: book,
        p_source_id: args.sourceId,
        p_entry_date: args.entryDate,
        p_cogs: args.cogs,
      });
      ids.push(data as number);
    }
    return ids;
  },

  async postPayment(args: {
    sourceId: string;
    entryDate: string;
    amount: number;
    categoryAccount: string;
    fundAccount: string;
    partner: string;
    desc: string;
  }): Promise<number[]> {
    const ids: number[] = [];
    for (const book of BOOKS) {
      const { data } = await safeRpc("gen_journal_payment", {
        p_book: book,
        p_source_id: args.sourceId,
        p_entry_date: args.entryDate,
        p_amount: args.amount,
        p_category_account: args.categoryAccount,
        p_fund_account: args.fundAccount,
        p_partner: args.partner,
        p_desc: args.desc,
      });
      ids.push(data as number);
    }
    return ids;
  },

  async postReceipt(args: {
    sourceId: string;
    entryDate: string;
    amount: number;
    categoryAccount: string;
    fundAccount: string;
    partner: string;
    desc: string;
  }): Promise<number[]> {
    const ids: number[] = [];
    for (const book of BOOKS) {
      const { data } = await safeRpc("gen_journal_receipt", {
        p_book: book,
        p_source_id: args.sourceId,
        p_entry_date: args.entryDate,
        p_amount: args.amount,
        p_category_account: args.categoryAccount,
        p_fund_account: args.fundAccount,
        p_partner: args.partner,
        p_desc: args.desc,
      });
      ids.push(data as number);
    }
    return ids;
  },

  async postEntry(entryId: number): Promise<void> {
    await safeRpc("post_journal_entry", { p_entry_id: entryId });
  },

  async voidEntry(entryId: number): Promise<void> {
    await safeRpc("void_journal_entry", { p_entry_id: entryId });
  },

  async closePeriod(book: Book, year: number, month: number): Promise<void> {
    await safeRpc("acc_close_period", {
      p_book: book,
      p_year: year,
      p_month: month,
    });
  },
};
