import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient } from "../helpers/supabase";

// ─── Test constants ─────────────────────────────────────────────────────────
const TEST_PREFIX = "__test_admin_notif__";

/** IDs to clean up in afterAll */
const createdNotificationIds: string[] = [];
const createdRegistrationIds: string[] = [];
const createdOrderIds: string[] = [];
const createdTransactionIds: number[] = [];

/** Seeded references */
let realFundAccountId: number | null = null;
let realCustomerB2bId: number | null = null;
let adminUserId: string | null = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function findAdminNotifications(titleContains: string) {
  const { data, error } = await adminClient
    .from("notifications")
    .select("*")
    .like("title", `%${titleContains}%`)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Query notifications failed: ${error.message}`);
  return data ?? [];
}

async function cleanupNotificationsByTitle(titleContains: string) {
  const { data } = await adminClient
    .from("notifications")
    .select("id")
    .like("title", `%${titleContains}%`);

  if (data && data.length > 0) {
    const ids = data.map((r) => r.id);
    await adminClient.from("notifications").delete().in("id", ids);
  }
}

// ─── Setup / Teardown ───────────────────────────────────────────────────────

beforeAll(async () => {
  // Find a real fund_account for finance_transactions insert
  const { data: funds } = await adminClient
    .from("fund_accounts")
    .select("id")
    .limit(1)
    .single();

  if (funds) {
    realFundAccountId = funds.id;
  }

  // Find a real customer_b2b for order tests
  const { data: customers } = await adminClient
    .from("customers_b2b")
    .select("id")
    .limit(1)
    .single();

  if (customers) {
    realCustomerB2bId = customers.id;
  }

  // Find an admin user (user with portal.manage or admin-all permission)
  const { data: adminUsers } = await adminClient
    .from("user_roles")
    .select("user_id, role_permissions!inner(permission_key)")
    .or(
      "permission_key.in.(portal.manage,admin-all)",
      { referencedTable: "role_permissions" }
    )
    .limit(1)
    .single();

  if (adminUsers) {
    adminUserId = adminUsers.user_id;
  }

  if (!realFundAccountId) {
    console.warn("No fund_accounts found — payment trigger tests will be skipped");
  }
  if (!adminUserId) {
    console.warn("No admin user found — notification verification may fail");
  }
});

afterAll(async () => {
  // Clean up notifications created by triggers
  await cleanupNotificationsByTitle(TEST_PREFIX);

  // Clean up registration requests
  if (createdRegistrationIds.length > 0) {
    await adminClient
      .from("registration_requests")
      .delete()
      .in("id", createdRegistrationIds);
  }

  // Clean up orders
  if (createdOrderIds.length > 0) {
    // Delete order_items first (FK)
    for (const orderId of createdOrderIds) {
      await adminClient.from("order_items").delete().eq("order_id", orderId);
    }
    await adminClient.from("orders").delete().in("id", createdOrderIds);
  }

  // Clean up finance transactions
  if (createdTransactionIds.length > 0) {
    await adminClient
      .from("finance_transactions")
      .delete()
      .in("id", createdTransactionIds);
  }
});

// ─── A. Registration trigger ────────────────────────────────────────────────

describe("Admin Notification Triggers", () => {
  describe("A. Registration trigger (fn_notify_admin_new_registration)", () => {
    it("creates admin notification on registration_requests insert", async () => {
      const businessName = `${TEST_PREFIX}Nha Thuoc Test`;

      const { data, error } = await adminClient
        .from("registration_requests")
        .insert({
          business_name: businessName,
          phone: "0909000111",
          email: `${TEST_PREFIX}test@example.com`,
          contact_name: "Nguyen Van Test",
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      createdRegistrationIds.push(data!.id);

      // Wait briefly for trigger to execute
      await new Promise((r) => setTimeout(r, 500));

      // Verify notification was created for admin users
      const notifications = await findAdminNotifications("Đăng ký Portal mới");
      const matched = notifications.filter((n) =>
        n.message?.includes(businessName)
      );

      if (adminUserId) {
        expect(matched.length).toBeGreaterThanOrEqual(1);
        const notif = matched[0];
        expect(notif.title).toBe("Đăng ký Portal mới");
        expect(notif.type).toBe("info");
        expect(notif.reference_id).toBe(data!.id);
        expect(notif.message).toContain(businessName);
        expect(notif.message).toContain("Nguyen Van Test");
      }
    });
  });

  // ─── B. Portal order trigger ──────────────────────────────────────────────

  describe("B. Portal order trigger (fn_notify_admin_new_portal_order)", () => {
    it("creates admin notification for portal order", async () => {
      const orderCode = `${TEST_PREFIX}PO-001`;

      const { data, error } = await adminClient
        .from("orders")
        .insert({
          code: orderCode,
          customer_id: realCustomerB2bId,
          source: "portal",
          status: "PENDING",
          total_amount: 500000,
          final_amount: 500000,
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      createdOrderIds.push(data!.id);

      // Wait briefly for trigger
      await new Promise((r) => setTimeout(r, 500));

      const notifications = await findAdminNotifications("Đơn hàng Portal mới");
      const matched = notifications.filter((n) =>
        n.message?.includes(orderCode)
      );

      if (adminUserId) {
        expect(matched.length).toBeGreaterThanOrEqual(1);
        const notif = matched[0];
        expect(notif.title).toBe("Đơn hàng Portal mới");
        expect(notif.type).toBe("info");
        expect(notif.reference_id).toBe(data!.id);
      }
    });

    it("does NOT create notification for ERP order (source=erp)", async () => {
      const orderCode = `${TEST_PREFIX}ERP-001`;

      // Count existing notifications before
      const beforeNotifs = await findAdminNotifications("Đơn hàng Portal mới");
      const beforeCount = beforeNotifs.filter((n) =>
        n.message?.includes(orderCode)
      ).length;

      const { data, error } = await adminClient
        .from("orders")
        .insert({
          code: orderCode,
          customer_id: realCustomerB2bId,
          source: "erp",
          status: "PENDING",
          total_amount: 100000,
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      createdOrderIds.push(data!.id);

      // Wait briefly for trigger (should NOT fire)
      await new Promise((r) => setTimeout(r, 500));

      const afterNotifs = await findAdminNotifications("Đơn hàng Portal mới");
      const afterCount = afterNotifs.filter((n) =>
        n.message?.includes(orderCode)
      ).length;

      // No new notification for this order code
      expect(afterCount).toBe(beforeCount);
    });

    it("does NOT create notification for order without source (defaults to erp)", async () => {
      const orderCode = `${TEST_PREFIX}NO-SRC-001`;

      const beforeNotifs = await findAdminNotifications("Đơn hàng Portal mới");
      const beforeCount = beforeNotifs.filter((n) =>
        n.message?.includes(orderCode)
      ).length;

      const { data, error } = await adminClient
        .from("orders")
        .insert({
          code: orderCode,
          customer_id: realCustomerB2bId,
          status: "PENDING",
          total_amount: 100000,
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      createdOrderIds.push(data!.id);

      await new Promise((r) => setTimeout(r, 500));

      const afterNotifs = await findAdminNotifications("Đơn hàng Portal mới");
      const afterCount = afterNotifs.filter((n) =>
        n.message?.includes(orderCode)
      ).length;

      expect(afterCount).toBe(beforeCount);
    });
  });

  // ─── C. Payment trigger ───────────────────────────────────────────────────

  describe("C. Payment trigger (fn_notify_admin_payment_received)", () => {
    it("creates admin notification for completed incoming payment", async () => {
      if (!realFundAccountId) return;

      const txCode = `${TEST_PREFIX}TX-IN-001`;

      const { data, error } = await adminClient
        .from("finance_transactions")
        .insert({
          code: txCode,
          flow: "in",
          status: "completed",
          amount: 1500000,
          fund_account_id: realFundAccountId,
          partner_name_cache: `${TEST_PREFIX}Partner A`,
          ref_id: "REF-123",
          description: "Thanh toan don hang test",
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      createdTransactionIds.push(data!.id);

      // Wait briefly for trigger
      await new Promise((r) => setTimeout(r, 500));

      const notifications = await findAdminNotifications("Thanh toán mới:");
      const matched = notifications.filter((n) =>
        n.message?.includes(TEST_PREFIX)
      );

      if (adminUserId) {
        expect(matched.length).toBeGreaterThanOrEqual(1);
        const notif = matched[0];
        expect(notif.title).toContain("Thanh toán mới:");
        expect(notif.title).toContain("đ");
        expect(notif.type).toBe("success");
        expect(notif.message).toContain(`${TEST_PREFIX}Partner A`);
      }
    });

    it("does NOT create notification for outgoing payment (flow=out)", async () => {
      if (!realFundAccountId) return;

      const txCode = `${TEST_PREFIX}TX-OUT-001`;

      const beforeNotifs = await findAdminNotifications("Thanh toán mới:");
      const beforeCount = beforeNotifs.filter((n) =>
        n.message?.includes(txCode)
      ).length;

      const { data, error } = await adminClient
        .from("finance_transactions")
        .insert({
          code: txCode,
          flow: "out",
          status: "completed",
          amount: 200000,
          fund_account_id: realFundAccountId,
          partner_name_cache: `${TEST_PREFIX}Outgoing Partner`,
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      createdTransactionIds.push(data!.id);

      await new Promise((r) => setTimeout(r, 500));

      const afterNotifs = await findAdminNotifications("Thanh toán mới:");
      const afterCount = afterNotifs.filter((n) =>
        n.message?.includes(txCode)
      ).length;

      expect(afterCount).toBe(beforeCount);
    });

    it("does NOT create notification for pending incoming payment (status=pending)", async () => {
      if (!realFundAccountId) return;

      const txCode = `${TEST_PREFIX}TX-PEND-001`;

      const beforeNotifs = await findAdminNotifications("Thanh toán mới:");
      const beforeCount = beforeNotifs.filter((n) =>
        n.message?.includes(txCode)
      ).length;

      const { data, error } = await adminClient
        .from("finance_transactions")
        .insert({
          code: txCode,
          flow: "in",
          status: "pending",
          amount: 300000,
          fund_account_id: realFundAccountId,
          partner_name_cache: `${TEST_PREFIX}Pending Partner`,
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      createdTransactionIds.push(data!.id);

      await new Promise((r) => setTimeout(r, 500));

      const afterNotifs = await findAdminNotifications("Thanh toán mới:");
      const afterCount = afterNotifs.filter((n) =>
        n.message?.includes(txCode)
      ).length;

      expect(afterCount).toBe(beforeCount);
    });
  });
});
