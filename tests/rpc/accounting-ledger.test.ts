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
      p_book: "actual",
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
      p_book: "actual",
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
        p_book: "actual",
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
      .eq("book", "actual")
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
        `DELETE FROM public.account_balances WHERE book='actual' AND account_id=$1 AND period_id=$2`,
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
        p_book: "actual",
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
          `DELETE FROM public.account_balances WHERE book='actual' AND account_id=$1 AND period_id=$2`,
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
        { p_book: "vat", p_invoice_id: invoiceId }
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
        p_book: "vat",
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
        p_book: "actual",
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
        p_book: "actual",
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
