import { describe as _describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient, isProduction } from "../helpers/supabase";

// Skip mutation tests on production to avoid side effects
const describe = isProduction ? _describe.skip : _describe;

// ─── Test constants ─────────────────────────────────────────────────────────
const TEST_PREFIX = "__test_order_notif__";

let realCustomerId: number | null = null;
let testOrderId: string | null = null;
let testOrderCode: string | null = null;

/** Track notification IDs for cleanup */
let notificationIdsToClean: string[] = [];

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getNotificationsForOrder(
  orderId: string,
  customerId: number
): Promise<
  Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    data: { order_id: string; new_status: string; old_status: string };
  }>
> {
  const { data, error } = await adminClient
    .from("b2b_notifications")
    .select("id, type, title, body, data")
    .eq("customer_b2b_id", customerId)
    .eq("type", "order_status")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Query failed: ${error.message}`);

  // Filter to only notifications for our test order
  return (data || []).filter(
    (n) => n.data && (n.data as Record<string, unknown>).order_id === orderId
  ) as Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    data: { order_id: string; new_status: string; old_status: string };
  }>;
}

async function updateOrderStatus(
  orderId: string,
  newStatus: string
): Promise<void> {
  const { error } = await adminClient
    .from("orders")
    .update({ status: newStatus })
    .eq("id", orderId);

  if (error)
    throw new Error(`Update order status failed: ${error.message}`);
}

// ─── Setup / Teardown ───────────────────────────────────────────────────────

beforeAll(async () => {
  // Find a real B2B customer
  const { data: customer } = await adminClient
    .from("customers_b2b")
    .select("id")
    .limit(1)
    .single();

  if (!customer) {
    console.warn("No customers_b2b found — tests will be skipped");
    return;
  }
  realCustomerId = customer.id;

  // Create a test order in PENDING status
  testOrderCode = `${TEST_PREFIX}${Date.now()}`;
  const { data: order, error } = await adminClient
    .from("orders")
    .insert({
      code: testOrderCode,
      customer_id: realCustomerId,
      status: "PENDING",
      total_amount: 100000,
      final_amount: 100000,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Create test order failed: ${error.message}`);
  testOrderId = order.id;
});

afterAll(async () => {
  // Clean up notifications created by triggers
  if (testOrderId && realCustomerId) {
    const { data: notifs } = await adminClient
      .from("b2b_notifications")
      .select("id")
      .eq("customer_b2b_id", realCustomerId)
      .eq("type", "order_status");

    if (notifs) {
      const triggerNotifIds = notifs
        .map((n) => n.id)
        .filter((id) => !notificationIdsToClean.includes(id));
      notificationIdsToClean.push(...triggerNotifIds);
    }
  }

  // Clean up notifications
  if (notificationIdsToClean.length > 0) {
    await adminClient
      .from("b2b_notifications")
      .delete()
      .in("id", notificationIdsToClean);
  }

  // Clean up test order
  if (testOrderId) {
    await adminClient.from("orders").delete().eq("id", testOrderId);
  }
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("B2B Order Notification Trigger", () => {
  it("PENDING → CONFIRMED creates order_status notification", async () => {
    if (!testOrderId || !realCustomerId) return;

    await updateOrderStatus(testOrderId, "CONFIRMED");

    const notifs = await getNotificationsForOrder(
      testOrderId,
      realCustomerId
    );
    notificationIdsToClean.push(...notifs.map((n) => n.id));

    const confirmed = notifs.find(
      (n) => n.data.new_status === "CONFIRMED"
    );
    expect(confirmed).toBeDefined();
    expect(confirmed!.type).toBe("order_status");
    expect(confirmed!.data.old_status).toBe("PENDING");
    expect(confirmed!.data.new_status).toBe("CONFIRMED");
    expect(confirmed!.data.order_id).toBe(testOrderId);
    expect(confirmed!.title).toContain("Đã xác nhận");
  });

  it("CONFIRMED → SHIPPING creates order_status notification", async () => {
    if (!testOrderId || !realCustomerId) return;

    await updateOrderStatus(testOrderId, "SHIPPING");

    const notifs = await getNotificationsForOrder(
      testOrderId,
      realCustomerId
    );
    notificationIdsToClean.push(...notifs.map((n) => n.id));

    const shipping = notifs.find(
      (n) => n.data.new_status === "SHIPPING"
    );
    expect(shipping).toBeDefined();
    expect(shipping!.type).toBe("order_status");
    expect(shipping!.data.old_status).toBe("CONFIRMED");
    expect(shipping!.data.new_status).toBe("SHIPPING");
    expect(shipping!.title).toContain("Đang giao hàng");
  });

  it("SHIPPING → DELIVERED creates order_status notification", async () => {
    if (!testOrderId || !realCustomerId) return;

    await updateOrderStatus(testOrderId, "DELIVERED");

    const notifs = await getNotificationsForOrder(
      testOrderId,
      realCustomerId
    );
    notificationIdsToClean.push(...notifs.map((n) => n.id));

    const delivered = notifs.find(
      (n) => n.data.new_status === "DELIVERED"
    );
    expect(delivered).toBeDefined();
    expect(delivered!.type).toBe("order_status");
    expect(delivered!.data.old_status).toBe("SHIPPING");
    expect(delivered!.data.new_status).toBe("DELIVERED");
    expect(delivered!.title).toContain("Đã giao hàng");
  });

  it("all trigger notifications have correct structure", async () => {
    if (!testOrderId || !realCustomerId) return;

    const notifs = await getNotificationsForOrder(
      testOrderId,
      realCustomerId
    );

    // We should have at least 3 notifications (CONFIRMED, SHIPPING, DELIVERED)
    expect(notifs.length).toBeGreaterThanOrEqual(3);

    for (const notif of notifs) {
      expect(notif.type).toBe("order_status");
      expect(notif.title).toBeTruthy();
      expect(notif.body).toBeTruthy();
      expect(notif.data).toHaveProperty("order_id");
      expect(notif.data).toHaveProperty("order_code");
      expect(notif.data).toHaveProperty("old_status");
      expect(notif.data).toHaveProperty("new_status");
      expect(notif.data.order_id).toBe(testOrderId);
    }
  });

  it("same status update does NOT create duplicate notification", async () => {
    if (!testOrderId || !realCustomerId) return;

    // Get current count
    const before = await getNotificationsForOrder(
      testOrderId,
      realCustomerId
    );
    const countBefore = before.length;

    // Update to same status (DELIVERED → DELIVERED)
    await updateOrderStatus(testOrderId, "DELIVERED");

    const after = await getNotificationsForOrder(
      testOrderId,
      realCustomerId
    );
    notificationIdsToClean.push(...after.map((n) => n.id));

    // Count should not increase — trigger checks OLD.status IS NOT DISTINCT FROM NEW.status
    expect(after.length).toBe(countBefore);
  });
});
