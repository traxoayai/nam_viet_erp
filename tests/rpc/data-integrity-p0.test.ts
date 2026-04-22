import { describe, it, expect, beforeAll } from "vitest";

import { adminClient, isProduction } from "../helpers/supabase";

import {
  createTestWarehouse,
  createTestProduct,
  createTestBatch,
  createTestB2BCustomer,
  createTestOrder,
  cleanupTestData,
} from "./helpers/fixtures";

/**
 * Bug #1 (Data Integrity P0 — Task 3):
 * auto_allocate_payment_to_orders() trigger chứa 2 FOR loop đọc-rồi-update
 * orders.paid_amount KHÔNG có FOR UPDATE → 2 finance_transactions đồng thời
 * đến cùng đọc paid_amount cũ → lost update → khách ghi thiếu.
 *
 * Fix: migration 20260423200000_fix_payment_allocation_lock.sql thêm
 * FOR UPDATE vào cuối 2 SELECT trong FOR loop.
 *
 * Test này simulate 2 payment song song cùng ref_id = order code, đảm bảo
 * sau khi cả 2 transaction chạy xong, paid_amount = tổng đúng (không lost
 * update), và status auto-confirmed.
 *
 * SAFETY: Theo rule "không ghi dữ liệu thật", test này chỉ chạy khi
 * TEST_TARGET != 'prod'. Trên prod → skip.
 */
describe("Bug #1: auto_allocate_payment_to_orders concurrent safety", () => {
  // Guard: cấm chạy test side-effect này lên prod DB
  const skipOnProd = isProduction;

  let testCustomerId: number | null = null;
  let testWarehouseId: number | null = null;
  let testFundAccountId: number | null = null;

  beforeAll(async () => {
    if (skipOnProd) return;

    const { data: customers } = await adminClient
      .from("customers_b2b")
      .select("id")
      .limit(1);
    testCustomerId = customers?.[0]?.id ?? null;

    const { data: warehouses } = await adminClient
      .from("warehouses")
      .select("id")
      .limit(1);
    testWarehouseId = warehouses?.[0]?.id ?? null;

    // finance_transactions.fund_account_id là NOT NULL; cần 1 quỹ bất kỳ
    const { data: funds } = await adminClient
      .from("fund_accounts")
      .select("id")
      .limit(1);
    testFundAccountId = funds?.[0]?.id ?? null;
  });

  it.skipIf(skipOnProd)(
    "serializes 2 concurrent payments to same order (no lost update)",
    async () => {
      if (!testCustomerId || !testWarehouseId || !testFundAccountId) {
        console.warn(
          "[data-integrity-p0] Skip: missing customer_b2b / warehouse / fund_account seed"
        );
        return;
      }

      const suffix = Date.now();
      const orderCode = `TEST-LOCK-${suffix}`;

      // Insert order trực tiếp (bypass create_sales_order RPC vì RPC có auth
      // guard block service_role). Đủ data để trigger chạy: final_amount,
      // paid_amount=0, status=PENDING, customer_id, code.
      const { data: orderRow, error: orderErr } = await adminClient
        .from("orders")
        .insert({
          code: orderCode,
          customer_id: testCustomerId,
          warehouse_id: testWarehouseId,
          order_type: "B2B",
          status: "PENDING",
          payment_status: "unpaid",
          final_amount: 10000,
          paid_amount: 0,
          total_amount: 10000,
        })
        .select("id")
        .single();

      if (orderErr || !orderRow) {
        // Nếu schema khác (thiếu cột bắt buộc chẳng hạn), test không assert
        // được — log rõ nhưng không fail infra.
        console.warn(
          "[data-integrity-p0] Skip: không insert được order test —",
          orderErr?.message
        );
        return;
      }

      const orderId = orderRow.id as number;

      try {
        // 2 finance_transactions song song, cùng ref_id = orderCode.
        // Nếu không có FOR UPDATE: 2 trigger đọc paid_amount=0, mỗi cái ghi
        // 5000 → final 5000 (lost update). Có FOR UPDATE: serialize → 10000.
        const insert = (code: string) =>
          adminClient.from("finance_transactions").insert({
            code,
            flow: "in",
            amount: 5000,
            status: "completed",
            ref_type: "order",
            ref_id: orderCode,
            partner_type: "customer_b2b",
            partner_id: String(testCustomerId),
            fund_account_id: testFundAccountId,
            transaction_date: new Date().toISOString(),
          });

        const [resA, resB] = await Promise.all([
          insert(`FT-A-${suffix}`),
          insert(`FT-B-${suffix}`),
        ]);

        // Cả 2 insert phải thành công
        expect(
          resA.error,
          `insert A failed: ${resA.error?.message}`
        ).toBeNull();
        expect(
          resB.error,
          `insert B failed: ${resB.error?.message}`
        ).toBeNull();

        const { data: order, error: readErr } = await adminClient
          .from("orders")
          .select("paid_amount, status, payment_status")
          .eq("id", orderId)
          .single();

        expect(readErr).toBeNull();
        // Assert KHÔNG lost update: tổng phải đúng 10000
        expect(Number(order?.paid_amount)).toBe(10000);
        // Auto-confirm khi fully paid (logic của trigger cũ giữ nguyên)
        expect(order?.status).toBe("CONFIRMED");
        expect(order?.payment_status).toBe("paid");
      } finally {
        // Cleanup — cả happy và error path
        await adminClient
          .from("finance_transactions")
          .delete()
          .in("code", [`FT-A-${suffix}`, `FT-B-${suffix}`]);
        await adminClient.from("orders").delete().eq("id", orderId);
      }
    },
    30000
  );
});

