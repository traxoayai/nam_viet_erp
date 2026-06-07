import { Client } from "pg";
import { describe, it, expect, afterEach } from "vitest";

// Test partial UNIQUE INDEX uniq_inbound_invoice: chong trung HD dau vao theo
// (supplier_tax_code, invoice_symbol, invoice_number) khi direction='inbound'.
const PG_CFG = {
  host: "127.0.0.1",
  port: 54322,
  user: "postgres",
  password: "postgres",
  database: "postgres",
};

const MARK = "DEDUP-TEST";

async function pg() {
  const c = new Client(PG_CFG);
  await c.connect();
  return c;
}

async function insertInbound(
  c: Client,
  mst: string | null,
  symbol: string | null,
  num: string | null
) {
  return c.query(
    `INSERT INTO public.finance_invoices
       (direction, status, supplier_tax_code, invoice_symbol, invoice_number, invoice_date)
     VALUES ('inbound','draft',$1,$2,$3,'2028-07-01') RETURNING id`,
    [mst, symbol, num]
  );
}

afterEach(async () => {
  const c = await pg();
  try {
    await c.query(
      `DELETE FROM public.finance_invoices WHERE invoice_symbol = $1 OR invoice_number LIKE $2`,
      [MARK, `${MARK}%`]
    );
  } finally {
    await c.end();
  }
});

describe("uniq_inbound_invoice — chống trùng hóa đơn đầu vào", () => {
  it("chặn HĐ inbound trùng (MST, ký hiệu, số) — lỗi 23505", async () => {
    const c = await pg();
    try {
      await insertInbound(c, "0101234567", MARK, `${MARK}-001`);
      // Trùng cả 3 field -> phải lỗi unique violation
      await expect(
        insertInbound(c, "0101234567", MARK, `${MARK}-001`)
      ).rejects.toMatchObject({ code: "23505" });
    } finally {
      await c.end();
    }
  });

  it("cho phép HĐ inbound khác số hóa đơn", async () => {
    const c = await pg();
    try {
      await insertInbound(c, "0101234567", MARK, `${MARK}-002`);
      const r = await insertInbound(c, "0101234567", MARK, `${MARK}-003`);
      expect(r.rows[0].id).toBeDefined();
    } finally {
      await c.end();
    }
  });

  it("KHÔNG chặn khi thiếu MST (partial index bỏ qua HĐ thiếu định danh)", async () => {
    const c = await pg();
    try {
      await insertInbound(c, null, MARK, `${MARK}-004`);
      // Cùng (symbol, number) nhưng MST NULL -> index không áp dụng -> chèn được
      const r = await insertInbound(c, null, MARK, `${MARK}-004`);
      expect(r.rows[0].id).toBeDefined();
    } finally {
      await c.end();
    }
  });
});
