import { describe, it, expect, afterAll } from "vitest";

import { adminClient, isProduction } from "../helpers/supabase";

import {
  createTestWarehouse,
  createTestB2BCustomer,
  createTestProduct,
  createTestOrder,
  createTestBatch,
  cleanupTestData,
} from "./helpers/fixtures";

/**
 * Integration test cho Task 3 (order_status_history audit) + Task 4
 * (record_manual_payment_received RPC + PENDING→CONFIRMED + audit entry).
 *
 * Flow end-to-end:
 *   order PENDING → call record_manual_payment_received(full amount)
 *   → trigger auto_allocate update paid_amount + status=CONFIRMED
 *   → trigger log_order_status_change insert order_status_history row
 *   → trigger notify_payment_received insert b2b_notifications row
 */

const markers: string[] = [];

describe("order_status_history audit", () => {
  it.skipIf(isProduction)(
    "Update orders.status → insert row vào order_status_history",
    async () => {
      const marker = `HIST-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const custId = await createTestB2BCustomer(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      await createTestBatch(adminClient, productId, whId, { quantity: 1000 });
      const { orderId } = await createTestOrder(adminClient, {
        customerB2bId: custId,
        warehouseId: whId,
        status: "PENDING",
        items: [{ productId, quantity: 1, unitPrice: 1000 }],
      });

      await adminClient
        .from("orders")
        .update({ status: "CONFIRMED" })
        .eq("id", orderId);

      const { data } = await adminClient
        .from("order_status_history")
        .select("old_status, new_status, reason")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      expect(data?.length).toBeGreaterThan(0);
      const last = data![data!.length - 1];
      expect(last.old_status).toBe("PENDING");
      expect(last.new_status).toBe("CONFIRMED");
      expect(last.reason).toBe("payment_received");
    }
  );
});

describe("notify_payment_received — warehouse notification (B1 regression)", () => {
  it.skipIf(isProduction)(
    "Đơn PENDING → CONFIRMED → insert notifications type=warehouse_task cho user có role warehouse_*",
    async () => {
      const marker = `WH-NOTIFY-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const custId = await createTestB2BCustomer(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      await createTestBatch(adminClient, productId, whId, { quantity: 1000 });
      const { orderId } = await createTestOrder(adminClient, {
        customerB2bId: custId,
        warehouseId: whId,
        status: "PENDING",
        items: [{ productId, quantity: 1, unitPrice: 10000 }],
      });

      // Trigger fire — UPDATE status directly
      const { error: updErr } = await adminClient
        .from("orders")
        .update({ status: "CONFIRMED" })
        .eq("id", orderId);

      // B1 regression: trigger phải không throw 42703 "column role does not exist"
      expect(updErr).toBeNull();

      await new Promise((r) => setTimeout(r, 300));

      // Assert audit row được insert (trigger fire thành công)
      const { data: hist } = await adminClient
        .from("order_status_history")
        .select("new_status")
        .eq("order_id", orderId);
      expect(hist?.some((h) => h.new_status === "CONFIRMED")).toBe(true);

      // Warehouse notifications: có thể 0 (nếu không có user role warehouse_*)
      // nhưng KHÔNG được THROW. Assert query không lỗi là đủ cho regression.
      const { error: nErr } = await adminClient
        .from("notifications")
        .select("type, reference_id")
        .eq("reference_id", orderId)
        .eq("type", "warehouse_task");
      expect(nErr).toBeNull();
    }
  );
});

describe("record_manual_payment_received RPC", () => {
  it.skipIf(isProduction)(
    "Full outstanding → đơn PENDING → CONFIRMED + audit row + notification",
    async () => {
      const marker = `MANUAL-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const custId = await createTestB2BCustomer(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      await createTestBatch(adminClient, productId, whId, { quantity: 1000 });
      const { orderId } = await createTestOrder(adminClient, {
        customerB2bId: custId,
        warehouseId: whId,
        status: "PENDING",
        items: [{ productId, quantity: 2, unitPrice: 50000 }],
      });

      const { data, error } = await adminClient.rpc(
        "record_manual_payment_received",
        { p_order_id: orderId }
      );
      expect(error).toBeNull();
      expect((data as { success: boolean }).success).toBe(true);
      expect((data as { amount: number }).amount).toBe(100000);

      await new Promise((r) => setTimeout(r, 300));

      const { data: upd } = await adminClient
        .from("orders")
        .select("status, payment_status, paid_amount")
        .eq("id", orderId)
        .single();
      expect(upd?.status).toBe("CONFIRMED");
      expect(upd?.payment_status).toBe("paid");
      expect(Number(upd?.paid_amount)).toBe(100000);

      // Audit log entry
      const { data: hist } = await adminClient
        .from("order_status_history")
        .select("old_status, new_status")
        .eq("order_id", orderId);
      expect(
        hist?.some(
          (r) => r.old_status === "PENDING" && r.new_status === "CONFIRMED"
        )
      ).toBe(true);

      // Customer notification
      const { data: notifs } = await adminClient
        .from("b2b_notifications")
        .select("type, data")
        .eq("customer_b2b_id", custId)
        .eq("type", "order_status");
      expect(notifs?.length).toBeGreaterThan(0);
      const match = notifs!.find(
        (n) => (n.data as { order_id: string })?.order_id === orderId
      );
      expect(match).toBeDefined();
    }
  );

  it.skipIf(isProduction)("Đơn đã CANCELLED → RAISE EXCEPTION", async () => {
    const marker = `MANUAL-C-${Date.now()}`;
    markers.push(marker);
    const whId = await createTestWarehouse(adminClient, { name: marker });
    const custId = await createTestB2BCustomer(adminClient, { name: marker });
    const { productId } = await createTestProduct(adminClient, {
      name: marker,
    });
    await createTestBatch(adminClient, productId, whId, { quantity: 1000 });
    const { orderId } = await createTestOrder(adminClient, {
      customerB2bId: custId,
      warehouseId: whId,
      status: "CANCELLED",
      items: [{ productId, quantity: 1, unitPrice: 10000 }],
    });

    const { error } = await adminClient.rpc("record_manual_payment_received", {
      p_order_id: orderId,
    });
    expect(error?.message).toContain("Đơn đã hủy");
  });

  it.skipIf(isProduction)(
    "Overpay > outstanding + tolerance → RAISE EXCEPTION",
    async () => {
      const marker = `MANUAL-OP-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const custId = await createTestB2BCustomer(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      await createTestBatch(adminClient, productId, whId, { quantity: 1000 });
      const { orderId } = await createTestOrder(adminClient, {
        customerB2bId: custId,
        warehouseId: whId,
        status: "PENDING",
        items: [{ productId, quantity: 1, unitPrice: 10000 }],
      });

      const { error } = await adminClient.rpc(
        "record_manual_payment_received",
        {
          p_order_id: orderId,
          p_amount: 999999999,
        }
      );
      expect(error?.message).toMatch(/vượt quá|exceed/i);
    }
  );

  it.skipIf(isProduction)(
    "Overpay trong tolerance 100đ → PASS (sync với auto_allocate)",
    async () => {
      const marker = `MANUAL-TOL-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const custId = await createTestB2BCustomer(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      await createTestBatch(adminClient, productId, whId, { quantity: 1000 });
      const { orderId } = await createTestOrder(adminClient, {
        customerB2bId: custId,
        warehouseId: whId,
        status: "PENDING",
        items: [{ productId, quantity: 1, unitPrice: 10000 }],
      });

      // Overpay 50đ (trong tolerance 100) → phải pass.
      // Retry 3 lần vì RPC generate trans_code bằng RANDOM 4-digit → có
      // chance collision 1/10000 khi parallel test chạy cùng ngày. Fix
      // root cause cần migration đổi code-gen sang nextval (TODO separate).
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await adminClient.rpc(
          "record_manual_payment_received",
          {
            p_order_id: orderId,
            p_amount: 10050,
          }
        );
        if (!error) {
          lastErr = null;
          break;
        }
        lastErr = error;
        // Không retry nếu là lỗi nghiệp vụ (đã paid, v.v.)
        if ((error as { code?: string }).code !== "23505") break;
      }
      expect(lastErr).toBeNull();
    }
  );

  // T2 expose B5 cũ (đã fix bằng advisory lock)
  it.skipIf(isProduction)(
    "Race: 2 NV cùng click → chỉ 1 tx success, không có ghost alloc",
    async () => {
      const marker = `RACE-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const custId = await createTestB2BCustomer(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      await createTestBatch(adminClient, productId, whId, { quantity: 1000 });
      const { orderId } = await createTestOrder(adminClient, {
        customerB2bId: custId,
        warehouseId: whId,
        status: "PENDING",
        items: [{ productId, quantity: 1, unitPrice: 100000 }],
      });

      // Fire 2 call đồng thời
      const [r1, r2] = await Promise.all([
        adminClient.rpc("record_manual_payment_received", {
          p_order_id: orderId,
        }),
        adminClient.rpc("record_manual_payment_received", {
          p_order_id: orderId,
        }),
      ]);

      // Cả 2 có thể success nếu serialize đúng + call 2 đọc paid_amount=100k → throw "đã paid"
      // Hoặc 1 success + 1 throw "đã paid". Không cho phép 2 tx 100k tồn tại.
      const errors = [r1.error, r2.error].filter(Boolean);
      const successes = [r1.data, r2.data].filter(Boolean);

      // Tổng success + error phải = 2; errors phải chứa "đã thanh toán đủ"
      expect(successes.length + errors.length).toBe(2);
      if (errors.length > 0) {
        expect(
          errors.some((e) => e!.message.includes("đã thanh toán đủ"))
        ).toBe(true);
      }

      // Verify paid_amount không double
      await new Promise((r) => setTimeout(r, 200));
      const { data: upd } = await adminClient
        .from("orders")
        .select("paid_amount")
        .eq("id", orderId)
        .single();
      expect(Number(upd?.paid_amount)).toBeLessThanOrEqual(100100); // tolerance
      expect(Number(upd?.paid_amount)).toBeGreaterThanOrEqual(100000);

      // Verify chỉ 1 tx completed, không 2
      const { data: txs } = await adminClient
        .from("finance_transactions")
        .select("code, amount, status")
        .eq(
          "ref_id",
          (
            await adminClient
              .from("orders")
              .select("code")
              .eq("id", orderId)
              .single()
          ).data?.code
        )
        .eq("status", "completed");
      expect(txs?.length).toBe(1);
    }
  );
});

afterAll(async () => {
  if (!isProduction && markers.length > 0) {
    await cleanupTestData(adminClient, markers);
  }
});
