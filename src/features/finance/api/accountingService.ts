import type { Book } from "../types/accounting";

import { safeRpc } from "@/shared/lib/safeRpc";

const BOOKS: Book[] = ["INTERNAL", "TAX"];

/** Danh sách sổ cần ghi — default cả 2. Truyền [book] khi user chỉ chọn 1 sổ. */
function resolveBooks(books?: Book[]): Book[] {
  return books && books.length > 0 ? books : BOOKS;
}

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

  /** Bán hàng: revenue + vat (sổ TAX). Sổ INTERNAL chỉ doanh thu thật (vat=0). */
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
        p_vat: book === "TAX" ? args.vat : 0,
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

  /**
   * Ghi sổ bán hàng: sinh bút toán doanh thu + giá vốn (NHÁP, sổ INTERNAL) từ 1 đơn.
   * Gọi NON-BLOCKING sau khi tạo đơn thành công — lỗi kế toán KHÔNG được chặn bán hàng
   * (caller phải bọc try/catch). Idempotent ở DB (gọi lại trả `skipped`).
   * ⚠️ Điểm kích hoạt theo nghiệp vụ: POS = lúc tạo đơn; B2B = lúc giao/xuất HĐ
   * (KHÔNG gọi lúc tạo báo giá PENDING) — wiring do team chốt với PM.
   */
  async postSalesOrder(orderId: string): Promise<{
    entry_sale: number | null;
    entry_cogs: number | null;
    revenue: number;
    cogs: number;
    book: string;
    skipped?: string;
  } | null> {
    const { data } = await safeRpc("gen_journal_for_sales_order", {
      p_order_id: orderId,
    });
    return data as {
      entry_sale: number | null;
      entry_cogs: number | null;
      revenue: number;
      cogs: number;
      book: string;
      skipped?: string;
    } | null;
  },

  /**
   * Wrapper NON-BLOCKING của postSalesOrder để gọi từ luồng bán hàng/đóng gói:
   * KHÔNG bao giờ throw (nuốt + log lỗi), không chặn nghiệp vụ doanh thu.
   * Call site chỉ cần `void accountingService.postSalesOrderSafe(orderId)`.
   */
  async postSalesOrderSafe(orderId: string): Promise<void> {
    try {
      await accountingService.postSalesOrder(orderId);
    } catch (e) {
      // Lỗi kế toán (kỳ đã khóa, mạng...) KHÔNG được chặn bán hàng — chỉ log.
      console.error(
        "[accounting] postSalesOrder hook failed (đơn hàng vẫn OK):",
        orderId,
        e
      );
    }
  },

  async postPayment(
    args: {
      sourceId: string;
      entryDate: string;
      amount: number;
      categoryAccount: string;
      fundAccount: string;
      partner: string;
      desc: string;
    },
    books?: Book[]
  ): Promise<number[]> {
    const ids: number[] = [];
    for (const book of resolveBooks(books)) {
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

  async postReceipt(
    args: {
      sourceId: string;
      entryDate: string;
      amount: number;
      categoryAccount: string;
      fundAccount: string;
      partner: string;
      desc: string;
    },
    books?: Book[]
  ): Promise<number[]> {
    const ids: number[] = [];
    for (const book of resolveBooks(books)) {
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

  /** Thanh toán HĐ + bù trừ chênh lệch 2 sổ (711/811).
   *  entry_ids[0..1] = bút toán chính (INTERNAL+TAX);
   *  entry_ids[2]    = bút toán bù trừ (chỉ INTERNAL, nếu có chênh lệch).
   *  difference > 0: trả ít hơn HĐ; difference < 0: trả nhiều hơn HĐ.
   */
  async payInvoice(args: {
    invoiceId: number;
    actualAmount: number;
    fundAccountId: number;
    entryDate: string;
    partner: string;
    desc: string;
  }): Promise<{
    entry_ids: number[];
    warning: string | null;
    difference: number;
  }> {
    const { data } = await safeRpc("create_invoice_payment", {
      p_invoice_id: args.invoiceId,
      p_actual_amount: args.actualAmount,
      p_fund_account_id: args.fundAccountId,
      p_entry_date: args.entryDate,
      p_partner: args.partner,
      p_desc: args.desc,
    });
    return data as {
      entry_ids: number[];
      warning: string | null;
      difference: number;
    };
  },

  async closePeriod(book: Book, year: number, month: number): Promise<void> {
    await safeRpc("acc_close_period", {
      p_book: book,
      p_year: year,
      p_month: month,
    });
  },
};
