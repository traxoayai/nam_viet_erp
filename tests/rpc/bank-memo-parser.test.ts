import { describe, it, expect, afterAll, beforeAll } from "vitest";

import { adminClient, isProduction } from "../helpers/supabase";

import {
  createTestWarehouse,
  createTestB2BCustomer,
  createTestProduct,
  createTestBatch,
  createTestOrder,
  cleanupTestData,
} from "./helpers/fixtures";

/**
 * Unit + integration test cho bank memo parser fix.
 *
 * BUG gốc (2026-04-23): process_incoming_bank_transfer dùng exact equality
 * sau REPLACE dash/space → memo có text phụ ("thanh toan SO-...") miss →
 * đơn PENDING đứng yên sau khi khách CK.
 *
 * Fix regex-based extraction: extract_order_codes_from_memo(text) → text[]
 */

describe("extract_order_codes_from_memo — unit cases", () => {
  const cases: Array<{ memo: string | null; expected: string[] }> = [
    { memo: "SO-260423-6745", expected: ["SO-260423-6745"] },
    { memo: "SO260423 6745", expected: ["SO-260423-6745"] },
    { memo: "SO2604236745", expected: ["SO-260423-6745"] },
    { memo: "thanh toan SO-260423-6745", expected: ["SO-260423-6745"] },
    { memo: "FT25SO260423-6745 TIMO", expected: ["SO-260423-6745"] },
    {
      memo: "TT SO260423 6745 VA SO260422 2634",
      expected: ["SO-260423-6745", "SO-260422-2634"],
    },
    { memo: "POS-260423-0001", expected: ["POS-260423-0001"] },
    { memo: "so-260423-6745", expected: ["SO-260423-6745"] }, // lowercase
    { memo: "tiền thuê nhà", expected: [] },
    { memo: "", expected: [] },
    { memo: null, expected: [] },
    // Dedupe: 2 lần cùng 1 mã → chỉ giữ 1
    {
      memo: "SO-260423-6745 va lai SO-260423-6745",
      expected: ["SO-260423-6745"],
    },
  ];

  for (const { memo, expected } of cases) {
    it(`parse: ${JSON.stringify(memo)}`, async () => {
      const { data, error } = await adminClient.rpc(
        "extract_order_codes_from_memo",
        { p_memo: memo }
      );
      expect(error).toBeNull();
      expect(data).toEqual(expected);
    });
  }
});

