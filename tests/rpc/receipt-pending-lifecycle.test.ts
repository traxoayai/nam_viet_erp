import { describe, it, expect, beforeAll } from "vitest";

import { adminClient, isProduction } from "../helpers/supabase";

/**
 * Nghiệp vụ: Khi NV bấm "Tạo Phiếu Thu" ở B2BOrderDetailPage, phiếu phải
 * được tạo với status='pending' — order KHÔNG tự chuyển 'Đã TT'. Chỉ khi
 * Thủ Quỹ bấm "Xác nhận đã thu" (UPDATE status='completed'), trigger
 * auto_allocate_payment_to_orders + fn_sync_payment_to_order mới fire →
 * order.paid_amount tăng + payment_status='paid'.
 *
 * Trước fix: useFinanceFormLogic.handleFinish() auto-set status='completed'
 * cho phiếu thu trade ref_type='order' → bypass bước thủ quỹ. Sau fix:
 * luôn 'pending'.
 *
 * Test này đi thẳng xuống DB insert/update finance_transactions để verify
 * hành vi của trigger — không phụ thuộc FE. Là contract test của trigger,
 * FE chỉ cần luôn set status='pending' thì nghiệp vụ đúng.
 *
 * SAFETY: skip on prod (insert/update finance_transactions + orders thật).
 */
describe("Receipt lifecycle: pending → completed gates order paid status", () => {
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

    const { data: funds } = await adminClient
      .from("fund_accounts")
      .select("id")
      .limit(1);
    testFundAccountId = funds?.[0]?.id ?? null;
  });

  it.skipIf(skipOnProd)(
    "phiếu thu status='pending' → order vẫn unpaid; UPDATE='completed' → order paid",
    async () => {
      if (!testCustomerId || !testWarehouseId || !testFundAccountId) {
        console.warn(
          "[receipt-pending] Skip: missing customer_b2b / warehouse / fund_account seed"
        );
        return;
      }

      const suffix = Date.now();
      const orderCode = `TEST-RCPT-${suffix}`;
      const txnCode = `FT-RCPT-${suffix}`;

      const { data: orderRow, error: orderErr } = await adminClient
        .from("orders")
        .insert({
          code: orderCode,
          customer_id: testCustomerId,
          warehouse_id: testWarehouseId,
          order_type: "B2B",
          status: "CONFIRMED",
          payment_status: "unpaid",
          final_amount: 100000,
          paid_amount: 0,
          total_amount: 100000,
        })
        .select("id")
        .single();

      if (orderErr || !orderRow) {
        console.warn(
          "[receipt-pending] Skip: không insert được order —",
          orderErr?.message
        );
        return;
      }

      const orderId = orderRow.id as number;

      try {
        // PHASE 1: tạo phiếu thu status='pending' — trigger KHÔNG fire
        const { data: txnInsert, error: insertErr } = await adminClient
          .from("finance_transactions")
          .insert({
            code: txnCode,
            flow: "in",
            amount: 100000,
            status: "pending",
            ref_type: "order",
            ref_id: orderCode,
            partner_type: "customer_b2b",
            partner_id: String(testCustomerId),
            fund_account_id: testFundAccountId,
            transaction_date: new Date().toISOString(),
          })
          .select("id")
          .single();

        expect(
          insertErr,
          `insert pending failed: ${insertErr?.message}`
        ).toBeNull();
        expect(txnInsert?.id).toBeDefined();

        const { data: orderAfterPending } = await adminClient
          .from("orders")
          .select("paid_amount, status, payment_status")
          .eq("id", orderId)
          .single();

        // Contract: status='pending' → trigger không allocate
        expect(Number(orderAfterPending?.paid_amount ?? 0)).toBe(0);
        expect(orderAfterPending?.payment_status).toBe("unpaid");
        expect(orderAfterPending?.status).toBe("CONFIRMED");

        // PHASE 2: thủ quỹ bấm "Xác nhận đã thu" → UPDATE status='completed'
        const { error: updateErr } = await adminClient
          .from("finance_transactions")
          .update({ status: "completed" })
          .eq("code", txnCode);

        expect(
          updateErr,
          `update completed failed: ${updateErr?.message}`
        ).toBeNull();

        const { data: orderAfterCompleted } = await adminClient
          .from("orders")
          .select("paid_amount, status, payment_status")
          .eq("id", orderId)
          .single();

        expect(Number(orderAfterCompleted?.paid_amount ?? 0)).toBe(100000);
        expect(orderAfterCompleted?.payment_status).toBe("paid");
      } finally {
        await adminClient
          .from("finance_transactions")
          .delete()
          .eq("code", txnCode);
        await adminClient.from("orders").delete().eq("id", orderId);
      }
    },
    30000
  );

  it.skipIf(skipOnProd)(
    "nhiều phiếu pending không cộng dồn paid_amount",
    async () => {
      if (!testCustomerId || !testWarehouseId || !testFundAccountId) {
        return;
      }

      const suffix = Date.now();
      const orderCode = `TEST-RCPT-MULTI-${suffix}`;
      const txnCodes = [
        `FT-MULTI-A-${suffix}`,
        `FT-MULTI-B-${suffix}`,
        `FT-MULTI-C-${suffix}`,
      ];

      const { data: orderRow } = await adminClient
        .from("orders")
        .insert({
          code: orderCode,
          customer_id: testCustomerId,
          warehouse_id: testWarehouseId,
          order_type: "B2B",
          status: "CONFIRMED",
          payment_status: "unpaid",
          final_amount: 300000,
          paid_amount: 0,
          total_amount: 300000,
        })
        .select("id")
        .single();

      if (!orderRow) return;
      const orderId = orderRow.id as number;

      try {
        for (const code of txnCodes) {
          await adminClient.from("finance_transactions").insert({
            code,
            flow: "in",
            amount: 100000,
            status: "pending",
            ref_type: "order",
            ref_id: orderCode,
            partner_type: "customer_b2b",
            partner_id: String(testCustomerId),
            fund_account_id: testFundAccountId,
            transaction_date: new Date().toISOString(),
          });
        }

        const { data: order } = await adminClient
          .from("orders")
          .select("paid_amount, payment_status")
          .eq("id", orderId)
          .single();

        // 3 pending = 0 đồng ghi nhận vào order
        expect(Number(order?.paid_amount ?? 0)).toBe(0);
        expect(order?.payment_status).toBe("unpaid");
      } finally {
        await adminClient
          .from("finance_transactions")
          .delete()
          .in("code", txnCodes);
        await adminClient.from("orders").delete().eq("id", orderId);
      }
    },
    30000
  );
});
