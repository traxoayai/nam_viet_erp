import { Client } from "pg";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import {
  adminClient,
  createTestAuthedClient,
  createUserClient,
} from "../helpers/supabase";

// Local Supabase DB config (well-known demo)
const DB_CONFIG = {
  host: "127.0.0.1",
  port: 54322,
  user: "postgres",
  password: "postgres",
  database: "postgres",
};

// IDs cố định trên local dev DB
const TEST_AUTH_UID = "a87b3a79-ad18-4eb2-883b-e5b9b0d305c2"; // auth.users (kame.ctb@gmail.com)
const ADMIN_ROLE_ID = "2c45890c-0220-4a07-8b8b-889d79670758"; // role Admin
const BRANCH_ID = "4"; // warehouse id (branch)

let cleanupPublicUser = false;
let cleanupUserRole: string | null = null;

beforeAll(async () => {
  // Dùng pg client (postgres superuser) để seed bypass RLS hoàn toàn
  const pg = new Client(DB_CONFIG);
  await pg.connect();
  try {
    // Đảm bảo test user tồn tại trong public.users (FK từ auth.users)
    const { rows: existing } = await pg.query(
      `SELECT id FROM users WHERE id = $1`,
      [TEST_AUTH_UID]
    );
    if (existing.length === 0) {
      await pg.query(
        `INSERT INTO users(id, email, full_name, status)
         VALUES($1, 'kame.test.kt@gmail.com', 'Test Kế Toán', 'active')
         ON CONFLICT (id) DO NOTHING`,
        [TEST_AUTH_UID]
      );
      cleanupPublicUser = true;
    }

    // Đảm bảo user_roles có Admin role cho test user
    const { rows: existingRole } = await pg.query(
      `SELECT id FROM user_roles WHERE user_id = $1 AND role_id = $2`,
      [TEST_AUTH_UID, ADMIN_ROLE_ID]
    );
    if (existingRole.length === 0) {
      const { rows: inserted } = await pg.query(
        `INSERT INTO user_roles(user_id, role_id, branch_id)
         VALUES($1, $2, $3)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [TEST_AUTH_UID, ADMIN_ROLE_ID, BRANCH_ID]
      );
      if (inserted[0]) cleanupUserRole = inserted[0].id;
    }

    // Reload PostgREST để schema fresh
    await pg.query("NOTIFY pgrst, 'reload schema'");
    await new Promise((r) => setTimeout(r, 800));
  } finally {
    await pg.end();
  }

  // Reset password test user để login được
  await adminClient.auth.admin.updateUserById(TEST_AUTH_UID, {
    password: "Test@123!",
  });
}, 30000);

afterAll(async () => {
  // Cleanup chỉ những gì test này tạo ra
  if (!cleanupPublicUser && !cleanupUserRole) return;
  const pg = new Client(DB_CONFIG);
  await pg.connect();
  try {
    if (cleanupUserRole) {
      await pg.query(`DELETE FROM user_roles WHERE id = $1`, [cleanupUserRole]);
    }
    if (cleanupPublicUser) {
      await pg.query(`DELETE FROM users WHERE id = $1`, [TEST_AUTH_UID]);
    }
  } finally {
    await pg.end();
  }
});

describe("acc_create_journal_entry", () => {
  it("tạo bút toán nháp cân Nợ=Có (Nợ156+Nợ1331 / Có331)", async () => {
    const authedClient = await createTestAuthedClient();

    const lines = [
      {
        account_code: "156",
        debit: 1000000,
        credit: 0,
        description: "Nhập hàng",
      },
      {
        account_code: "1331",
        debit: 80000,
        credit: 0,
        description: "VAT đầu vào",
      },
      {
        account_code: "331",
        debit: 0,
        credit: 1080000,
        description: "Phải trả NCC",
      },
    ];

    const { data, error } = await authedClient.rpc("acc_create_journal_entry", {
      p_book: "INTERNAL",
      p_entry_date: "2026-06-07",
      p_doc_type: "purchase",
      p_source_ref_type: "purchase_order",
      p_source_ref_id: "TEST-ACC-001",
      p_description: "Mua hàng test kế toán",
      p_lines: lines,
    });

    expect(error).toBeNull();
    expect(typeof data).toBe("number");
    expect(data).toBeGreaterThan(0);

    // Kiểm tra journal_entry status + total_debit/credit
    const { data: entry, error: entryErr } = await adminClient
      .from("journal_entries")
      .select("status, total_debit, total_credit")
      .eq("id", data)
      .single();

    expect(entryErr).toBeNull();
    expect(entry?.status).toBe("draft");
    expect(Number(entry?.total_debit)).toBe(1080000);
    expect(Number(entry?.total_credit)).toBe(1080000);

    // Cleanup bút toán test
    await adminClient.from("journal_entries").delete().eq("id", data);
  }, 30000);

  it("bút toán lệch (Nợ 1.000.000 / Có 999.999) → lỗi cân bằng", async () => {
    const authedClient = await createTestAuthedClient();

    const lines = [
      {
        account_code: "156",
        debit: 1000000,
        credit: 0,
        description: "Nhập hàng",
      },
      {
        account_code: "331",
        debit: 0,
        credit: 999999,
        description: "Phải trả NCC",
      },
    ];

    const { data, error } = await authedClient.rpc("acc_create_journal_entry", {
      p_book: "INTERNAL",
      p_entry_date: "2026-06-07",
      p_doc_type: "purchase",
      p_source_ref_type: null,
      p_source_ref_id: null,
      p_description: "Bút toán lệch test",
      p_lines: lines,
    });

    expect(error).toBeDefined();
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/cân|Nợ|Có/);
    expect(data).toBeNull();
  }, 30000);
});

describe("post_journal_entry / void_journal_entry", () => {
  const DB_CONFIG = {
    host: "127.0.0.1",
    port: 54322,
    user: "postgres",
    password: "postgres",
    database: "postgres",
  };

  /** Resolve account_id (uuid) từ account_code qua pg direct */
  async function resolveAccountId(code: string): Promise<string> {
    const { Client } = await import("pg");
    const pg = new Client(DB_CONFIG);
    await pg.connect();
    try {
      const { rows } = await pg.query(
        `SELECT id FROM public.chart_of_accounts WHERE account_code = $1 LIMIT 1`,
        [code]
      );
      if (!rows[0])
        throw new Error(`Không tìm thấy TK ${code} trong chart_of_accounts`);
      return rows[0].id as string;
    } finally {
      await pg.end();
    }
  }

  it("post cập nhật số dư: TK 632 period_debit tăng, status=posted", async () => {
    const authedClient = await createTestAuthedClient();

    // Tạo bút toán: Nợ 632 500.000 / Có 156 500.000
    const lines = [
      {
        account_code: "632",
        debit: 500000,
        credit: 0,
        description: "Giá vốn hàng bán test",
      },
      {
        account_code: "156",
        debit: 0,
        credit: 500000,
        description: "Xuất kho test",
      },
    ];

    const { data: entryId, error: createErr } = await authedClient.rpc(
      "acc_create_journal_entry",
      {
        p_book: "INTERNAL",
        p_entry_date: "2026-06-07",
        p_doc_type: "sale",
        p_source_ref_type: "order",
        p_source_ref_id: "TEST-POST-001",
        p_description: "Test post bút toán giá vốn",
        p_lines: lines,
      }
    );

    expect(createErr).toBeNull();
    expect(typeof entryId).toBe("number");
    expect(entryId).toBeGreaterThan(0);

    // Lấy period_id của bút toán vừa tạo
    const { Client } = await import("pg");
    const pg = new Client(DB_CONFIG);
    await pg.connect();
    let periodId: string;
    try {
      const { rows } = await pg.query(
        `SELECT period_id FROM public.journal_entries WHERE id = $1`,
        [entryId]
      );
      periodId = rows[0].period_id as string;
    } finally {
      await pg.end();
    }

    // Post bút toán
    const { error: postErr } = await authedClient.rpc("post_journal_entry", {
      p_entry_id: entryId,
    });
    expect(postErr).toBeNull();

    // Kiểm tra status = 'posted'
    const { data: entry, error: entryErr } = await adminClient
      .from("journal_entries")
      .select("status, posted_at")
      .eq("id", entryId)
      .single();

    expect(entryErr).toBeNull();
    expect(entry?.status).toBe("posted");
    expect(entry?.posted_at).not.toBeNull();

    // Kiểm tra account_balances của TK 632
    const account632Id = await resolveAccountId("632");

    const { data: bal, error: balErr } = await adminClient
      .from("account_balances")
      .select("period_debit, period_credit")
      .eq("book", "INTERNAL")
      .eq("account_id", account632Id)
      .eq("period_id", periodId)
      .single();

    expect(balErr).toBeNull();
    expect(Number(bal?.period_debit)).toBeGreaterThanOrEqual(500000);

    // Cleanup
    const pg2 = new Client(DB_CONFIG);
    await pg2.connect();
    try {
      await pg2.query(
        `DELETE FROM public.account_balances WHERE book='INTERNAL' AND account_id=$1 AND period_id=$2`,
        [account632Id, periodId]
      );
      await pg2.query(`DELETE FROM public.journal_entries WHERE id=$1`, [
        entryId,
      ]);
    } finally {
      await pg2.end();
    }
  }, 60000);

  it("chặn post lại: post bút toán đã posted → lỗi", async () => {
    const authedClient = await createTestAuthedClient();

    const lines = [
      {
        account_code: "632",
        debit: 100000,
        credit: 0,
        description: "Giá vốn test lần 2",
      },
      {
        account_code: "156",
        debit: 0,
        credit: 100000,
        description: "Xuất kho test lần 2",
      },
    ];

    const { data: entryId, error: createErr } = await authedClient.rpc(
      "acc_create_journal_entry",
      {
        p_book: "INTERNAL",
        p_entry_date: "2026-06-07",
        p_doc_type: "sale",
        p_source_ref_type: "order",
        p_source_ref_id: "TEST-POST-002",
        p_description: "Test chặn post lại",
        p_lines: lines,
      }
    );

    expect(createErr).toBeNull();
    expect(entryId).toBeGreaterThan(0);

    // Post lần 1 — phải OK
    const { error: post1Err } = await authedClient.rpc("post_journal_entry", {
      p_entry_id: entryId,
    });
    expect(post1Err).toBeNull();

    // Post lần 2 — phải lỗi
    const { error: post2Err } = await authedClient.rpc("post_journal_entry", {
      p_entry_id: entryId,
    });
    expect(post2Err).not.toBeNull();
    expect(post2Err!.message).toMatch(/nháp|draft|posted/i);

    // Cleanup
    const { Client } = await import("pg");
    const pg = new Client(DB_CONFIG);
    await pg.connect();
    try {
      const account632Id = await resolveAccountId("632");
      const { rows } = await pg.query(
        `SELECT period_id FROM public.journal_entries WHERE id=$1`,
        [entryId]
      );
      if (rows[0]) {
        await pg.query(
          `DELETE FROM public.account_balances WHERE book='INTERNAL' AND account_id=$1 AND period_id=$2`,
          [account632Id, rows[0].period_id]
        );
      }
      await pg.query(`DELETE FROM public.journal_entries WHERE id=$1`, [
        entryId,
      ]);
    } finally {
      await pg.end();
    }
  }, 60000);
});

// ─── gen_journal_* tests ─────────────────────────────────────────────────────

describe("gen_journal_purchase / sale / cogs / payment", () => {
  const PG_CFG = {
    host: "127.0.0.1",
    port: 54322,
    user: "postgres",
    password: "postgres",
    database: "postgres",
  };

  /** Lấy tất cả dòng bút toán của một entry_id */
  async function fetchLines(
    entryId: number
  ): Promise<{ debit: number; credit: number; account_code: string }[]> {
    const { Client } = await import("pg");
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      const { rows } = await pg.query(
        `SELECT jel.debit, jel.credit, coa.account_code
         FROM public.journal_entry_lines jel
         JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
         WHERE jel.entry_id = $1`,
        [entryId]
      );
      return rows.map((r) => ({
        debit: Number(r.debit),
        credit: Number(r.credit),
        account_code: r.account_code as string,
      }));
    } finally {
      await pg.end();
    }
  }

  /** Xóa journal entry và finance_invoice test */
  async function cleanupEntry(entryId: number): Promise<void> {
    const { Client } = await import("pg");
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      await pg.query(`DELETE FROM public.journal_entries WHERE id = $1`, [
        entryId,
      ]);
    } finally {
      await pg.end();
    }
  }

  it("purchase: SUM(debit)=SUM(credit)=1080000 (Nợ156+Nợ1331 / Có331)", async () => {
    const authedClient = await createTestAuthedClient();

    // Seed finance_invoice qua pg superuser (bypass RLS)
    const { Client } = await import("pg");
    const pg = new Client(PG_CFG);
    await pg.connect();
    let invoiceId: number;
    try {
      const { rows } = await pg.query(
        `INSERT INTO public.finance_invoices(
           direction, status, invoice_number, invoice_date,
           total_amount_pre_tax, tax_amount, total_amount_post_tax
         ) VALUES ('inbound','verified','PUR-T1','2026-06-13',1000000,80000,1080000)
         RETURNING id`
      );
      invoiceId = rows[0].id as number;
    } finally {
      await pg.end();
    }

    try {
      const { data: entryId, error } = await authedClient.rpc(
        "gen_journal_purchase",
        { p_book: "TAX", p_invoice_id: invoiceId }
      );

      expect(error).toBeNull();
      expect(typeof entryId).toBe("number");
      expect(entryId).toBeGreaterThan(0);

      const lines = await fetchLines(entryId as number);
      const sumDebit = lines.reduce((s, l) => s + l.debit, 0);
      const sumCredit = lines.reduce((s, l) => s + l.credit, 0);

      expect(sumDebit).toBe(1080000);
      expect(sumCredit).toBe(1080000);
      // Kiểm tra đúng tài khoản
      expect(
        lines.some((l) => l.account_code === "156" && l.debit === 1000000)
      ).toBe(true);
      expect(
        lines.some((l) => l.account_code === "1331" && l.debit === 80000)
      ).toBe(true);
      expect(
        lines.some((l) => l.account_code === "331" && l.credit === 1080000)
      ).toBe(true);

      await cleanupEntry(entryId as number);
    } finally {
      // Cleanup invoice
      const pg2 = new Client(PG_CFG);
      await pg2.connect();
      try {
        await pg2.query(`DELETE FROM public.finance_invoices WHERE id = $1`, [
          invoiceId,
        ]);
      } finally {
        await pg2.end();
      }
    }
  }, 30000);

  it("sale: SUM(debit)=SUM(credit)=1080000 (Nợ131 / Có5111+Có33311)", async () => {
    const authedClient = await createTestAuthedClient();

    const { data: entryId, error } = await authedClient.rpc(
      "gen_journal_sale",
      {
        p_book: "TAX",
        p_source_id: "SO-T1",
        p_entry_date: "2026-06-13",
        p_partner: "KH-1",
        p_revenue: 1000000,
        p_vat: 80000,
      }
    );

    expect(error).toBeNull();
    expect(typeof entryId).toBe("number");
    expect(entryId).toBeGreaterThan(0);

    const lines = await fetchLines(entryId as number);
    const sumDebit = lines.reduce((s, l) => s + l.debit, 0);
    const sumCredit = lines.reduce((s, l) => s + l.credit, 0);

    expect(sumDebit).toBe(1080000);
    expect(sumCredit).toBe(1080000);

    await cleanupEntry(entryId as number);
  }, 30000);

  it("cogs: SUM(debit)=600000, TK 632 debit=600000", async () => {
    const authedClient = await createTestAuthedClient();

    const { data: entryId, error } = await authedClient.rpc(
      "gen_journal_cogs",
      {
        p_book: "INTERNAL",
        p_source_id: "SO-T1",
        p_entry_date: "2026-06-13",
        p_cogs: 600000,
      }
    );

    expect(error).toBeNull();
    expect(typeof entryId).toBe("number");
    expect(entryId).toBeGreaterThan(0);

    const lines = await fetchLines(entryId as number);
    const sumDebit = lines.reduce((s, l) => s + l.debit, 0);

    expect(sumDebit).toBe(600000);
    expect(
      lines.some((l) => l.account_code === "632" && l.debit === 600000)
    ).toBe(true);

    await cleanupEntry(entryId as number);
  }, 30000);

  it("payment: TK 635 debit=2000000 (Trả lãi vay)", async () => {
    const authedClient = await createTestAuthedClient();

    const { data: entryId, error } = await authedClient.rpc(
      "gen_journal_payment",
      {
        p_book: "INTERNAL",
        p_source_id: "PC-T1",
        p_entry_date: "2026-06-14",
        p_amount: 2000000,
        p_category_account: "635",
        p_fund_account: "112",
        p_partner: "VCB",
        p_desc: "Trả lãi vay",
      }
    );

    expect(error).toBeNull();
    expect(typeof entryId).toBe("number");
    expect(entryId).toBeGreaterThan(0);

    const lines = await fetchLines(entryId as number);
    const line635 = lines.find((l) => l.account_code === "635");

    expect(line635).toBeDefined();
    expect(line635!.debit).toBe(2000000);

    await cleanupEntry(entryId as number);
  }, 30000);
});

// ─── acc_close_period tests ───────────────────────────────────────────────────

describe("acc_close_period — khóa kỳ + kết chuyển (per-account, TT133)", () => {
  const PG_CFG = {
    host: "127.0.0.1",
    port: 54322,
    user: "postgres",
    password: "postgres",
    database: "postgres",
  };

  /** Resolve account_id (uuid) từ account_code */
  async function resolveAccountId(code: string): Promise<string> {
    const { Client } = await import("pg");
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      const { rows } = await pg.query(
        `SELECT id FROM public.chart_of_accounts WHERE account_code = $1 LIMIT 1`,
        [code]
      );
      if (!rows[0])
        throw new Error(`Không tìm thấy TK ${code} trong chart_of_accounts`);
      return rows[0].id as string;
    } finally {
      await pg.end();
    }
  }

  /** Dọn sạch toàn bộ dữ liệu kỳ test 2026-07 sổ actual */
  async function cleanupPeriod2026_07(): Promise<void> {
    const { Client } = await import("pg");
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      // Xóa theo thứ tự FK: entry_lines -> entries -> balances -> period
      await pg.query(
        `DELETE FROM public.journal_entry_lines
         WHERE entry_id IN (
           SELECT id FROM public.journal_entries
           WHERE book = 'INTERNAL'
             AND period_id IN (
               SELECT id FROM public.accounting_periods WHERE book='INTERNAL' AND year=2026 AND month=7
             )
         )`
      );
      await pg.query(
        `DELETE FROM public.journal_entries
         WHERE book = 'INTERNAL'
           AND period_id IN (
             SELECT id FROM public.accounting_periods WHERE book='INTERNAL' AND year=2026 AND month=7
           )`
      );
      // Cũng dọn kỳ tháng 8 (được tạo tự động bởi carry-forward)
      await pg.query(
        `DELETE FROM public.journal_entry_lines
         WHERE entry_id IN (
           SELECT id FROM public.journal_entries
           WHERE book = 'INTERNAL'
             AND period_id IN (
               SELECT id FROM public.accounting_periods WHERE book='INTERNAL' AND year=2026 AND month=8
             )
         )`
      );
      await pg.query(
        `DELETE FROM public.journal_entries
         WHERE book = 'INTERNAL'
           AND period_id IN (
             SELECT id FROM public.accounting_periods WHERE book='INTERNAL' AND year=2026 AND month=8
           )`
      );
      await pg.query(
        `DELETE FROM public.account_balances
         WHERE book = 'INTERNAL'
           AND period_id IN (
             SELECT id FROM public.accounting_periods WHERE book='INTERNAL' AND year=2026 AND month IN (7,8)
           )`
      );
      await pg.query(
        `DELETE FROM public.accounting_periods WHERE book='INTERNAL' AND year=2026 AND month IN (7,8)`
      );
    } finally {
      await pg.end();
    }
  }

  it("khóa kỳ 2026-07: lãi 400.000, 4212 closing_credit=400000, status=closed", async () => {
    // Cleanup trước để đảm bảo không có dữ liệu thừa
    await cleanupPeriod2026_07();

    const authedClient = await createTestAuthedClient();

    // (1) gen_journal_sale: doanh thu 1.000.000 (0 VAT)
    const { data: saleId, error: saleErr } = await authedClient.rpc(
      "gen_journal_sale",
      {
        p_book: "INTERNAL",
        p_source_id: "SO-CLOSE",
        p_entry_date: "2026-07-05",
        p_partner: "KH",
        p_revenue: 1000000,
        p_vat: 0,
      }
    );
    expect(saleErr).toBeNull();
    expect(saleId).toBeGreaterThan(0);

    // Post bút toán sale
    const { error: postSaleErr } = await authedClient.rpc(
      "post_journal_entry",
      { p_entry_id: saleId }
    );
    expect(postSaleErr).toBeNull();

    // (2) gen_journal_cogs: giá vốn 600.000
    const { data: cogsId, error: cogsErr } = await authedClient.rpc(
      "gen_journal_cogs",
      {
        p_book: "INTERNAL",
        p_source_id: "SO-CLOSE",
        p_entry_date: "2026-07-05",
        p_cogs: 600000,
      }
    );
    expect(cogsErr).toBeNull();
    expect(cogsId).toBeGreaterThan(0);

    // Post bút toán cogs
    const { error: postCogsErr } = await authedClient.rpc(
      "post_journal_entry",
      { p_entry_id: cogsId }
    );
    expect(postCogsErr).toBeNull();

    // (3) Khóa kỳ
    const { error: closeErr } = await authedClient.rpc("acc_close_period", {
      p_book: "INTERNAL",
      p_year: 2026,
      p_month: 7,
    });
    expect(closeErr).toBeNull();

    // (4a) Verify: accounting_periods status = 'closed'
    const { data: period, error: periodErr } = await adminClient
      .from("accounting_periods")
      .select("status, closed_at")
      .eq("book", "INTERNAL")
      .eq("year", 2026)
      .eq("month", 7)
      .single();

    expect(periodErr).toBeNull();
    expect(period?.status).toBe("closed");
    expect(period?.closed_at).not.toBeNull();

    // (4b) Verify: có >=1 journal_entries doc_type='closing' book='INTERNAL' status='posted'
    const { data: closingEntries, error: ceErr } = await adminClient
      .from("journal_entries")
      .select("id, doc_type, status")
      .eq("book", "INTERNAL")
      .eq("doc_type", "closing")
      .eq("status", "posted");

    expect(ceErr).toBeNull();
    expect(closingEntries).not.toBeNull();
    expect(closingEntries!.length).toBeGreaterThanOrEqual(1);

    // (4c) Verify: 4212 closing_credit = 400.000
    const { Client } = await import("pg");
    const pg = new Client(PG_CFG);
    await pg.connect();
    let account4212Id: string;
    let periodId: string;
    try {
      const { rows: accRows } = await pg.query(
        `SELECT id FROM public.chart_of_accounts WHERE account_code = '4212' LIMIT 1`
      );
      expect(accRows[0]).toBeDefined();
      account4212Id = accRows[0].id as string;

      const { rows: perRows } = await pg.query(
        `SELECT id FROM public.accounting_periods WHERE book='INTERNAL' AND year=2026 AND month=7 LIMIT 1`
      );
      expect(perRows[0]).toBeDefined();
      periodId = perRows[0].id as string;
    } finally {
      await pg.end();
    }

    const { data: bal4212, error: balErr } = await adminClient
      .from("account_balances")
      .select("closing_credit, closing_debit, period_credit, period_debit")
      .eq("book", "INTERNAL")
      .eq("account_id", account4212Id!)
      .eq("period_id", periodId!)
      .single();

    expect(balErr).toBeNull();
    // Lãi = 1.000.000 - 600.000 = 400.000 → 4212 Có 400.000
    expect(Number(bal4212?.closing_credit)).toBe(400000);

    // (4d) Tùy chọn: Số dư net 5111 sau kết chuyển = 0 (period_credit - period_debit)
    // Sau khi post closing entry Nợ 5111, period_debit của 5111 tăng thêm 1.000.000
    // => net = (period_credit 1.000.000) - (period_debit 1.000.000) = 0
    const account5111Id = await resolveAccountId("5111");
    const { data: bal5111, error: bal5111Err } = await adminClient
      .from("account_balances")
      .select("period_debit, period_credit")
      .eq("book", "INTERNAL")
      .eq("account_id", account5111Id)
      .eq("period_id", periodId!)
      .single();

    expect(bal5111Err).toBeNull();
    const net5111 =
      Number(bal5111?.period_credit) - Number(bal5111?.period_debit);
    expect(net5111).toBe(0);

    // (4e) Tùy chọn: Số dư net 632 sau kết chuyển = 0
    const account632Id = await resolveAccountId("632");
    const { data: bal632, error: bal632Err } = await adminClient
      .from("account_balances")
      .select("period_debit, period_credit")
      .eq("book", "INTERNAL")
      .eq("account_id", account632Id)
      .eq("period_id", periodId!)
      .single();

    expect(bal632Err).toBeNull();
    const net632 = Number(bal632?.period_debit) - Number(bal632?.period_credit);
    expect(net632).toBe(0);

    // Cleanup
    await cleanupPeriod2026_07();
  }, 120000);

  it("gọi acc_close_period lần 2 → lỗi 'Kỳ đã khóa'", async () => {
    await cleanupPeriod2026_07();
    const authedClient = await createTestAuthedClient();

    // Tạo minimal data và đóng kỳ
    const { data: saleId } = await authedClient.rpc("gen_journal_sale", {
      p_book: "INTERNAL",
      p_source_id: "SO-CLOSE-2",
      p_entry_date: "2026-07-10",
      p_partner: "KH2",
      p_revenue: 500000,
      p_vat: 0,
    });
    await authedClient.rpc("post_journal_entry", { p_entry_id: saleId });
    await authedClient.rpc("acc_close_period", {
      p_book: "INTERNAL",
      p_year: 2026,
      p_month: 7,
    });

    // Gọi lần 2 → phải lỗi
    const { error: closeErr2 } = await authedClient.rpc("acc_close_period", {
      p_book: "INTERNAL",
      p_year: 2026,
      p_month: 7,
    });
    expect(closeErr2).not.toBeNull();
    expect(closeErr2!.message).toMatch(/đã khóa/i);

    await cleanupPeriod2026_07();
  }, 60000);
});

// ─── Edge: purchase không VAT ────────────────────────────────────────────────

describe("gen_journal_purchase — edge: hóa đơn không VAT (tax=0)", () => {
  const PG_CFG = {
    host: "127.0.0.1",
    port: 54322,
    user: "postgres",
    password: "postgres",
    database: "postgres",
  };

  it("chỉ 2 dòng (Nợ156/Có331), không có dòng 1331", async () => {
    const authedClient = await createTestAuthedClient();
    const { Client } = await import("pg");

    // Seed finance_invoice không có VAT
    const pg = new Client(PG_CFG);
    await pg.connect();
    let invoiceId: number;
    try {
      const { rows } = await pg.query(
        `INSERT INTO public.finance_invoices(
           direction, status, invoice_number, invoice_date,
           total_amount_pre_tax, tax_amount, total_amount_post_tax
         ) VALUES ('inbound','verified','NOVAT-1','2026-06-01',500000,0,500000)
         RETURNING id`
      );
      invoiceId = rows[0].id as number;
    } finally {
      await pg.end();
    }

    try {
      const { data: entryId, error } = await authedClient.rpc(
        "gen_journal_purchase",
        { p_book: "TAX", p_invoice_id: invoiceId }
      );

      expect(error).toBeNull();
      expect(typeof entryId).toBe("number");
      expect(entryId).toBeGreaterThan(0);

      // Lấy các dòng bút toán
      const pg2 = new Client(PG_CFG);
      await pg2.connect();
      let lines: { debit: number; credit: number; account_code: string }[];
      try {
        const { rows } = await pg2.query(
          `SELECT jel.debit, jel.credit, coa.account_code
           FROM public.journal_entry_lines jel
           JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
           WHERE jel.entry_id = $1`,
          [entryId]
        );
        lines = rows.map((r) => ({
          debit: Number(r.debit),
          credit: Number(r.credit),
          account_code: r.account_code as string,
        }));
      } finally {
        await pg2.end();
      }

      // Assert: đúng 2 dòng, không có 1331
      expect(lines.length).toBe(2);
      expect(lines.some((l) => l.account_code === "1331")).toBe(false);

      // Assert: Nợ 156 = 500000, Có 331 = 500000
      expect(
        lines.some((l) => l.account_code === "156" && l.debit === 500000)
      ).toBe(true);
      expect(
        lines.some((l) => l.account_code === "331" && l.credit === 500000)
      ).toBe(true);

      // Assert: SUM cân bằng
      const sumDebit = lines.reduce((s, l) => s + l.debit, 0);
      const sumCredit = lines.reduce((s, l) => s + l.credit, 0);
      expect(sumDebit).toBe(500000);
      expect(sumCredit).toBe(500000);

      // Cleanup entry
      const pg3 = new Client(PG_CFG);
      await pg3.connect();
      try {
        await pg3.query(`DELETE FROM public.journal_entries WHERE id = $1`, [
          entryId,
        ]);
      } finally {
        await pg3.end();
      }
    } finally {
      // Cleanup invoice
      const pg4 = new Client(PG_CFG);
      await pg4.connect();
      try {
        await pg4.query(`DELETE FROM public.finance_invoices WHERE id = $1`, [
          invoiceId!,
        ]);
      } finally {
        await pg4.end();
      }
    }
  }, 30000);
});

// ─── E2E vòng đầy đủ kỳ 2026-08 (lãi 200.000) ──────────────────────────────

describe("E2E vòng đầy đủ — kỳ 2026-08 (actual, lãi 200.000)", () => {
  const PG_CFG = {
    host: "127.0.0.1",
    port: 54322,
    user: "postgres",
    password: "postgres",
    database: "postgres",
  };

  /** Dọn sạch kỳ test 2026-08 và 2026-09 (carry-forward) sổ actual */
  async function cleanupPeriods(months: number[]): Promise<void> {
    const { Client } = await import("pg");
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      for (const m of months) {
        await pg.query(
          `DELETE FROM public.journal_entry_lines
           WHERE entry_id IN (
             SELECT id FROM public.journal_entries
             WHERE book = 'INTERNAL'
               AND period_id IN (
                 SELECT id FROM public.accounting_periods
                 WHERE book='INTERNAL' AND year=2026 AND month=$1
               )
           )`,
          [m]
        );
        await pg.query(
          `DELETE FROM public.journal_entries
           WHERE book = 'INTERNAL'
             AND period_id IN (
               SELECT id FROM public.accounting_periods
               WHERE book='INTERNAL' AND year=2026 AND month=$1
             )`,
          [m]
        );
        await pg.query(
          `DELETE FROM public.account_balances
           WHERE book = 'INTERNAL'
             AND period_id IN (
               SELECT id FROM public.accounting_periods
               WHERE book='INTERNAL' AND year=2026 AND month=$1
             )`,
          [m]
        );
        await pg.query(
          `DELETE FROM public.accounting_periods
           WHERE book='INTERNAL' AND year=2026 AND month=$1`,
          [m]
        );
      }
    } finally {
      await pg.end();
    }
  }

  it("doanh thu 1M - COGS 600K - chi phí 200K = lãi 200K, 4212 closing_credit−closing_debit=200000", async () => {
    // Cleanup trước để đảm bảo kỳ sạch (kỳ 8 + kỳ 9 carry-forward)
    await cleanupPeriods([8, 9, 10]);

    const authedClient = await createTestAuthedClient();
    const { Client } = await import("pg");

    // (1) Purchase: insert finance_invoice + gen_journal_purchase + post
    const pg = new Client(PG_CFG);
    await pg.connect();
    let invoiceId: number;
    try {
      const { rows } = await pg.query(
        `INSERT INTO public.finance_invoices(
           direction, status, invoice_number, invoice_date,
           total_amount_pre_tax, tax_amount, total_amount_post_tax
         ) VALUES ('inbound','verified','E2E-PUR','2026-08-05',500000,0,500000)
         RETURNING id`
      );
      invoiceId = rows[0].id as number;
    } finally {
      await pg.end();
    }

    const { data: purId, error: purErr } = await authedClient.rpc(
      "gen_journal_purchase",
      { p_book: "INTERNAL", p_invoice_id: invoiceId }
    );
    expect(purErr).toBeNull();
    expect(purId).toBeGreaterThan(0);

    const { error: postPurErr } = await authedClient.rpc("post_journal_entry", {
      p_entry_id: purId,
    });
    expect(postPurErr).toBeNull();

    // (2) Sale: doanh thu 1.000.000, VAT=0
    const { data: saleId, error: saleErr } = await authedClient.rpc(
      "gen_journal_sale",
      {
        p_book: "INTERNAL",
        p_source_id: "E2E-SO",
        p_entry_date: "2026-08-10",
        p_partner: "KH-E2E",
        p_revenue: 1000000,
        p_vat: 0,
      }
    );
    expect(saleErr).toBeNull();
    expect(saleId).toBeGreaterThan(0);

    const { error: postSaleErr } = await authedClient.rpc(
      "post_journal_entry",
      {
        p_entry_id: saleId,
      }
    );
    expect(postSaleErr).toBeNull();

    // (3) COGS: 600.000
    const { data: cogsId, error: cogsErr } = await authedClient.rpc(
      "gen_journal_cogs",
      {
        p_book: "INTERNAL",
        p_source_id: "E2E-SO",
        p_entry_date: "2026-08-10",
        p_cogs: 600000,
      }
    );
    expect(cogsErr).toBeNull();
    expect(cogsId).toBeGreaterThan(0);

    const { error: postCogsErr } = await authedClient.rpc(
      "post_journal_entry",
      {
        p_entry_id: cogsId,
      }
    );
    expect(postCogsErr).toBeNull();

    // (4) Payment chi phí bán hàng: 200.000 (Nợ 6421 / Có 111)
    const { data: payId, error: payErr } = await authedClient.rpc(
      "gen_journal_payment",
      {
        p_book: "INTERNAL",
        p_source_id: "E2E-PC",
        p_entry_date: "2026-08-12",
        p_amount: 200000,
        p_category_account: "6421",
        p_fund_account: "111",
        p_partner: "NCC",
        p_desc: "Chi vận chuyển",
      }
    );
    expect(payErr).toBeNull();
    expect(payId).toBeGreaterThan(0);

    const { error: postPayErr } = await authedClient.rpc("post_journal_entry", {
      p_entry_id: payId,
    });
    expect(postPayErr).toBeNull();

    // (5) Khóa kỳ 2026-08
    const { error: closeErr } = await authedClient.rpc("acc_close_period", {
      p_book: "INTERNAL",
      p_year: 2026,
      p_month: 8,
    });
    expect(closeErr).toBeNull();

    // (6) Verify kỳ 2026-08 status='closed'
    const { data: period, error: periodErr } = await adminClient
      .from("accounting_periods")
      .select("status")
      .eq("book", "INTERNAL")
      .eq("year", 2026)
      .eq("month", 8)
      .single();

    expect(periodErr).toBeNull();
    expect(period?.status).toBe("closed");

    // (7) Verify 4212: closing_credit − closing_debit = 200.000 (lãi)
    const pg2 = new Client(PG_CFG);
    await pg2.connect();
    let account4212Id: string;
    let periodId8: string;
    try {
      const { rows: accRows } = await pg2.query(
        `SELECT id::text FROM public.chart_of_accounts WHERE account_code='4212' LIMIT 1`
      );
      expect(accRows[0]).toBeDefined();
      account4212Id = accRows[0].id as string;

      const { rows: perRows } = await pg2.query(
        `SELECT id FROM public.accounting_periods WHERE book='INTERNAL' AND year=2026 AND month=8 LIMIT 1`
      );
      expect(perRows[0]).toBeDefined();
      periodId8 = perRows[0].id as string;
    } finally {
      await pg2.end();
    }

    const { data: bal4212, error: balErr } = await adminClient
      .from("account_balances")
      .select("closing_credit, closing_debit")
      .eq("book", "INTERNAL")
      .eq("account_id", account4212Id!)
      .eq("period_id", periodId8!)
      .single();

    expect(balErr).toBeNull();
    const net4212 =
      Number(bal4212?.closing_credit) - Number(bal4212?.closing_debit);
    // Lãi = 1.000.000 - 600.000 - 200.000 = 200.000 → Có 4212 net = 200.000
    expect(net4212).toBe(200000);

    // Cleanup (kỳ 8 + kỳ 9 carry-forward + invoice)
    await cleanupPeriods([8, 9, 10]);
    const pg3 = new Client(PG_CFG);
    await pg3.connect();
    try {
      await pg3.query(
        `DELETE FROM public.finance_invoices WHERE invoice_number='E2E-PUR'`
      );
    } finally {
      await pg3.end();
    }
  }, 120000);
});

// ─── Regression #2: carry-forward KHÔNG xóa phát sinh kỳ kế tiếp ──────────

describe("Regression #2 — carry-forward giữ phát sinh kỳ N+1 (2026-10/11)", () => {
  const PG_CFG = {
    host: "127.0.0.1",
    port: 54322,
    user: "postgres",
    password: "postgres",
    database: "postgres",
  };

  /** Dọn sạch kỳ test 2026-10 và 2026-11 sổ actual */
  async function cleanupPeriods1011(): Promise<void> {
    const { Client } = await import("pg");
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      for (const m of [10, 11, 12]) {
        await pg.query(
          `DELETE FROM public.journal_entry_lines
           WHERE entry_id IN (
             SELECT id FROM public.journal_entries
             WHERE book='INTERNAL'
               AND period_id IN (
                 SELECT id FROM public.accounting_periods
                 WHERE book='INTERNAL' AND year=2026 AND month=$1
               )
           )`,
          [m]
        );
        await pg.query(
          `DELETE FROM public.journal_entries
           WHERE book='INTERNAL'
             AND period_id IN (
               SELECT id FROM public.accounting_periods
               WHERE book='INTERNAL' AND year=2026 AND month=$1
             )`,
          [m]
        );
        await pg.query(
          `DELETE FROM public.account_balances
           WHERE book='INTERNAL'
             AND period_id IN (
               SELECT id FROM public.accounting_periods
               WHERE book='INTERNAL' AND year=2026 AND month=$1
             )`,
          [m]
        );
        await pg.query(
          `DELETE FROM public.accounting_periods
           WHERE book='INTERNAL' AND year=2026 AND month=$1`,
          [m]
        );
      }
    } finally {
      await pg.end();
    }
  }

  it("đóng kỳ N (10/2026) KHÔNG xóa phát sinh kỳ N+1 (11/2026): 156 opening=700000, period=300000, closing=1000000", async () => {
    await cleanupPeriods1011();

    const authedClient = await createTestAuthedClient();
    const { Client } = await import("pg");

    // Bước 1: Tạo finance_invoice cho kỳ N (2026-10), inbound, 700000 không VAT
    const pg = new Client(PG_CFG);
    await pg.connect();
    let invoiceN: number;
    let invoiceN1: number;
    try {
      const { rows: r1 } = await pg.query(
        `INSERT INTO public.finance_invoices(
           direction, status, invoice_number, invoice_date,
           total_amount_pre_tax, tax_amount, total_amount_post_tax
         ) VALUES ('inbound','verified','REG2-OCT-2026','2026-10-15',700000,0,700000)
         RETURNING id`
      );
      invoiceN = r1[0].id as number;

      // Bước 2: Tạo finance_invoice cho kỳ N+1 (2026-11), inbound, 300000 không VAT
      const { rows: r2 } = await pg.query(
        `INSERT INTO public.finance_invoices(
           direction, status, invoice_number, invoice_date,
           total_amount_pre_tax, tax_amount, total_amount_post_tax
         ) VALUES ('inbound','verified','REG2-NOV-2026','2026-11-05',300000,0,300000)
         RETURNING id`
      );
      invoiceN1 = r2[0].id as number;
    } finally {
      await pg.end();
    }

    try {
      // Bút toán kỳ N: Nợ156 700000 / Có331 700000
      const { data: entryN, error: errN } = await authedClient.rpc(
        "gen_journal_purchase",
        { p_book: "INTERNAL", p_invoice_id: invoiceN }
      );
      expect(errN).toBeNull();
      expect(entryN).toBeGreaterThan(0);

      const { error: postNErr } = await authedClient.rpc("post_journal_entry", {
        p_entry_id: entryN,
      });
      expect(postNErr).toBeNull();

      // Bút toán kỳ N+1 (TRƯỚC khi đóng N): Nợ156 300000 / Có331 300000
      const { data: entryN1, error: errN1 } = await authedClient.rpc(
        "gen_journal_purchase",
        { p_book: "INTERNAL", p_invoice_id: invoiceN1 }
      );
      expect(errN1).toBeNull();
      expect(entryN1).toBeGreaterThan(0);

      const { error: postN1Err } = await authedClient.rpc(
        "post_journal_entry",
        {
          p_entry_id: entryN1,
        }
      );
      expect(postN1Err).toBeNull();

      // Verify kỳ N+1 TRƯỚC khi đóng N: 156 period_debit = 300000
      const pg2 = new Client(PG_CFG);
      await pg2.connect();
      let account156Id: string;
      let periodN1Id: string;
      try {
        const { rows: accRows } = await pg2.query(
          `SELECT id FROM public.chart_of_accounts WHERE account_code='156' LIMIT 1`
        );
        expect(accRows[0]).toBeDefined();
        account156Id = accRows[0].id as string;

        const { rows: perRows } = await pg2.query(
          `SELECT id FROM public.accounting_periods WHERE book='INTERNAL' AND year=2026 AND month=11 LIMIT 1`
        );
        expect(perRows[0]).toBeDefined();
        periodN1Id = perRows[0].id as string;
      } finally {
        await pg2.end();
      }

      const { data: balBefore, error: balBeforeErr } = await adminClient
        .from("account_balances")
        .select("period_debit, period_credit")
        .eq("book", "INTERNAL")
        .eq("account_id", account156Id!)
        .eq("period_id", periodN1Id!)
        .single();
      expect(balBeforeErr).toBeNull();
      expect(Number(balBefore?.period_debit)).toBe(300000);

      // Đóng kỳ N (2026-10)
      const { error: closeErr } = await authedClient.rpc("acc_close_period", {
        p_book: "INTERNAL",
        p_year: 2026,
        p_month: 10,
      });
      expect(closeErr).toBeNull();

      // VERIFY kỳ N+1 (2026-11) sau khi đóng N:
      // TK 156: opening_debit=700000, period_debit=300000, closing_debit=1000000
      const { data: bal156, error: bal156Err } = await adminClient
        .from("account_balances")
        .select(
          "opening_debit, opening_credit, period_debit, period_credit, closing_debit, closing_credit"
        )
        .eq("book", "INTERNAL")
        .eq("account_id", account156Id!)
        .eq("period_id", periodN1Id!)
        .single();

      expect(bal156Err).toBeNull();
      // opening phải = net closing kỳ N = 700000
      expect(Number(bal156?.opening_debit)).toBe(700000);
      expect(Number(bal156?.opening_credit)).toBe(0);
      // period phải GIỮ NGUYÊN (không bị xóa bởi carry-forward)
      expect(Number(bal156?.period_debit)).toBe(300000);
      // closing = opening + period = 1000000 (điểm mấu chốt fix #2)
      expect(Number(bal156?.closing_debit)).toBe(1000000);

      // TK 331 (đối ứng): opening_credit=700000, period_credit=300000, closing_credit=1000000
      const pg3 = new Client(PG_CFG);
      await pg3.connect();
      let account331Id: string;
      try {
        const { rows } = await pg3.query(
          `SELECT id FROM public.chart_of_accounts WHERE account_code='331' LIMIT 1`
        );
        expect(rows[0]).toBeDefined();
        account331Id = rows[0].id as string;
      } finally {
        await pg3.end();
      }

      const { data: bal331, error: bal331Err } = await adminClient
        .from("account_balances")
        .select(
          "opening_debit, opening_credit, period_debit, period_credit, closing_debit, closing_credit"
        )
        .eq("book", "INTERNAL")
        .eq("account_id", account331Id!)
        .eq("period_id", periodN1Id!)
        .single();

      expect(bal331Err).toBeNull();
      expect(Number(bal331?.opening_credit)).toBe(700000);
      expect(Number(bal331?.period_credit)).toBe(300000);
      expect(Number(bal331?.closing_credit)).toBe(1000000);
    } finally {
      // Cleanup invoices
      const pg4 = new Client(PG_CFG);
      await pg4.connect();
      try {
        await pg4.query(
          `DELETE FROM public.finance_invoices WHERE invoice_number IN ('REG2-OCT-2026','REG2-NOV-2026')`
        );
      } finally {
        await pg4.end();
      }
      await cleanupPeriods1011();
    }
  }, 120000);
});

// ─── create_invoice_payment ──────────────────────────────────────────────────

describe("create_invoice_payment — thanh toán HĐ + bù trừ chênh lệch 2 sổ", () => {
  const PG_CFG = {
    host: "127.0.0.1",
    port: 54322,
    user: "postgres",
    password: "postgres",
    database: "postgres",
  };

  let fundBankId: number; // fund có account_id='112', type='bank'
  let fundCashId: number; // fund có account_id='111', type='cash'

  /** Tạo finance_invoice test (inbound) qua pg superuser */
  async function seedInvoice(opts: {
    invoiceNumber: string;
    total: number;
  }): Promise<number> {
    const { Client } = await import("pg");
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      const { rows } = await pg.query(
        `INSERT INTO public.finance_invoices(
           direction, status, invoice_number, invoice_date,
           total_amount_pre_tax, tax_amount, total_amount_post_tax
         ) VALUES ('inbound','verified',$1,'2026-06-07',$2,0,$2)
         RETURNING id`,
        [opts.invoiceNumber, opts.total]
      );
      return rows[0].id as number;
    } finally {
      await pg.end();
    }
  }

  /** Lấy tất cả dòng bút toán của entry (kèm account_code) */
  async function fetchLines(
    entryId: number
  ): Promise<{ debit: number; credit: number; account_code: string }[]> {
    const { Client } = await import("pg");
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      const { rows } = await pg.query(
        `SELECT jel.debit, jel.credit, coa.account_code
         FROM public.journal_entry_lines jel
         JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
         WHERE jel.entry_id = $1`,
        [entryId]
      );
      return rows.map((r) => ({
        debit: Number(r.debit),
        credit: Number(r.credit),
        account_code: r.account_code as string,
      }));
    } finally {
      await pg.end();
    }
  }

  /** Lấy book của journal_entry */
  async function fetchEntryBook(entryId: number): Promise<string> {
    const { Client } = await import("pg");
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      const { rows } = await pg.query(
        `SELECT book FROM public.journal_entries WHERE id = $1`,
        [entryId]
      );
      return rows[0]?.book as string;
    } finally {
      await pg.end();
    }
  }

  beforeAll(async () => {
    const { Client } = await import("pg");
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      // Seed fund_account bank (TK 112)
      const { rows: bankRows } = await pg.query(
        `INSERT INTO public.fund_accounts(name, type, account_id, initial_balance, balance, status)
         VALUES('Test Bank 112','bank','112',0,0,'active')
         RETURNING id`
      );
      fundBankId = bankRows[0].id as number;

      // Seed fund_account cash (TK 111)
      const { rows: cashRows } = await pg.query(
        `INSERT INTO public.fund_accounts(name, type, account_id, initial_balance, balance, status)
         VALUES('Test Cash 111','cash','111',0,0,'active')
         RETURNING id`
      );
      fundCashId = cashRows[0].id as number;

      await pg.query("NOTIFY pgrst, 'reload schema'");
      await new Promise((r) => setTimeout(r, 500));
    } finally {
      await pg.end();
    }
  }, 30000);

  afterAll(async () => {
    const { Client } = await import("pg");
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      await pg.query(`DELETE FROM public.fund_accounts WHERE id IN ($1,$2)`, [
        fundBankId,
        fundCashId,
      ]);
    } finally {
      await pg.end();
    }
  });

  it("Case 1 — đúng bằng: total=1.000.000, actual=1.000.000, fund=bank → difference=0, 2 entry chính, payment_status=PAID", async () => {
    const authedClient = await createTestAuthedClient();
    const invoiceId = await seedInvoice({
      invoiceNumber: "PAY-CASE1",
      total: 1000000,
    });

    try {
      const { data, error } = await authedClient.rpc("create_invoice_payment", {
        p_invoice_id: invoiceId,
        p_actual_amount: 1000000,
        p_fund_account_id: fundBankId,
        p_entry_date: "2026-06-07",
        p_partner: "NCC-TEST",
        p_desc: "Test thanh toán đúng bằng",
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();

      const result = data as {
        entry_ids: number[];
        warning: string | null;
        difference: number;
      };

      // difference = 0
      expect(Number(result.difference)).toBe(0);
      // warning = null (fund là bank, không phải cash)
      expect(result.warning).toBeNull();
      // Đúng 2 entry (INTERNAL + TAX), không có entry bù trừ
      expect(result.entry_ids.length).toBe(2);

      // Kiểm tra dòng bút toán: mỗi entry phải có Nợ331=1.000.000 và Có112=1.000.000
      for (const entryId of result.entry_ids) {
        const lines = await fetchLines(entryId);
        const line331 = lines.find((l) => l.account_code === "331");
        const line112 = lines.find((l) => l.account_code === "112");
        expect(line331).toBeDefined();
        expect(line331!.debit).toBe(1000000);
        expect(line112).toBeDefined();
        expect(line112!.credit).toBe(1000000);
        // Không có 711 hay 811
        expect(lines.some((l) => l.account_code === "711")).toBe(false);
        expect(lines.some((l) => l.account_code === "811")).toBe(false);
      }

      // Kiểm tra cả 2 sổ: entry[0] INTERNAL, entry[1] TAX (hoặc thứ tự bất kỳ nhưng phải có cả 2)
      const books = await Promise.all(result.entry_ids.map(fetchEntryBook));
      expect(books).toContain("INTERNAL");
      expect(books).toContain("TAX");

      // Kiểm tra finance_invoices
      const { Client } = await import("pg");
      const pg = new Client(PG_CFG);
      await pg.connect();
      try {
        const { rows } = await pg.query(
          `SELECT payment_status, paid_amount FROM public.finance_invoices WHERE id = $1`,
          [invoiceId]
        );
        expect(rows[0].payment_status).toBe("PAID");
        expect(Number(rows[0].paid_amount)).toBe(1000000);
      } finally {
        await pg.end();
      }
    } finally {
      // Cleanup invoice (entries xóa cascade qua journal_entries)
      const { Client } = await import("pg");
      const pg = new Client(PG_CFG);
      await pg.connect();
      try {
        await pg.query(
          `DELETE FROM public.journal_entry_lines
           WHERE entry_id IN (
             SELECT id FROM public.journal_entries WHERE source_ref_id = $1
           )`,
          [invoiceId.toString()]
        );
        await pg.query(
          `DELETE FROM public.journal_entries WHERE source_ref_id = $1`,
          [invoiceId.toString()]
        );
        await pg.query(`DELETE FROM public.finance_invoices WHERE id = $1`, [
          invoiceId,
        ]);
      } finally {
        await pg.end();
      }
    }
  }, 60000);

  it("Case 2 — trả ít hơn: total=10.500.000, actual=10.000.000, fund=cash → diff=500.000, warning!=null, entry bù trừ Có711=500.000, sổ TAX không có 711", async () => {
    const authedClient = await createTestAuthedClient();
    const invoiceId = await seedInvoice({
      invoiceNumber: "PAY-CASE2",
      total: 10500000,
    });

    try {
      const { data, error } = await authedClient.rpc("create_invoice_payment", {
        p_invoice_id: invoiceId,
        p_actual_amount: 10000000,
        p_fund_account_id: fundCashId,
        p_entry_date: "2026-06-07",
        p_partner: "NCC-TEST",
        p_desc: "Test trả ít hơn HĐ",
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();

      const result = data as {
        entry_ids: number[];
        warning: string | null;
        difference: number;
      };

      // difference = 500.000 (trả ít)
      expect(Number(result.difference)).toBe(500000);
      // warning != null (total >= 5tr + cash)
      expect(result.warning).not.toBeNull();
      expect(result.warning).toMatch(/5 triệu|ngân hàng/i);
      // 3 entry: 2 chính (INTERNAL+TAX) + 1 bù trừ INTERNAL
      expect(result.entry_ids.length).toBe(3);

      // Xác định entry bù trừ (entry thứ 3)
      const diffEntryId = result.entry_ids[2];
      const diffLines = await fetchLines(diffEntryId);

      // Entry bù trừ INTERNAL: Nợ111=500.000 / Có711=500.000
      const line711 = diffLines.find((l) => l.account_code === "711");
      expect(line711).toBeDefined();
      expect(line711!.credit).toBe(500000);

      const line111_diff = diffLines.find(
        (l) => l.account_code === "111" && l.debit > 0
      );
      expect(line111_diff).toBeDefined();
      expect(line111_diff!.debit).toBe(500000);

      // Kiểm tra sổ của entry bù trừ = INTERNAL
      const diffBook = await fetchEntryBook(diffEntryId);
      expect(diffBook).toBe("INTERNAL");

      // Sổ TAX KHÔNG có TK 711 — tìm entry TAX trong 2 entry chính
      const mainBooks = await Promise.all(
        result.entry_ids.slice(0, 2).map(fetchEntryBook)
      );
      const taxEntryIdActual = result.entry_ids[mainBooks.indexOf("TAX")];
      const taxLines = await fetchLines(taxEntryIdActual);
      expect(taxLines.some((l) => l.account_code === "711")).toBe(false);

      // payment_status = PAID
      const { Client } = await import("pg");
      const pg = new Client(PG_CFG);
      await pg.connect();
      try {
        const { rows } = await pg.query(
          `SELECT payment_status, paid_amount FROM public.finance_invoices WHERE id = $1`,
          [invoiceId]
        );
        expect(rows[0].payment_status).toBe("PAID");
        expect(Number(rows[0].paid_amount)).toBe(10500000);
      } finally {
        await pg.end();
      }
    } finally {
      const { Client } = await import("pg");
      const pg = new Client(PG_CFG);
      await pg.connect();
      try {
        await pg.query(
          `DELETE FROM public.journal_entry_lines
           WHERE entry_id IN (
             SELECT id FROM public.journal_entries WHERE source_ref_id = $1
           )`,
          [invoiceId.toString()]
        );
        await pg.query(
          `DELETE FROM public.journal_entries WHERE source_ref_id = $1`,
          [invoiceId.toString()]
        );
        await pg.query(`DELETE FROM public.finance_invoices WHERE id = $1`, [
          invoiceId,
        ]);
      } finally {
        await pg.end();
      }
    }
  }, 60000);

  it("Case 3 — trả nhiều hơn: total=1.000.000, actual=1.200.000, fund=bank → diff=-200.000, entry bù trừ Nợ811=200.000", async () => {
    const authedClient = await createTestAuthedClient();
    const invoiceId = await seedInvoice({
      invoiceNumber: "PAY-CASE3",
      total: 1000000,
    });

    try {
      const { data, error } = await authedClient.rpc("create_invoice_payment", {
        p_invoice_id: invoiceId,
        p_actual_amount: 1200000,
        p_fund_account_id: fundBankId,
        p_entry_date: "2026-06-07",
        p_partner: "NCC-TEST",
        p_desc: "Test trả nhiều hơn HĐ",
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();

      const result = data as {
        entry_ids: number[];
        warning: string | null;
        difference: number;
      };

      // difference = -200.000 (trả nhiều)
      expect(Number(result.difference)).toBe(-200000);
      // 3 entry: 2 chính + 1 bù trừ
      expect(result.entry_ids.length).toBe(3);

      // Entry bù trừ: Nợ811=200.000 / Có112=200.000
      const diffEntryId = result.entry_ids[2];
      const diffLines = await fetchLines(diffEntryId);

      const line811 = diffLines.find((l) => l.account_code === "811");
      expect(line811).toBeDefined();
      expect(line811!.debit).toBe(200000);

      const line112_credit = diffLines.find(
        (l) => l.account_code === "112" && l.credit > 0
      );
      expect(line112_credit).toBeDefined();
      expect(line112_credit!.credit).toBe(200000);

      // Sổ bù trừ = INTERNAL
      const diffBook = await fetchEntryBook(diffEntryId);
      expect(diffBook).toBe("INTERNAL");

      // payment_status = PAID
      const { Client } = await import("pg");
      const pg = new Client(PG_CFG);
      await pg.connect();
      try {
        const { rows } = await pg.query(
          `SELECT payment_status, paid_amount FROM public.finance_invoices WHERE id = $1`,
          [invoiceId]
        );
        expect(rows[0].payment_status).toBe("PAID");
        // paid_amount = v_total = 1.000.000 (công nợ chính thức)
        expect(Number(rows[0].paid_amount)).toBe(1000000);
      } finally {
        await pg.end();
      }
    } finally {
      const { Client } = await import("pg");
      const pg = new Client(PG_CFG);
      await pg.connect();
      try {
        await pg.query(
          `DELETE FROM public.journal_entry_lines
           WHERE entry_id IN (
             SELECT id FROM public.journal_entries WHERE source_ref_id = $1
           )`,
          [invoiceId.toString()]
        );
        await pg.query(
          `DELETE FROM public.journal_entries WHERE source_ref_id = $1`,
          [invoiceId.toString()]
        );
        await pg.query(`DELETE FROM public.finance_invoices WHERE id = $1`, [
          invoiceId,
        ]);
      } finally {
        await pg.end();
      }
    }
  }, 60000);

  it("Case 4 — cảnh báo: total >= 5tr + fund=bank → warning=null (chỉ cash mới cảnh báo)", async () => {
    const authedClient = await createTestAuthedClient();
    const invoiceId = await seedInvoice({
      invoiceNumber: "PAY-CASE4",
      total: 6000000,
    });

    try {
      const { data, error } = await authedClient.rpc("create_invoice_payment", {
        p_invoice_id: invoiceId,
        p_actual_amount: 6000000,
        p_fund_account_id: fundBankId, // bank → KHÔNG cảnh báo
        p_entry_date: "2026-06-07",
        p_partner: "NCC-TEST",
        p_desc: "Test cảnh báo bank vs cash",
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();

      const result = data as {
        entry_ids: number[];
        warning: string | null;
        difference: number;
      };
      // Bank + >= 5tr → warning = null
      expect(result.warning).toBeNull();
      expect(Number(result.difference)).toBe(0);
    } finally {
      const { Client } = await import("pg");
      const pg = new Client(PG_CFG);
      await pg.connect();
      try {
        await pg.query(
          `DELETE FROM public.journal_entry_lines
           WHERE entry_id IN (
             SELECT id FROM public.journal_entries WHERE source_ref_id = $1
           )`,
          [invoiceId.toString()]
        );
        await pg.query(
          `DELETE FROM public.journal_entries WHERE source_ref_id = $1`,
          [invoiceId.toString()]
        );
        await pg.query(`DELETE FROM public.finance_invoices WHERE id = $1`, [
          invoiceId,
        ]);
      } finally {
        await pg.end();
      }
    }
  }, 60000);
});

// ─── Edge: kỳ LỖ (kỳ 2026-09) ───────────────────────────────────────────────

describe("acc_close_period — edge: kỳ lỗ (2026-09, actual)", () => {
  const PG_CFG = {
    host: "127.0.0.1",
    port: 54322,
    user: "postgres",
    password: "postgres",
    database: "postgres",
  };

  /** Dọn sạch kỳ test 2026-09 và kỳ carry-forward 2026-10 sổ actual */
  async function cleanupLossPeriods(): Promise<void> {
    const { Client } = await import("pg");
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      for (const m of [9, 10]) {
        await pg.query(
          `DELETE FROM public.journal_entry_lines
           WHERE entry_id IN (
             SELECT id FROM public.journal_entries
             WHERE book = 'INTERNAL'
               AND period_id IN (
                 SELECT id FROM public.accounting_periods
                 WHERE book='INTERNAL' AND year=2026 AND month=$1
               )
           )`,
          [m]
        );
        await pg.query(
          `DELETE FROM public.journal_entries
           WHERE book = 'INTERNAL'
             AND period_id IN (
               SELECT id FROM public.accounting_periods
               WHERE book='INTERNAL' AND year=2026 AND month=$1
             )`,
          [m]
        );
        await pg.query(
          `DELETE FROM public.account_balances
           WHERE book = 'INTERNAL'
             AND period_id IN (
               SELECT id FROM public.accounting_periods
               WHERE book='INTERNAL' AND year=2026 AND month=$1
             )`,
          [m]
        );
        await pg.query(
          `DELETE FROM public.accounting_periods
           WHERE book='INTERNAL' AND year=2026 AND month=$1`,
          [m]
        );
      }
    } finally {
      await pg.end();
    }
  }

  it("kỳ lỗ: bút toán kết chuyển lỗ có dòng Nợ 4212 > 0 (Nợ4212/Có911)", async () => {
    // Cleanup kỳ 2026-09 và 2026-10
    await cleanupLossPeriods();

    const authedClient = await createTestAuthedClient();

    // (1) Sale: doanh thu 100.000 (nhỏ hơn COGS → lỗ)
    const { data: saleId, error: saleErr } = await authedClient.rpc(
      "gen_journal_sale",
      {
        p_book: "INTERNAL",
        p_source_id: "LOSS-SO",
        p_entry_date: "2026-09-10",
        p_partner: "KH",
        p_revenue: 100000,
        p_vat: 0,
      }
    );
    expect(saleErr).toBeNull();
    expect(saleId).toBeGreaterThan(0);

    const { error: postSaleErr } = await authedClient.rpc(
      "post_journal_entry",
      {
        p_entry_id: saleId,
      }
    );
    expect(postSaleErr).toBeNull();

    // (2) COGS: 600.000 → v_exp=600K, v_rev=100K → v_pl=-500K (lỗ)
    const { data: cogsId, error: cogsErr } = await authedClient.rpc(
      "gen_journal_cogs",
      {
        p_book: "INTERNAL",
        p_source_id: "LOSS-SO",
        p_entry_date: "2026-09-10",
        p_cogs: 600000,
      }
    );
    expect(cogsErr).toBeNull();
    expect(cogsId).toBeGreaterThan(0);

    const { error: postCogsErr } = await authedClient.rpc(
      "post_journal_entry",
      {
        p_entry_id: cogsId,
      }
    );
    expect(postCogsErr).toBeNull();

    // (3) Khóa kỳ 2026-09
    const { error: closeErr } = await authedClient.rpc("acc_close_period", {
      p_book: "INTERNAL",
      p_year: 2026,
      p_month: 9,
    });
    expect(closeErr).toBeNull();

    // (4) Verify: có bút toán closing với dòng Nợ 4212 > 0 (nhánh lỗ: Nợ 4212 / Có 911)
    const { Client } = await import("pg");
    const pg = new Client(PG_CFG);
    await pg.connect();
    let hasDebit4212InClosing = false;
    try {
      const { rows } = await pg.query(
        `SELECT jel.debit
         FROM public.journal_entry_lines jel
         JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
         JOIN public.journal_entries je ON je.id = jel.entry_id
         JOIN public.accounting_periods ap ON ap.id = je.period_id
         WHERE coa.account_code = '4212'
           AND jel.debit > 0
           AND je.doc_type = 'closing'
           AND je.book = 'INTERNAL'
           AND ap.year = 2026
           AND ap.month = 9`
      );
      hasDebit4212InClosing = rows.length > 0;
    } finally {
      await pg.end();
    }

    // Bút toán kết chuyển lỗ: Nợ 4212 (-v_pl = 500K) / Có 911 500K
    expect(hasDebit4212InClosing).toBe(true);

    // Cleanup
    await cleanupLossPeriods();
  }, 60000);
});

// ─── get_income_statement + get_trial_balance (kỳ INTERNAL 2027-01) ───────────

describe("get_income_statement + get_trial_balance — kỳ INTERNAL 2027-01", () => {
  const PG_CFG = {
    host: "127.0.0.1",
    port: 54322,
    user: "postgres",
    password: "postgres",
    database: "postgres",
  };

  /** Dọn sạch toàn bộ dữ liệu kỳ INTERNAL 2027-01 */
  async function cleanupPeriod2027_01(): Promise<void> {
    const { Client } = await import("pg");
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      await pg.query(
        `DELETE FROM public.journal_entry_lines
         WHERE entry_id IN (
           SELECT id FROM public.journal_entries
           WHERE book = 'INTERNAL'
             AND period_id IN (
               SELECT id FROM public.accounting_periods
               WHERE book = 'INTERNAL' AND year = 2027 AND month = 1
             )
         )`
      );
      await pg.query(
        `DELETE FROM public.journal_entries
         WHERE book = 'INTERNAL'
           AND period_id IN (
             SELECT id FROM public.accounting_periods
             WHERE book = 'INTERNAL' AND year = 2027 AND month = 1
           )`
      );
      await pg.query(
        `DELETE FROM public.account_balances
         WHERE book = 'INTERNAL'
           AND period_id IN (
             SELECT id FROM public.accounting_periods
             WHERE book = 'INTERNAL' AND year = 2027 AND month = 1
           )`
      );
      await pg.query(
        `DELETE FROM public.accounting_periods
         WHERE book = 'INTERNAL' AND year = 2027 AND month = 1`
      );
    } finally {
      await pg.end();
    }
  }

  it("KQKD: doanh_thu_thuan=1.000.000, gia_von=600.000, loi_nhuan_gop=400.000, loi_nhuan_sau_thue=400.000", async () => {
    await cleanupPeriod2027_01();

    const authedClient = await createTestAuthedClient();

    // (1) Bút toán bán: Nợ131 1.000.000 / Có5111 1.000.000
    const { data: saleId, error: saleErr } = await authedClient.rpc(
      "acc_create_journal_entry",
      {
        p_book: "INTERNAL",
        p_entry_date: "2027-01-10",
        p_doc_type: "sale",
        p_source_ref_type: "orders",
        p_source_ref_id: "BCTC-TEST-2027-SALE",
        p_description: "Bán hàng test BCTC 2027-01",
        p_lines: [
          {
            account_code: "131",
            debit: 1000000,
            credit: 0,
            description: "Phải thu KH",
          },
          {
            account_code: "5111",
            debit: 0,
            credit: 1000000,
            description: "Doanh thu",
          },
        ],
      }
    );
    expect(saleErr).toBeNull();
    expect(saleId).toBeGreaterThan(0);

    const { error: postSaleErr } = await authedClient.rpc(
      "post_journal_entry",
      {
        p_entry_id: saleId,
      }
    );
    expect(postSaleErr).toBeNull();

    // (2) Bút toán giá vốn: Nợ632 600.000 / Có156 600.000
    const { data: cogsId, error: cogsErr } = await authedClient.rpc(
      "acc_create_journal_entry",
      {
        p_book: "INTERNAL",
        p_entry_date: "2027-01-10",
        p_doc_type: "cogs",
        p_source_ref_type: "orders",
        p_source_ref_id: "BCTC-TEST-2027-COGS",
        p_description: "Giá vốn test BCTC 2027-01",
        p_lines: [
          {
            account_code: "632",
            debit: 600000,
            credit: 0,
            description: "Giá vốn",
          },
          {
            account_code: "156",
            debit: 0,
            credit: 600000,
            description: "Xuất kho",
          },
        ],
      }
    );
    expect(cogsErr).toBeNull();
    expect(cogsId).toBeGreaterThan(0);

    const { error: postCogsErr } = await authedClient.rpc(
      "post_journal_entry",
      {
        p_entry_id: cogsId,
      }
    );
    expect(postCogsErr).toBeNull();

    // (3) get_income_statement → kiểm tra chỉ tiêu
    const { data: is_data, error: isErr } = await authedClient.rpc(
      "get_income_statement",
      { p_book: "INTERNAL", p_year: 2027, p_month: 1 }
    );
    expect(isErr).toBeNull();
    expect(is_data).not.toBeNull();

    const is = is_data as Record<string, number>;
    expect(Number(is["doanh_thu_thuan"])).toBe(1000000);
    expect(Number(is["gia_von"])).toBe(600000);
    expect(Number(is["loi_nhuan_gop"])).toBe(400000);
    // Không có chi phí tài chính/QLKD/thuế → lợi nhuận sau thuế = 400.000
    expect(Number(is["loi_nhuan_sau_thue"])).toBe(400000);
    expect(Number(is["tong_loi_nhuan_truoc_thue"])).toBe(400000);
    expect(Number(is["chi_phi_thue_tndn"])).toBe(0);

    await cleanupPeriod2027_01();
  }, 60000);

  it("trial_balance: có dòng TK 5111 (period_credit=1.000.000), 632 (period_debit=600.000), 131, 156", async () => {
    await cleanupPeriod2027_01();

    const authedClient = await createTestAuthedClient();

    // Seed 2 bút toán tương tự
    const { data: saleId, error: saleErr } = await authedClient.rpc(
      "acc_create_journal_entry",
      {
        p_book: "INTERNAL",
        p_entry_date: "2027-01-15",
        p_doc_type: "sale",
        p_source_ref_type: "orders",
        p_source_ref_id: "BCTC-TB-2027-SALE",
        p_description: "Bán hàng test trial balance 2027-01",
        p_lines: [
          {
            account_code: "131",
            debit: 1000000,
            credit: 0,
            description: "Phải thu KH",
          },
          {
            account_code: "5111",
            debit: 0,
            credit: 1000000,
            description: "Doanh thu",
          },
        ],
      }
    );
    expect(saleErr).toBeNull();
    await authedClient.rpc("post_journal_entry", { p_entry_id: saleId });

    const { data: cogsId, error: cogsErr } = await authedClient.rpc(
      "acc_create_journal_entry",
      {
        p_book: "INTERNAL",
        p_entry_date: "2027-01-15",
        p_doc_type: "cogs",
        p_source_ref_type: "orders",
        p_source_ref_id: "BCTC-TB-2027-COGS",
        p_description: "Giá vốn test trial balance 2027-01",
        p_lines: [
          {
            account_code: "632",
            debit: 600000,
            credit: 0,
            description: "Giá vốn",
          },
          {
            account_code: "156",
            debit: 0,
            credit: 600000,
            description: "Xuất kho",
          },
        ],
      }
    );
    expect(cogsErr).toBeNull();
    await authedClient.rpc("post_journal_entry", { p_entry_id: cogsId });

    // get_trial_balance
    const { data: tb, error: tbErr } = await authedClient.rpc(
      "get_trial_balance",
      { p_book: "INTERNAL", p_year: 2027, p_month: 1 }
    );
    expect(tbErr).toBeNull();
    expect(Array.isArray(tb)).toBe(true);
    expect(tb!.length).toBeGreaterThanOrEqual(4);

    type TBRow = {
      account_code: string;
      account_name: string;
      period_debit: number;
      period_credit: number;
      opening_debit: number;
      opening_credit: number;
      closing_debit: number;
      closing_credit: number;
    };

    const rows = tb as TBRow[];

    // TK 5111 — period_credit=1.000.000
    const row5111 = rows.find((r) => r.account_code === "5111");
    expect(row5111).toBeDefined();
    expect(Number(row5111!.period_credit)).toBe(1000000);
    expect(row5111!.account_name).toBeTruthy();

    // TK 632 — period_debit=600.000
    const row632 = rows.find((r) => r.account_code === "632");
    expect(row632).toBeDefined();
    expect(Number(row632!.period_debit)).toBe(600000);
    expect(row632!.account_name).toBeTruthy();

    // TK 131 — tồn tại (Nợ 1.000.000)
    const row131 = rows.find((r) => r.account_code === "131");
    expect(row131).toBeDefined();
    expect(Number(row131!.period_debit)).toBe(1000000);

    // TK 156 — tồn tại (Có 600.000)
    const row156 = rows.find((r) => r.account_code === "156");
    expect(row156).toBeDefined();
    expect(Number(row156!.period_credit)).toBe(600000);

    // Kiểm tra thứ tự account_code tăng dần
    const codes = rows.map((r) => r.account_code);
    const sorted = [...codes].sort();
    expect(codes).toEqual(sorted);

    await cleanupPeriod2027_01();
  }, 60000);

  it("get_income_statement kỳ chưa tồn tại → trả 0 cho tất cả chỉ tiêu", async () => {
    const authedClient = await createTestAuthedClient();

    const { data, error } = await authedClient.rpc("get_income_statement", {
      p_book: "INTERNAL",
      p_year: 2099,
      p_month: 6,
    });

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    const is = data as Record<string, number>;
    expect(Number(is["doanh_thu_thuan"])).toBe(0);
    expect(Number(is["loi_nhuan_sau_thue"])).toBe(0);
  }, 30000);

  it("get_trial_balance kỳ chưa tồn tại → trả mảng rỗng", async () => {
    const authedClient = await createTestAuthedClient();

    const { data, error } = await authedClient.rpc("get_trial_balance", {
      p_book: "INTERNAL",
      p_year: 2099,
      p_month: 7,
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect((data as unknown[]).length).toBe(0);
  }, 30000);
});

// ─── BCTC B01a/VAT/Cash flow (Thông tư 133) — Task 1.1-1.4 ────────────────────

describe("BCTC TT133 — mapping + balance_sheet + vat_declaration + cash_flow", () => {
  const PG_CFG = {
    host: "127.0.0.1",
    port: 54322,
    user: "postgres",
    password: "postgres",
    database: "postgres",
  };

  /** Resolve account_id (uuid) từ account_code */
  async function resolveAccountId(code: string): Promise<string> {
    const { Client } = await import("pg");
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      const { rows } = await pg.query(
        `SELECT id FROM public.chart_of_accounts WHERE account_code = $1 LIMIT 1`,
        [code]
      );
      if (!rows[0])
        throw new Error(`Không tìm thấy TK ${code} trong chart_of_accounts`);
      return rows[0].id as string;
    } finally {
      await pg.end();
    }
  }

  /** Dọn sạch dữ liệu kỳ test (book, year, months) sổ kép */
  async function cleanupPeriods(
    book: string,
    year: number,
    months: number[]
  ): Promise<void> {
    const { Client } = await import("pg");
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      for (const m of months) {
        await pg.query(
          `DELETE FROM public.journal_entry_lines
           WHERE entry_id IN (
             SELECT id FROM public.journal_entries
             WHERE book=$1 AND period_id IN (
               SELECT id FROM public.accounting_periods WHERE book=$1 AND year=$2 AND month=$3
             )
           )`,
          [book, year, m]
        );
        await pg.query(
          `DELETE FROM public.journal_entries
           WHERE book=$1 AND period_id IN (
             SELECT id FROM public.accounting_periods WHERE book=$1 AND year=$2 AND month=$3
           )`,
          [book, year, m]
        );
        await pg.query(
          `DELETE FROM public.account_balances
           WHERE book=$1 AND period_id IN (
             SELECT id FROM public.accounting_periods WHERE book=$1 AND year=$2 AND month=$3
           )`,
          [book, year, m]
        );
        await pg.query(
          `DELETE FROM public.accounting_periods WHERE book=$1 AND year=$2 AND month=$3`,
          [book, year, m]
        );
      }
    } finally {
      await pg.end();
    }
  }

  // ─── Task 1.1: bctc_line_mapping ──────────────────────────────────────────
  it("Task 1.1 — bctc_line_mapping có dữ liệu seed + dòng ma_so='110'", async () => {
    const { data, error } = await adminClient
      .from("bctc_line_mapping")
      .select("*");

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.some((r: { ma_so: string }) => r.ma_so === "110")).toBe(true);
  }, 30000);

  // ─── Task 1.2: get_balance_sheet ──────────────────────────────────────────
  it("Task 1.2 — get_balance_sheet B01a: tài sản = nguồn vốn, 140=1tr, 300=1tr", async () => {
    await cleanupPeriods("TAX", 2028, [1]);
    const authedClient = await createTestAuthedClient();

    // Bút toán: Nợ156 1.000.000 / Có331 1.000.000 (book TAX, kỳ 2028-01)
    const { data: entryId, error: createErr } = await authedClient.rpc(
      "acc_create_journal_entry",
      {
        p_book: "TAX",
        p_entry_date: "2028-01-15",
        p_doc_type: "purchase",
        p_source_ref_type: "purchase_order",
        p_source_ref_id: "BS-2028-01",
        p_description: "Nhập hàng test balance sheet",
        p_lines: [
          {
            account_code: "156",
            debit: 1000000,
            credit: 0,
            description: "Nhập kho",
          },
          {
            account_code: "331",
            debit: 0,
            credit: 1000000,
            description: "Phải trả NCC",
          },
        ],
      }
    );
    expect(createErr).toBeNull();
    expect(entryId).toBeGreaterThan(0);

    const { error: postErr } = await authedClient.rpc("post_journal_entry", {
      p_entry_id: entryId,
    });
    expect(postErr).toBeNull();

    const { data, error } = await authedClient.rpc("get_balance_sheet", {
      p_book: "TAX",
      p_year: 2028,
      p_month: 1,
    });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    type BSRow = { ma_so: string; ten_chi_tieu: string; so_tien: number };
    const rows = data as BSRow[];
    const get = (ma: string) =>
      Number(rows.find((r) => r.ma_so === ma)?.so_tien ?? 0);

    const assetCodes = ["110", "120", "130", "140", "150", "160"];
    const sourceCodes = ["300", "400"];
    const totalAsset = assetCodes.reduce((s, c) => s + get(c), 0);
    const totalSource = sourceCodes.reduce((s, c) => s + get(c), 0);

    expect(get("140")).toBe(1000000);
    expect(get("300")).toBe(1000000);
    expect(totalAsset).toBe(totalSource);

    await cleanupPeriods("TAX", 2028, [1]);
  }, 60000);

  // ─── Task 1.3: get_vat_declaration ────────────────────────────────────────
  it("Task 1.3 — get_vat_declaration: rate 8 (pre=1tr,vat=80k), rate 10 (pre=1tr,vat=100k)", async () => {
    const { Client } = await import("pg");
    const pg = new Client(PG_CFG);
    await pg.connect();
    let invoiceId: number;
    try {
      const { rows } = await pg.query(
        `INSERT INTO public.finance_invoices(
           direction, status, invoice_number, invoice_date, items_json,
           total_amount_pre_tax, tax_amount, total_amount_post_tax
         ) VALUES ('inbound','verified','VAT-DECL-T1','2028-03-15',
           $1::jsonb, 2000000, 180000, 2180000)
         RETURNING id`,
        [
          JSON.stringify([
            { quantity: 10, unit_price: 100000, vat_rate: 8 },
            { quantity: 5, unit_price: 200000, vat_rate: 10 },
          ]),
        ]
      );
      invoiceId = rows[0].id as number;
    } finally {
      await pg.end();
    }

    try {
      const authedClient = await createTestAuthedClient();
      const { data, error } = await authedClient.rpc("get_vat_declaration", {
        p_direction: "inbound",
        p_year: 2028,
        p_month: 3,
      });
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);

      type VatRow = {
        tax_rate: number;
        sum_pre_tax: number;
        sum_vat: number;
      };
      const rows = data as VatRow[];
      const r8 = rows.find((r) => Number(r.tax_rate) === 8);
      const r10 = rows.find((r) => Number(r.tax_rate) === 10);

      expect(r8).toBeDefined();
      expect(Number(r8!.sum_pre_tax)).toBe(1000000);
      expect(Number(r8!.sum_vat)).toBe(80000);

      expect(r10).toBeDefined();
      expect(Number(r10!.sum_pre_tax)).toBe(1000000);
      expect(Number(r10!.sum_vat)).toBe(100000);
    } finally {
      const pg2 = new Client(PG_CFG);
      await pg2.connect();
      try {
        await pg2.query(`DELETE FROM public.finance_invoices WHERE id = $1`, [
          invoiceId!,
        ]);
      } finally {
        await pg2.end();
      }
    }
  }, 60000);

  // ─── Task 1.4: get_cash_flow ──────────────────────────────────────────────
  it("Task 1.4 — get_cash_flow: vào=500k, ra=200k, thuần=300k", async () => {
    await cleanupPeriods("INTERNAL", 2028, [4]);
    const authedClient = await createTestAuthedClient();

    // Tiền vào: Nợ111 500.000 / Có131 500.000
    const { data: e1, error: e1Err } = await authedClient.rpc(
      "acc_create_journal_entry",
      {
        p_book: "INTERNAL",
        p_entry_date: "2028-04-05",
        p_doc_type: "receipt",
        p_source_ref_type: "receipt",
        p_source_ref_id: "CF-IN-2028-04",
        p_description: "Thu tiền KH",
        p_lines: [
          {
            account_code: "111",
            debit: 500000,
            credit: 0,
            description: "Thu quỹ",
          },
          {
            account_code: "131",
            debit: 0,
            credit: 500000,
            description: "Giảm phải thu",
          },
        ],
      }
    );
    expect(e1Err).toBeNull();
    await authedClient.rpc("post_journal_entry", { p_entry_id: e1 });

    // Tiền ra: Nợ331 200.000 / Có111 200.000
    const { data: e2, error: e2Err } = await authedClient.rpc(
      "acc_create_journal_entry",
      {
        p_book: "INTERNAL",
        p_entry_date: "2028-04-06",
        p_doc_type: "payment",
        p_source_ref_type: "payment",
        p_source_ref_id: "CF-OUT-2028-04",
        p_description: "Trả NCC",
        p_lines: [
          {
            account_code: "331",
            debit: 200000,
            credit: 0,
            description: "Giảm phải trả",
          },
          {
            account_code: "111",
            debit: 0,
            credit: 200000,
            description: "Chi quỹ",
          },
        ],
      }
    );
    expect(e2Err).toBeNull();
    await authedClient.rpc("post_journal_entry", { p_entry_id: e2 });

    const { data, error } = await authedClient.rpc("get_cash_flow", {
      p_book: "INTERNAL",
      p_year: 2028,
      p_month: 4,
    });
    expect(error).toBeNull();

    const rows = data as {
      dong_tien_vao: number;
      dong_tien_ra: number;
      luu_chuyen_thuan: number;
    }[];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(1);
    expect(Number(rows[0].dong_tien_vao)).toBe(500000);
    expect(Number(rows[0].dong_tien_ra)).toBe(200000);
    expect(Number(rows[0].luu_chuyen_thuan)).toBe(300000);

    await cleanupPeriods("INTERNAL", 2028, [4]);
  }, 60000);

  // resolveAccountId giữ lại để dùng nếu cần debug — tránh unused
  void resolveAccountId;
});

// ─── Phase 3.1: tách quyền GHI bút toán khỏi quyền XEM ────────────────────────
describe("Phân quyền write kế toán (finance.post/void/close_journal)", () => {
  const PG_CFG = {
    host: "127.0.0.1",
    port: 54322,
    user: "postgres",
    password: "postgres",
    database: "postgres",
  };
  // Role Phó Giám Đốc: CÓ finance.view_balance, KHÔNG admin-all, KHÔNG journal key
  const PHO_GD_ROLE_ID = "23bb1177-22f3-4791-9529-a8043665490d";
  const LIMITED_EMAIL = "kt.limited@nv-test.local";
  const LIMITED_PASSWORD = "Test@123!";
  let limitedUserId: string | null = null;

  beforeAll(async () => {
    // Tạo (hoặc tìm) auth user quyền hạn chế
    const { data: created, error: createErr } =
      await adminClient.auth.admin.createUser({
        email: LIMITED_EMAIL,
        password: LIMITED_PASSWORD,
        email_confirm: true,
      });
    if (created?.user) {
      limitedUserId = created.user.id;
    } else if (createErr) {
      // Đã tồn tại từ lần chạy trước — tìm lại id
      const { data: list } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      limitedUserId =
        list?.users?.find((u) => u.email === LIMITED_EMAIL)?.id ?? null;
    }
    if (!limitedUserId) throw new Error("Không tạo được limited test user");

    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      await pg.query(
        `INSERT INTO users(id, email, full_name, status)
         VALUES($1,$2,'Test Phó GĐ (limited)','active')
         ON CONFLICT (id) DO NOTHING`,
        [limitedUserId, LIMITED_EMAIL]
      );
      await pg.query(
        `INSERT INTO user_roles(user_id, role_id, branch_id)
         VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
        [limitedUserId, PHO_GD_ROLE_ID, BRANCH_ID]
      );
      await pg.query("NOTIFY pgrst, 'reload schema'");
    } finally {
      await pg.end();
    }
  }, 60000);

  afterAll(async () => {
    if (!limitedUserId) return;
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      await pg.query(`DELETE FROM user_roles WHERE user_id=$1`, [
        limitedUserId,
      ]);
      await pg.query(`DELETE FROM users WHERE id=$1`, [limitedUserId]);
    } finally {
      await pg.end();
    }
    await adminClient.auth.admin.deleteUser(limitedUserId);
  }, 60000);

  it("user chỉ có view_balance ĐỌC được get_balance_sheet (không bị chặn)", async () => {
    const client = await createUserClient(LIMITED_EMAIL, LIMITED_PASSWORD);
    const { error } = await client.rpc("get_balance_sheet", {
      p_book: "TAX",
      p_year: 2099,
      p_month: 12,
    });
    expect(error).toBeNull();
  }, 60000);

  it("user chỉ có view_balance bị TỪ CHỐI post_journal_entry", async () => {
    const client = await createUserClient(LIMITED_EMAIL, LIMITED_PASSWORD);
    const { error } = await client.rpc("post_journal_entry", {
      p_entry_id: 999999999,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/Forbidden|quyền/i);
  }, 60000);

  it("user chỉ có view_balance bị TỪ CHỐI void_journal_entry", async () => {
    const client = await createUserClient(LIMITED_EMAIL, LIMITED_PASSWORD);
    const { error } = await client.rpc("void_journal_entry", {
      p_entry_id: 999999999,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/Forbidden|quyền/i);
  }, 60000);

  it("user chỉ có view_balance bị TỪ CHỐI acc_close_period", async () => {
    const client = await createUserClient(LIMITED_EMAIL, LIMITED_PASSWORD);
    const { error } = await client.rpc("acc_close_period", {
      p_book: "TAX",
      p_year: 2099,
      p_month: 12,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/Forbidden|quyền/i);
  }, 60000);

  it("rpc_access_rules: 4 RPC ghi dùng quyền write riêng (không còn view_balance)", async () => {
    const { data, error } = await adminClient
      .from("rpc_access_rules")
      .select("function_name, required_permission")
      .in("function_name", [
        "post_journal_entry",
        "void_journal_entry",
        "acc_close_period",
        "create_invoice_payment",
      ]);
    expect(error).toBeNull();
    const map = Object.fromEntries(
      (data as { function_name: string; required_permission: string }[]).map(
        (r) => [r.function_name, r.required_permission]
      )
    );
    expect(map["post_journal_entry"]).toBe("finance.post_journal");
    expect(map["create_invoice_payment"]).toBe("finance.post_journal");
    expect(map["void_journal_entry"]).toBe("finance.void_journal");
    expect(map["acc_close_period"]).toBe("finance.close_period");
  }, 30000);
});

// ─── Phase 4: gen_journal_for_sales_order (hook bán hàng/COGS → sổ INTERNAL) ───
describe("gen_journal_for_sales_order — ghi sổ doanh thu + giá vốn từ đơn", () => {
  const PG_CFG = {
    host: "127.0.0.1",
    port: 54322,
    user: "postgres",
    password: "postgres",
    database: "postgres",
  };
  // 2 sản phẩm có sẵn trên local (actual_cost=100000/base unit) — chỉ ĐỌC, không sửa
  const PROD_A = 2;
  const PROD_B = 3;
  const REVENUE = 500000;
  let orderId: string | null = null;
  let openingDebtOrderId: string | null = null;
  // base_quantity do TRIGGER tính từ cấu hình đơn vị SP (không set tay được) →
  // tính expected COGS từ chính DB sau khi tạo item (test đúng theo công thức RPC).
  let expectedCogs = 0;

  async function cleanupOrder(oid: string) {
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      await pg.query(
        `DELETE FROM journal_entry_lines WHERE entry_id IN (
           SELECT id FROM journal_entries WHERE source_ref_type='orders' AND source_ref_id=$1)`,
        [oid]
      );
      await pg.query(
        `DELETE FROM journal_entries WHERE source_ref_type='orders' AND source_ref_id=$1`,
        [oid]
      );
      await pg.query(`DELETE FROM order_items WHERE order_id=$1`, [oid]);
      await pg.query(`DELETE FROM orders WHERE id=$1`, [oid]);
    } finally {
      await pg.end();
    }
  }

  async function cleanupPeriod() {
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      await pg.query(
        `DELETE FROM accounting_periods WHERE book='INTERNAL' AND year=2028 AND month=5`
      );
    } catch {
      /* còn entry tham chiếu (đã cleanup order trước) — bỏ qua */
    } finally {
      await pg.end();
    }
  }

  beforeAll(async () => {
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      // Đơn bán thật: final_amount = REVENUE
      const { rows } = await pg.query(
        `INSERT INTO orders(code, order_type, final_amount, total_amount, created_at)
         VALUES('TEST-ACC-ORD-P4','POS',$1,$1,'2028-05-10') RETURNING id`,
        [REVENUE]
      );
      orderId = rows[0].id as string;
      await pg.query(
        `INSERT INTO order_items(order_id, product_id, quantity, uom, unit_price, is_gift) VALUES
           ($1,$2,1,'Hộp',300000,false),
           ($1,$3,1,'Hộp',200000,false)`,
        [orderId, PROD_A, PROD_B]
      );
      // base_quantity được trigger tính → đọc lại expected COGS theo đúng công thức RPC
      const { rows: cg } = await pg.query(
        `SELECT COALESCE(SUM(oi.base_quantity * COALESCE(p.actual_cost,0)),0) c
         FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=$1`,
        [orderId]
      );
      expectedCogs = Number(cg[0].c);
      // Đơn công nợ đầu kỳ (phải bị bỏ qua)
      const { rows: r2 } = await pg.query(
        `INSERT INTO orders(code, order_type, final_amount, total_amount, created_at)
         VALUES('TEST-ACC-ORD-OPEN','opening_debt',999000,999000,'2028-05-10') RETURNING id`
      );
      openingDebtOrderId = r2[0].id as string;
      await pg.query("NOTIFY pgrst, 'reload schema'");
    } finally {
      await pg.end();
    }
    await cleanupPeriod();
  }, 60000);

  afterAll(async () => {
    if (orderId) await cleanupOrder(orderId);
    if (openingDebtOrderId) await cleanupOrder(openingDebtOrderId);
    await cleanupPeriod();
  }, 60000);

  it("sinh bút toán doanh thu (No131/Co5111) + giá vốn (No632/Co156) sổ INTERNAL, draft", async () => {
    const client = await createTestAuthedClient();
    const { data, error } = await client.rpc("gen_journal_for_sales_order", {
      p_order_id: orderId,
    });
    expect(error).toBeNull();
    const res = data as {
      entry_sale: number | null;
      entry_cogs: number | null;
      revenue: number;
      cogs: number;
      book: string;
    };
    expect(Number(res.revenue)).toBe(REVENUE);
    expect(Number(res.cogs)).toBe(expectedCogs);
    expect(expectedCogs).toBeGreaterThan(0); // đảm bảo có giá vốn để kiểm
    expect(res.book).toBe("INTERNAL");
    expect(res.entry_sale).not.toBeNull();
    expect(res.entry_cogs).not.toBeNull();

    // Kiểm tra bút toán thực trong DB
    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      const { rows: entries } = await pg.query(
        `SELECT id, book, doc_type, status, total_debit, total_credit
         FROM journal_entries WHERE source_ref_type='orders' AND source_ref_id=$1 ORDER BY doc_type`,
        [orderId]
      );
      expect(entries.length).toBe(2);
      for (const e of entries) {
        expect(e.book).toBe("INTERNAL");
        expect(e.status).toBe("draft");
        expect(Number(e.total_debit)).toBe(Number(e.total_credit));
      }
      const sale = entries.find((e) => e.doc_type === "sale");
      const cogs = entries.find((e) => e.doc_type === "cogs");
      expect(Number(sale.total_debit)).toBe(REVENUE);
      expect(Number(cogs.total_debit)).toBe(expectedCogs);

      // Dòng 131/5111 của bút toán doanh thu
      const { rows: lines } = await pg.query(
        `SELECT a.account_code, l.debit, l.credit
         FROM journal_entry_lines l JOIN chart_of_accounts a ON a.id=l.account_id
         WHERE l.entry_id=$1 ORDER BY l.line_no`,
        [sale.id]
      );
      const byCode = Object.fromEntries(lines.map((l) => [l.account_code, l]));
      expect(Number(byCode["131"].debit)).toBe(REVENUE);
      expect(Number(byCode["5111"].credit)).toBe(REVENUE);
    } finally {
      await pg.end();
    }
  }, 60000);

  it("idempotent: gọi lần 2 trả skipped='already_booked', không tạo thêm bút toán", async () => {
    const client = await createTestAuthedClient();
    const { data, error } = await client.rpc("gen_journal_for_sales_order", {
      p_order_id: orderId,
    });
    expect(error).toBeNull();
    expect((data as { skipped?: string }).skipped).toBe("already_booked");

    const pg = new Client(PG_CFG);
    await pg.connect();
    try {
      const { rows } = await pg.query(
        `SELECT count(*)::int n FROM journal_entries WHERE source_ref_type='orders' AND source_ref_id=$1`,
        [orderId]
      );
      expect(rows[0].n).toBe(2); // vẫn 2, không nhân đôi
    } finally {
      await pg.end();
    }
  }, 60000);

  it("bỏ qua đơn order_type='opening_debt'", async () => {
    const client = await createTestAuthedClient();
    const { data, error } = await client.rpc("gen_journal_for_sales_order", {
      p_order_id: openingDebtOrderId,
    });
    expect(error).toBeNull();
    expect((data as { skipped?: string }).skipped).toBe("opening_debt");
  }, 60000);

  it("rule mở cho mọi user đã đăng nhập (required_permission NULL) — POS gọi được", async () => {
    const { data, error } = await adminClient
      .from("rpc_access_rules")
      .select("required_permission, is_write")
      .eq("function_name", "gen_journal_for_sales_order")
      .single();
    expect(error).toBeNull();
    expect(
      (data as { required_permission: string | null }).required_permission
    ).toBeNull();
    expect((data as { is_write: boolean }).is_write).toBe(true);
  }, 30000);
});
