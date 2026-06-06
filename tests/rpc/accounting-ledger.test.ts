import { Client } from "pg";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { adminClient, createTestAuthedClient } from "../helpers/supabase";

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