describe("process_incoming_bank_transfer — end-to-end với memo variations", () => {
  const markers: string[] = [];

  // Bộ đếm cục bộ để sinh SO code 4-digit unique giữa các test chạy song song
  // (regex parser yêu cầu đúng 4 digit). Start random 1000-9999, tăng dần.
  let __orderSeq = Math.floor(Math.random() * 8000 + 1000);
  const nextRnd = () => (__orderSeq++ % 9000) + 1000;

  // Cleanup leftover test orders SO-<tomorrow>-XXXX để tránh collision khi
  // test trước đó fail giữa chừng không cleanup. Chỉ xoá code format test.
  beforeAll(async () => {
    if (isProduction) return;
    const yymmdd = new Date(Date.now() + 86400000)
      .toISOString()
      .slice(2, 10)
      .replace(/-/g, "");
    await adminClient.from("orders").delete().like("code", `SO-${yymmdd}-%`);
  });

  it.skipIf(isProduction)(
    "Memo có text phụ vẫn match đơn → tx completed + đơn CONFIRMED",
    async () => {
      const marker = `PARSE-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const custId = await createTestB2BCustomer(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      await createTestBatch(adminClient, productId, whId, { quantity: 1000 });

      // Code format hợp regex: SO-YYMMDD-NNNN (NNNN random tránh collision khi re-run)
      // Use tomorrow's date để test SO code không va chạm với prod-like data hôm nay
      const yymmdd = new Date(Date.now() + 86400000)
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, "");
      const rnd = nextRnd();
      const code = `SO-${yymmdd}-${rnd}`;
      const { orderId } = await createTestOrder(adminClient, {
        customerB2bId: custId,
        warehouseId: whId,
        code,
        status: "PENDING",
        items: [{ productId, quantity: 1, unitPrice: 100000 }],
      });

      const { data, error } = await adminClient.rpc(
        "process_incoming_bank_transfer",
        {
          p_amount: 100000,
          p_memo: `thanh toan ${code} ok`,
          p_bank_ref_id: `TEST-BANK-REF-${marker}`,
        }
      );
      expect(error).toBeNull();
      expect((data as { status: string }).status).toBe("success");

      // Wait for trigger chain (auto_allocate_payment_to_orders)
      await new Promise((r) => setTimeout(r, 300));

      const { data: upd } = await adminClient
        .from("orders")
        .select("status, payment_status, paid_amount")
        .eq("id", orderId)
        .single();
      expect(upd?.status).toBe("CONFIRMED");
      expect(upd?.payment_status).toBe("paid");
      expect(Number(upd?.paid_amount)).toBe(100000);
    }
  );

  it.skipIf(isProduction)(
    "Memo không có mã → fallback status='pending' + ref_id=NULL",
    async () => {
      const marker = `PARSE-FB-${Date.now()}`;
      markers.push(marker);

      const { data, error } = await adminClient.rpc(
        "process_incoming_bank_transfer",
        {
          p_amount: 50000,
          p_memo: "tien thue nha thang 4",
          p_bank_ref_id: `TEST-FB-${marker}`,
        }
      );
      expect(error).toBeNull();
      expect((data as { status: string }).status).toBe("saved_unallocated");

      // Verify tx created với status='pending', ref_id NULL
      const { data: tx } = await adminClient
        .from("finance_transactions")
        .select("status, ref_id, business_type")
        .eq("bank_reference_id", `TEST-FB-${marker}`)
        .single();
      expect(tx?.status).toBe("pending");
      expect(tx?.ref_id).toBeNull();
      expect(tx?.business_type).toBe("other");
    }
  );

  // T4: Multi-order split proportional
  it.skipIf(isProduction)(
    "Multi-order: tỷ lệ outstanding, tổng phân bổ = p_amount",
    async () => {
      const marker = `MULTI-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const custId = await createTestB2BCustomer(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      await createTestBatch(adminClient, productId, whId, { quantity: 1000 });
      // Use tomorrow's date để test SO code không va chạm với prod-like data hôm nay
      const yymmdd = new Date(Date.now() + 86400000)
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, "");
      const code1 = `SO-${yymmdd}-${nextRnd()}`;
      const code2 = `SO-${yymmdd}-${nextRnd()}`;

      // Đơn 1 outstanding 30k
      const { orderId: id1 } = await createTestOrder(adminClient, {
        customerB2bId: custId,
        warehouseId: whId,
        code: code1,
        status: "PENDING",
        items: [{ productId, quantity: 1, unitPrice: 30000 }],
      });
      // Đơn 2 outstanding 70k
      const { orderId: id2 } = await createTestOrder(adminClient, {
        customerB2bId: custId,
        warehouseId: whId,
        code: code2,
        status: "PENDING",
        items: [{ productId, quantity: 1, unitPrice: 70000 }],
      });

      const { data, error } = await adminClient.rpc(
        "process_incoming_bank_transfer",
        {
          p_amount: 60000,
          p_memo: `thanh toan ${code1} va ${code2}`,
          p_bank_ref_id: `TEST-MULTI-${marker}`,
        }
      );
      expect(error).toBeNull();
      const result = data as {
        allocated: Array<{ order_code: string; amount: number }>;
        excess: number;
      };
      expect(result.allocated.length).toBe(2);

      // Tổng allocated + excess = 60000
      const total =
        result.allocated.reduce((s, a) => s + Number(a.amount), 0) +
        Number(result.excess || 0);
      expect(total).toBe(60000);

      // Tỷ lệ proportional: 30/100*60 = 18, 70/100*60 = 42
      await new Promise((r) => setTimeout(r, 300));
      const { data: o1 } = await adminClient
        .from("orders")
        .select("paid_amount")
        .eq("id", id1)
        .single();
      const { data: o2 } = await adminClient
        .from("orders")
        .select("paid_amount")
        .eq("id", id2)
        .single();
      expect(Number(o1?.paid_amount)).toBeCloseTo(18000, -2); // ±100đ rounding
      expect(Number(o2?.paid_amount)).toBeCloseTo(42000, -2);
    }
  );

  // T5: CK dư multi-order → phải có pending row cho phần thừa
  it.skipIf(isProduction)(
    "Multi-order CK dư → ghi pending tx cho phần thừa (không mất tiền)",
    async () => {
      const marker = `MULTI-EXCESS-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const custId = await createTestB2BCustomer(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      await createTestBatch(adminClient, productId, whId, { quantity: 1000 });
      // Use tomorrow's date để test SO code không va chạm với prod-like data hôm nay
      const yymmdd = new Date(Date.now() + 86400000)
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, "");
      const code1 = `SO-${yymmdd}-${nextRnd()}`;
      const code2 = `SO-${yymmdd}-${nextRnd()}`;

      await createTestOrder(adminClient, {
        customerB2bId: custId,
        warehouseId: whId,
        code: code1,
        status: "PENDING",
        items: [{ productId, quantity: 1, unitPrice: 20000 }],
      });
      await createTestOrder(adminClient, {
        customerB2bId: custId,
        warehouseId: whId,
        code: code2,
        status: "PENDING",
        items: [{ productId, quantity: 1, unitPrice: 30000 }],
      });

      // CK 80k, tổng outstanding chỉ 50k → dư 30k
      const bankRef = `TEST-EXCESS-${marker}`;
      const { data, error } = await adminClient.rpc(
        "process_incoming_bank_transfer",
        {
          p_amount: 80000,
          p_memo: `${code1} ${code2}`,
          p_bank_ref_id: bankRef,
        }
      );
      expect(error).toBeNull();
      expect((data as { excess: number }).excess).toBeGreaterThan(0);

      // Phải có pending tx với bank_ref_id = bankRef || '-remainder'
      const { data: remainderTx } = await adminClient
        .from("finance_transactions")
        .select("amount, status, business_type")
        .eq("bank_reference_id", `${bankRef}-remainder`)
        .maybeSingle();
      expect(remainderTx).toBeDefined();
      expect(remainderTx?.status).toBe("pending");
      expect(remainderTx?.business_type).toBe("other");
    }
  );

  // B4 regression: single-order overpay → tx amount clamp đúng
  it.skipIf(isProduction)(
    "Single-order overpay → tx chính amount=outstanding, tx phụ status=pending",
    async () => {
      const marker = `OVERPAY-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const custId = await createTestB2BCustomer(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      await createTestBatch(adminClient, productId, whId, { quantity: 1000 });
      // Use tomorrow's date để test SO code không va chạm với prod-like data hôm nay
      const yymmdd = new Date(Date.now() + 86400000)
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, "");
      const code = `SO-${yymmdd}-${nextRnd()}`;

      await createTestOrder(adminClient, {
        customerB2bId: custId,
        warehouseId: whId,
        code,
        status: "PENDING",
        items: [{ productId, quantity: 1, unitPrice: 70000 }],
      });

      const bankRef = `TEST-OVERPAY-${marker}`;
      const { data, error } = await adminClient.rpc(
        "process_incoming_bank_transfer",
        {
          p_amount: 100000,
          p_memo: code,
          p_bank_ref_id: bankRef,
        }
      );
      expect(error).toBeNull();
      const result = data as {
        allocated: Array<{ amount: number }>;
        excess: number;
      };
      expect(Number(result.allocated[0].amount)).toBe(70000);
      expect(Number(result.excess)).toBe(30000);

      // Tx chính completed = 70k
      const { data: mainTx } = await adminClient
        .from("finance_transactions")
        .select("amount, status")
        .eq("bank_reference_id", bankRef)
        .single();
      expect(Number(mainTx?.amount)).toBe(70000);
      expect(mainTx?.status).toBe("completed");

      // Tx dư pending = 30k
      const { data: excessTx } = await adminClient
        .from("finance_transactions")
        .select("amount, status")
        .eq("bank_reference_id", `${bankRef}-excess`)
        .single();
      expect(Number(excessTx?.amount)).toBe(30000);
      expect(excessTx?.status).toBe("pending");
    }
  );

  it.skipIf(isProduction)(
    "Idempotency: cùng bank_ref_id 2 lần → call thứ 2 trả ignored",
    async () => {
      const marker = `PARSE-IDEM-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const custId = await createTestB2BCustomer(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      await createTestBatch(adminClient, productId, whId, { quantity: 1000 });
      // Use tomorrow's date để test SO code không va chạm với prod-like data hôm nay
      const yymmdd = new Date(Date.now() + 86400000)
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, "");
      const code = `SO-${yymmdd}-${nextRnd()}`;
      await createTestOrder(adminClient, {
        customerB2bId: custId,
        warehouseId: whId,
        code,
        status: "PENDING",
        items: [{ productId, quantity: 1, unitPrice: 30000 }],
      });

      const bankRef = `TEST-IDEM-${marker}`;

      const first = await adminClient.rpc("process_incoming_bank_transfer", {
        p_amount: 30000,
        p_memo: code,
        p_bank_ref_id: bankRef,
      });
      expect((first.data as { status: string }).status).toBe("success");

      const second = await adminClient.rpc("process_incoming_bank_transfer", {
        p_amount: 30000,
        p_memo: code,
        p_bank_ref_id: bankRef,
      });
      expect((second.data as { status: string }).status).toBe("ignored");
    }
  );

  afterAll(async () => {
    if (!isProduction && markers.length > 0) {
      await cleanupTestData(adminClient, markers);
    }
  });
});
