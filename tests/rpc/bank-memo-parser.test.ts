import { describe, it, expect, afterAll } from "vitest";
import { adminClient, isProduction } from "../helpers/supabase";
import {
  createTestWarehouse,
  createTestB2BCustomer,
  createTestProduct,
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
    { memo: "TT SO260423 6745 VA SO260422 2634", expected: ["SO-260423-6745", "SO-260422-2634"] },
    { memo: "POS-260423-0001", expected: ["POS-260423-0001"] },
    { memo: "so-260423-6745", expected: ["SO-260423-6745"] }, // lowercase
    { memo: "tiền thuê nhà", expected: [] },
    { memo: "", expected: [] },
    { memo: null, expected: [] },
    // Dedupe: 2 lần cùng 1 mã → chỉ giữ 1
    { memo: "SO-260423-6745 va lai SO-260423-6745", expected: ["SO-260423-6745"] },
  ];

  for (const { memo, expected } of cases) {
    it(`parse: ${JSON.stringify(memo)}`, async () => {
      const { data, error } = await adminClient.rpc(
        "extract_order_codes_from_memo",
        { p_memo: memo },
      );
      expect(error).toBeNull();
      expect(data).toEqual(expected);
    });
  }
});

describe("process_incoming_bank_transfer — end-to-end với memo variations", () => {
  const markers: string[] = [];

  it.skipIf(isProduction)(
    "Memo có text phụ vẫn match đơn → tx completed + đơn CONFIRMED",
    async () => {
      const marker = `PARSE-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const custId = await createTestB2BCustomer(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, { name: marker });

      // Code format hợp regex: SO-YYMMDD-NNNN
      const yymmdd = new Date().toISOString().slice(2, 10).replace(/-/g, "");
      const code = `SO-${yymmdd}-9999`;
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
        },
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
    },
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
        },
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
    },
  );

  it.skipIf(isProduction)(
    "Idempotency: cùng bank_ref_id 2 lần → call thứ 2 trả ignored",
    async () => {
      const marker = `PARSE-IDEM-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const custId = await createTestB2BCustomer(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, { name: marker });
      const yymmdd = new Date().toISOString().slice(2, 10).replace(/-/g, "");
      const code = `SO-${yymmdd}-8888`;
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
    },
  );

  afterAll(async () => {
    if (!isProduction && markers.length > 0) {
      await cleanupTestData(adminClient, markers);
    }
  });
});