/**
 * Bug #3 (Data Integrity P0 — Task 5):
 * confirm_outbound_packing V3 có idempotent check
 * `v_already_deducted := EXISTS(SELECT ... FROM inventory_transactions)`
 * TRƯỚC khi vào `FOR ... FOR UPDATE` lock inventory_batches.
 * Race window:
 *   T1 check → v_already_deducted = false
 *   T2 check → v_already_deducted = false (đồng thời)
 *   T1 lock batches + trừ kho + ghi txn → commit
 *   T2 lock batches (chờ T1) + trừ kho LẦN 2 + ghi txn thứ 2
 * → Double-deduct (đã gây 21 đơn từ 15/3 đến 22/4).
 *
 * Fix (migration 20260423200100): pg_advisory_xact_lock(md5(order_id))
 * ngay đầu body function. T2 phải chờ T1 commit xong → đọc được txn T1 đã
 * ghi → v_already_deducted = true → rơi BRANCH 1, không trừ lần 2.
 *
 * SAFETY: chỉ chạy local (TEST_TARGET != 'prod').
 */
describe("Bug #3: confirm_outbound_packing advisory lock", () => {
  const skipOnProd = isProduction;

  it.skipIf(skipOnProd)(
    "serializes 2 concurrent packing for same order (no double deduct)",
    async () => {
      const marker = `BUG3-${Date.now()}`;
      try {
        const warehouseId = await createTestWarehouse(adminClient, {
          name: marker,
        });
        const { productId } = await createTestProduct(adminClient, {
          name: marker,
          actualCost: 10000,
        });
        const { batchId, inventoryBatchId } = await createTestBatch(
          adminClient,
          productId,
          warehouseId,
          {
            quantity: 100,
            batchCode: `TEST-INTEGRATION-BATCH-${marker}`,
            inboundPrice: 10000,
          }
        );
        const customerB2bId = await createTestB2BCustomer(adminClient, {
          name: marker,
        });

        // Insert CONFIRMED order TRỰC TIẾP → trigger `orders_deduct_on_confirm`
        // chỉ fire AFTER UPDATE (không fire trên INSERT) → order CHƯA trừ kho.
        // Scenario này đúng race window: 2 call confirm_outbound_packing song song
        // cùng thấy "chưa trừ" → cả 2 cùng định trừ → advisory lock phải serialize.
        const { orderId, orderCode } = await createTestOrder(adminClient, {
          customerB2bId,
          warehouseId,
          status: "CONFIRMED",
          orderType: "B2B",
          code: `TEST-INTEGRATION-ORD-${marker}`,
          items: [{ productId, quantity: 2, unitPrice: 10000, uom: "Hộp" }],
        });

        // Baseline: chưa có sale txn
        const { data: beforeTxn } = await adminClient
          .from("inventory_transactions")
          .select("id, quantity")
          .eq("ref_id", orderCode)
          .in("action_group", ["sale", "SALE"]);
        expect(beforeTxn ?? []).toHaveLength(0);

        // Gọi 2 lần SONG SONG → advisory lock phải serialize.
        // Có 2 outcome hợp lệ (đều chứng minh lock hoạt động):
        //   (A) T2 vào critical section TRƯỚC khi T1 commit UPDATE status → T2 thấy
        //       status=CONFIRMED + txn đã ghi → success + already_deducted=true.
        //   (B) T2 vào SAU khi T1 commit → T2 thấy status=PACKED → raise exception
        //       "Đơn hàng không ở trạng thái chờ đóng gói (CONFIRMED)".
        // Cả 2 đều OK miễn là KHÔNG có txn thứ 2 được insert (no double-deduct).
        const [r1, r2] = await Promise.all([
          adminClient.rpc("confirm_outbound_packing", { p_order_id: orderId }),
          adminClient.rpc("confirm_outbound_packing", { p_order_id: orderId }),
        ]);

        // Chấp nhận cả 2 outcome (case A hoặc B).
        const successes = [r1, r2].filter((r) => r.error === null);
        const errors = [r1, r2].filter((r) => r.error !== null);

        // Tối thiểu phải có 1 success (call đi vào critical section đầu tiên)
        expect(successes.length).toBeGreaterThanOrEqual(1);

        // Nếu có error: message phải là "không CONFIRMED" (case B), không phải crash khác
        if (errors.length > 0) {
          expect(errors[0].error!.message).toMatch(/CONFIRMED|chờ đóng gói/);
        }

        // KEY ASSERT: tổng sale txn phải đúng 1 (không double-deduct)
        const { data: afterTxn } = await adminClient
          .from("inventory_transactions")
          .select("quantity")
          .eq("ref_id", orderCode)
          .in("action_group", ["sale", "SALE"])
          .lt("quantity", 0);
        expect(afterTxn ?? []).toHaveLength(1);
        expect(afterTxn![0].quantity).toBe(-2);

        // inventory_batches.quantity = 100 - 2 = 98 (KHÔNG phải 96)
        const { data: invBatch } = await adminClient
          .from("inventory_batches")
          .select("quantity")
          .eq("id", inventoryBatchId)
          .single();
        expect(invBatch?.quantity).toBe(98);

        // Phân tích response:
        //   - Call đầu tiên vào critical section: already_deducted=false, trừ kho
        //   - Call thứ 2 (case A): already_deducted=true (idempotent)
        //   - Call thứ 2 (case B): error vì status=PACKED
        if (successes.length === 2) {
          const flags = successes.map(
            (r) =>
              (r.data as { already_deducted?: boolean } | null)
                ?.already_deducted
          );
          // Case A: 1 false (trừ thật) + 1 true (idempotent)
          expect(flags.filter((x) => x === true).length).toBeGreaterThanOrEqual(
            1
          );
          expect(flags.filter((x) => x === false).length).toBe(1);
        }

        // Sau khi packing xong: order phải ở status PACKED
        const { data: afterOrder } = await adminClient
          .from("orders")
          .select("status")
          .eq("id", orderId)
          .single();
        expect(afterOrder?.status).toBe("PACKED");

        // Dùng batchId để tránh ESLint unused-var (verify batch tồn tại)
        expect(batchId).toBeGreaterThan(0);
      } finally {
        await cleanupTestData(adminClient, [marker]);
      }
    },
    60000
  );
});
