import { describe, it, expect } from "vitest";

import { adminClient, isProduction } from "../helpers/supabase";

import {
  createTestWarehouse,
  createTestProduct,
  createTestB2BCustomer,
  createTestOrder,
  cleanupTestData,
} from "./helpers/fixtures";

/**
 * Integration test cho migration `20260422170000_payment_reminder_cron.sql`
 * + update `20260422180000_fix_http_post_and_idle_tx_hardening.sql` (net.http_post).
 *
 * `check_pending_payment_reminders()`:
 *   - Quét đơn B2B status='PENDING', tuổi ∈ [2h, 24h)
 *   - Insert b2b_notifications (type='order_status', reminder_kind='payment_pending')
 *     ở các mốc 2h/12h/20h, idempotent theo count notifications đã có
 *   - Skip ngoài giờ 08–20 VN
 *
 * SAFETY:
 *   - Test bypass trigger orders_deduct_on_confirm bằng status='PENDING' (không trừ kho)
 *   - Chỉnh `created_at` về quá khứ bằng UPDATE trực tiếp (admin bypass RLS)
 *   - Cleanup notifications + orders trong finally
 */
describe("check_pending_payment_reminders", () => {
  const skipOnProd = isProduction;

  // Kiểm tra giờ VN hiện tại — nếu ngoài 08–20 function return sớm → test skip
  const vnNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  );
  const vnHour = vnNow.getHours();
  const inBusinessHours = vnHour >= 8 && vnHour < 20;
  const skipForHour = !inBusinessHours;

  it.skipIf(skipOnProd || skipForHour)(
    "insert in-app notification cho đơn PENDING age >= 2h (mốc 1)",
    async () => {
      const marker = `PAYREMIND-${Date.now()}`;
      try {
        const warehouseId = await createTestWarehouse(adminClient, {
          name: marker,
        });
        const { productId } = await createTestProduct(adminClient, {
          name: marker,
        });
        const customerB2bId = await createTestB2BCustomer(adminClient, {
          name: marker,
        });

        const { orderId, orderCode } = await createTestOrder(adminClient, {
          customerB2bId,
          warehouseId,
          status: "PENDING",
          orderType: "B2B",
          code: `TEST-INTEGRATION-ORD-${marker}`,
          items: [{ productId, quantity: 1, unitPrice: 50000 }],
        });

        // Giả lập đơn tạo cách đây 3h (> mốc 1 là 2h, < mốc 2 là 12h)
        const pastTime = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
        const { error: updErr } = await adminClient
          .from("orders")
          .update({ created_at: pastTime })
          .eq("id", orderId);
        expect(updErr).toBeNull();

        // Baseline: chưa có notification cho order này
        const { data: before } = await adminClient
          .from("b2b_notifications")
          .select("id")
          .eq("customer_b2b_id", customerB2bId)
          .eq("type", "order_status");
        const countBefore = (before ?? []).length;

        // Fire cron function
        const { error: rpcErr } = await adminClient.rpc(
          "check_pending_payment_reminders"
        );
        expect(rpcErr).toBeNull();

        // Assert: 1 notification mới được insert
        const { data: after } = await adminClient
          .from("b2b_notifications")
          .select("id, type, title, data")
          .eq("customer_b2b_id", customerB2bId)
          .eq("type", "order_status");
        expect((after ?? []).length).toBe(countBefore + 1);

        const newNotif = (after ?? []).find(
          (n) => (n.data as Record<string, unknown>)?.order_code === orderCode
        );
        expect(newNotif).toBeDefined();
        const d = newNotif!.data as Record<string, unknown>;
        expect(d.reminder_kind).toBe("payment_pending");
        expect(d.milestone_idx).toBe(1);

        // IDEMPOTENT: gọi lần 2 cùng mốc → KHÔNG insert thêm
        await adminClient.rpc("check_pending_payment_reminders");
        const { data: after2 } = await adminClient
          .from("b2b_notifications")
          .select("id")
          .eq("customer_b2b_id", customerB2bId)
          .eq("type", "order_status");
        expect((after2 ?? []).length).toBe(countBefore + 1);

        // MỐC 2 (age >= 12h): update created_at → 13h trước
        const past12h = new Date(Date.now() - 13 * 3600 * 1000).toISOString();
        await adminClient
          .from("orders")
          .update({ created_at: past12h })
          .eq("id", orderId);

        await adminClient.rpc("check_pending_payment_reminders");
        const { data: after3 } = await adminClient
          .from("b2b_notifications")
          .select("id, data")
          .eq("customer_b2b_id", customerB2bId)
          .eq("type", "order_status");
        expect((after3 ?? []).length).toBe(countBefore + 2);
        const milestone2Notif = (after3 ?? []).find(
          (n) => (n.data as Record<string, unknown>)?.milestone_idx === 2
        );
        expect(milestone2Notif).toBeDefined();
      } finally {
        // Cleanup: xóa notifications theo customer + xóa data bằng marker
        await adminClient
          .from("b2b_notifications")
          .delete()
          .like("title", `%TEST-INTEGRATION%${marker}%`);
        await cleanupTestData(adminClient, [marker]);
      }
    },
    60000
  );

  it.skipIf(skipOnProd || skipForHour)(
    "KHÔNG nhắc đơn age < 2h (chưa tới mốc 1)",
    async () => {
      const marker = `PAYREMIND-YOUNG-${Date.now()}`;
      try {
        const warehouseId = await createTestWarehouse(adminClient, {
          name: marker,
        });
        const { productId } = await createTestProduct(adminClient, {
          name: marker,
        });
        const customerB2bId = await createTestB2BCustomer(adminClient, {
          name: marker,
        });

        const { orderId } = await createTestOrder(adminClient, {
          customerB2bId,
          warehouseId,
          status: "PENDING",
          orderType: "B2B",
          code: `TEST-INTEGRATION-ORD-${marker}`,
          items: [{ productId, quantity: 1, unitPrice: 50000 }],
        });

        // Đơn tạo cách đây 1h (chưa đến mốc 2h)
        const youngTime = new Date(Date.now() - 1 * 3600 * 1000).toISOString();
        await adminClient
          .from("orders")
          .update({ created_at: youngTime })
          .eq("id", orderId);

        const { error: rpcErr } = await adminClient.rpc(
          "check_pending_payment_reminders"
        );
        expect(rpcErr).toBeNull();

        const { data: notifs } = await adminClient
          .from("b2b_notifications")
          .select("id")
          .eq("customer_b2b_id", customerB2bId);
        expect((notifs ?? []).length).toBe(0);
      } finally {
        await cleanupTestData(adminClient, [marker]);
      }
    },
    60000
  );

  it.skipIf(skipOnProd || !skipForHour)(
    "SKIP: ngoài giờ 08–20 VN → function return sớm (no-op)",
    async () => {
      // Test này chỉ có ý nghĩa khi VN hour ∉ [08, 20). Ngoài giờ:
      // function return ngay không làm gì → không error.
      const { error } = await adminClient.rpc(
        "check_pending_payment_reminders"
      );
      expect(error).toBeNull();
    },
    10000
  );
});
