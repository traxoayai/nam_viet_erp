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
      const { productId } = await createTestProduct(adminClient, { name: marker });
      const { orderId } = await createTestOrder(adminClient, {
        customerB2bId: custId,
        warehouseId: whId,
        status: "PENDING",
        items: [{ productId, quantity: 1, unitPrice: 1000 }],
      });

      await adminClient.from("orders").update({ status: "CONFIRMED" }).eq("id", orderId);

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
    },
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
      const { productId } = await createTestProduct(adminClient, { name: marker });
      const { orderId } = await createTestOrder(adminClient, {
        customerB2bId: custId,
        warehouseId: whId,
        status: "PENDING",
        items: [{ productId, quantity: 2, unitPrice: 50000 }],
      });

      const { data, error } = await adminClient.rpc(
        "record_manual_payment_received",
        { p_order_id: orderId },
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
      expect(hist?.some((r) => r.old_status === "PENDING" && r.new_status === "CONFIRMED")).toBe(true);

      // Customer notification
      const { data: notifs } = await adminClient
        .from("b2b_notifications")
        .select("type, data")
        .eq("customer_b2b_id", custId)
        .eq("type", "order_status");
      expect(notifs?.length).toBeGreaterThan(0);
      const match = notifs!.find(
        (n) => (n.data as { order_id: string })?.order_id === orderId,
      );
      expect(match).toBeDefined();
    },
  );

  it.skipIf(isProduction)(
    "Đơn đã CANCELLED → RAISE EXCEPTION",
    async () => {
      const marker = `MANUAL-C-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const custId = await createTestB2BCustomer(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, { name: marker });
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
    },
  );

  it.skipIf(isProduction)(
    "Overpay > outstanding → RAISE EXCEPTION",
    async () => {
      const marker = `MANUAL-OP-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const custId = await createTestB2BCustomer(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, { name: marker });
      const { orderId } = await createTestOrder(adminClient, {
        customerB2bId: custId,
        warehouseId: whId,
        status: "PENDING",
        items: [{ productId, quantity: 1, unitPrice: 10000 }],
      });

      const { error } = await adminClient.rpc("record_manual_payment_received", {
        p_order_id: orderId,
        p_amount: 999999999,
      });
      expect(error?.message).toMatch(/vượt quá|exceed/i);
    },
  );
});

afterAll(async () => {
  if (!isProduction && markers.length > 0) {
    await cleanupTestData(adminClient, markers);
  }
});
