import { describe, it, expect, afterAll } from "vitest";

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
 * Backfill RPC reprocess_failed_bank_memos:
 * Tái hiện tình huống tx pending do regex cũ chỉ bắt 4 digits, sau migration
 * 20260428100000 sửa thành 8 digits, RPC backfill phải tìm + reprocess.
 */

describe("reprocess_failed_bank_memos", () => {
  const markers: string[] = [];

  it.skipIf(isProduction)(
    "Dry-run liệt kê tx candidate, KHÔNG mutate dữ liệu",
    async () => {
      const marker = `BF-DRY-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const custId = await createTestB2BCustomer(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      await createTestBatch(adminClient, productId, whId, { quantity: 1000 });

      const yymmdd = new Date(Date.now() + 86400000)
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, "");
      const seq8 = String(Date.now() % 100000000).padStart(8, "0");
      const code = `SO-${yymmdd}-${seq8}`;
      const memoStripped = `SO${yymmdd}${seq8}`;

      await createTestOrder(adminClient, {
        customerB2bId: custId,
        warehouseId: whId,
        code,
        status: "PENDING",
        items: [{ productId, quantity: 1, unitPrice: 50000 }],
      });

      const bankRef = `BF-DRY-REF-${marker}`;
      const { data: txInsert, error: insErr } = await adminClient
        .from("finance_transactions")
        .insert({
          code: `PT-${yymmdd}-DRY${(Date.now() % 1000).toString().padStart(3, "0")}`,
          amount: 50000,
          flow: "in",
          business_type: "other",
          fund_account_id: 1,
          status: "pending",
          bank_reference_id: bankRef,
          description: `Memo có mã SO-${yymmdd}-0000 nhưng đơn không tồn tại. ND gốc: ${memoStripped}`,
        })
        .select("id")
        .single();
      expect(insErr).toBeNull();

      const { data, error } = await adminClient.rpc(
        "reprocess_failed_bank_memos",
        { p_dry_run: true, p_limit: 200 }
      );
      expect(error).toBeNull();
      const result = data as {
        dry_run: boolean;
        processed_count: number;
        processed: Array<{
          tx_id: number;
          mode: string;
          extracted_codes: string[];
        }>;
      };
      expect(result.dry_run).toBe(true);
      const hit = result.processed.find((p) => p.tx_id === txInsert!.id);
      expect(hit).toBeDefined();
      expect(hit!.mode).toBe("dry_run");
      expect(hit!.extracted_codes).toContain(code);

      // Verify KHÔNG mutate: tx vẫn pending, description chưa có [BACKFILL
      const { data: txAfter } = await adminClient
        .from("finance_transactions")
        .select("status, description")
        .eq("id", txInsert!.id)
        .single();
      expect(txAfter?.status).toBe("pending");
      expect(txAfter?.description).not.toContain("[BACKFILL");
    }
  );

  it.skipIf(isProduction)(
    "Apply mode: tx pending → cancelled + đơn flip CONFIRMED + tx mới completed",
    async () => {
      const marker = `BF-APP-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const custId = await createTestB2BCustomer(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      await createTestBatch(adminClient, productId, whId, { quantity: 1000 });

      const yymmdd = new Date(Date.now() + 86400000)
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, "");
      const seq8 = String((Date.now() + 1) % 100000000).padStart(8, "0");
      const code = `SO-${yymmdd}-${seq8}`;
      const memoStripped = `SO${yymmdd}${seq8}`;

      const { orderId } = await createTestOrder(adminClient, {
        customerB2bId: custId,
        warehouseId: whId,
        code,
        status: "PENDING",
        items: [{ productId, quantity: 1, unitPrice: 75000 }],
      });

      const bankRef = `BF-APP-REF-${marker}`;
      const { data: txInsert } = await adminClient
        .from("finance_transactions")
        .insert({
          code: `PT-${yymmdd}-APP${(Date.now() % 1000).toString().padStart(3, "0")}`,
          amount: 75000,
          flow: "in",
          business_type: "other",
          fund_account_id: 1,
          status: "pending",
          bank_reference_id: bankRef,
          description: `Memo có mã SO-${yymmdd}-0000 nhưng đơn không tồn tại. ND gốc: ${memoStripped}`,
        })
        .select("id")
        .single();

      const { data, error } = await adminClient.rpc(
        "reprocess_failed_bank_memos",
        { p_dry_run: false, p_limit: 200 }
      );
      expect(error).toBeNull();
      const result = data as {
        processed_count: number;
        processed: Array<{
          tx_id: number;
          mode: string;
          rpc_result: { status: string };
        }>;
      };
      const hit = result.processed.find((p) => p.tx_id === txInsert!.id);
      expect(hit).toBeDefined();
      expect(hit!.mode).toBe("applied");
      expect(hit!.rpc_result.status).toBe("success");

      await new Promise((r) => setTimeout(r, 400));

      // Tx cũ bị cancelled (superseded bởi tx mới — enum không có 'voided')
      const { data: txOld } = await adminClient
        .from("finance_transactions")
        .select("status, bank_reference_id, description")
        .eq("id", txInsert!.id)
        .single();
      expect(txOld?.status).toBe("cancelled");
      expect(txOld?.bank_reference_id).toContain("__superseded_");
      expect(txOld?.description).toContain("[BACKFILL");

      // Đơn flip CONFIRMED
      const { data: order } = await adminClient
        .from("orders")
        .select("status, payment_status, paid_amount")
        .eq("id", orderId)
        .single();
      expect(order?.status).toBe("CONFIRMED");
      expect(order?.payment_status).toBe("paid");
      expect(Number(order?.paid_amount)).toBe(75000);

      // Có tx mới completed với bank_ref gốc
      const { data: newTx } = await adminClient
        .from("finance_transactions")
        .select("status, business_type, ref_id, ref_type, amount")
        .eq("bank_reference_id", bankRef)
        .single();
      expect(newTx?.status).toBe("completed");
      expect(newTx?.business_type).toBe("trade");
      expect(newTx?.ref_id).toBe(code);
      expect(newTx?.ref_type).toBe("order");
      expect(Number(newTx?.amount)).toBe(75000);
    }
  );

  it.skipIf(isProduction)(
    "Idempotent: chạy apply 2 lần → lần 2 không match (đã cancelled)",
    async () => {
      const marker = `BF-IDEM-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const custId = await createTestB2BCustomer(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      await createTestBatch(adminClient, productId, whId, { quantity: 1000 });

      const yymmdd = new Date(Date.now() + 86400000)
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, "");
      const seq8 = String((Date.now() + 2) % 100000000).padStart(8, "0");
      const code = `SO-${yymmdd}-${seq8}`;
      const memoStripped = `SO${yymmdd}${seq8}`;

      await createTestOrder(adminClient, {
        customerB2bId: custId,
        warehouseId: whId,
        code,
        status: "PENDING",
        items: [{ productId, quantity: 1, unitPrice: 25000 }],
      });

      const bankRef = `BF-IDEM-REF-${marker}`;
      const { data: txInsert } = await adminClient
        .from("finance_transactions")
        .insert({
          code: `PT-${yymmdd}-IDM${(Date.now() % 1000).toString().padStart(3, "0")}`,
          amount: 25000,
          flow: "in",
          business_type: "other",
          fund_account_id: 1,
          status: "pending",
          bank_reference_id: bankRef,
          description: `Memo có mã SO-${yymmdd}-0000 nhưng đơn không tồn tại. ND gốc: ${memoStripped}`,
        })
        .select("id")
        .single();

      const first = await adminClient.rpc("reprocess_failed_bank_memos", {
        p_dry_run: false,
        p_limit: 200,
      });
      const firstHit = (
        first.data as { processed: Array<{ tx_id: number }> }
      ).processed.find((p) => p.tx_id === txInsert!.id);
      expect(firstHit).toBeDefined();

      const second = await adminClient.rpc("reprocess_failed_bank_memos", {
        p_dry_run: false,
        p_limit: 200,
      });
      const secondHit = (
        second.data as { processed: Array<{ tx_id: number }> }
      ).processed.find((p) => p.tx_id === txInsert!.id);
      expect(secondHit).toBeUndefined();
    }
  );

  it.skipIf(isProduction)(
    "Skipped: order extract ra nhưng không tồn tại trong DB → skipped reason='orders_not_found'",
    async () => {
      const marker = `BF-NOTFOUND-${Date.now()}`;
      markers.push(marker);

      const yymmdd = new Date(Date.now() + 86400000)
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, "");
      const seq8 = String((Date.now() + 3) % 100000000).padStart(8, "0");
      // KHÔNG tạo order — chỉ tạo tx pending
      const memoStripped = `SO${yymmdd}${seq8}`;

      const bankRef = `BF-NOTFOUND-REF-${marker}`;
      const { data: txInsert } = await adminClient
        .from("finance_transactions")
        .insert({
          code: `PT-${yymmdd}-NOT${(Date.now() % 1000).toString().padStart(3, "0")}`,
          amount: 10000,
          flow: "in",
          business_type: "other",
          fund_account_id: 1,
          status: "pending",
          bank_reference_id: bankRef,
          description: `Memo có mã SO-${yymmdd}-0000 nhưng đơn không tồn tại. ND gốc: ${memoStripped}`,
        })
        .select("id")
        .single();

      const { data } = await adminClient.rpc("reprocess_failed_bank_memos", {
        p_dry_run: false,
        p_limit: 200,
      });
      const result = data as {
        skipped: Array<{ tx_id: number; reason: string }>;
      };
      const hit = result.skipped.find((s) => s.tx_id === txInsert!.id);
      expect(hit).toBeDefined();
      expect(hit!.reason).toBe("orders_not_found");

      // Tx vẫn pending, không bị voided
      const { data: txAfter } = await adminClient
        .from("finance_transactions")
        .select("status")
        .eq("id", txInsert!.id)
        .single();
      expect(txAfter?.status).toBe("pending");
    }
  );

  afterAll(async () => {
    if (!isProduction && markers.length > 0) {
      await cleanupTestData(adminClient, markers);
    }
  });
});
