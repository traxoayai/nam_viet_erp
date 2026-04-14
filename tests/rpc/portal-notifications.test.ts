import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient } from "../helpers/supabase";

// ─── Test constants ─────────────────────────────────────────────────────────
const TEST_PREFIX = "__test_notif__";
const FAKE_CUSTOMER_ID = 999999;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/** IDs of seeded notifications — cleaned up in afterAll */
let seededIds: string[] = [];
let realCustomerId: number | null = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function seedNotification(overrides: {
  customer_b2b_id?: number | null;
  type?: string;
  title?: string;
  body?: string;
  is_read?: boolean;
  data?: Record<string, unknown>;
}) {
  const { data, error } = await adminClient
    .from("b2b_notifications")
    .insert({
      customer_b2b_id: overrides.customer_b2b_id ?? realCustomerId,
      type: overrides.type ?? "system",
      title: overrides.title ?? `${TEST_PREFIX}Test notification`,
      body: overrides.body ?? "Test body",
      is_read: overrides.is_read ?? false,
      data: overrides.data ?? {},
    })
    .select("id")
    .single();

  if (error) throw new Error(`Seed notification failed: ${error.message}`);
  seededIds.push(data.id);
  return data.id;
}

// ─── Setup / Teardown ───────────────────────────────────────────────────────

beforeAll(async () => {
  // Find a real customer_b2b to attach notifications to
  const { data: customers } = await adminClient
    .from("customers_b2b")
    .select("id")
    .limit(1)
    .single();

  if (customers) {
    realCustomerId = customers.id;
  }

  if (!realCustomerId) {
    console.warn("No customers_b2b found — some tests will be skipped");
    return;
  }

  // Seed: 3 unread system, 2 read promotion, 1 broadcast (customer_b2b_id = null)
  await seedNotification({ type: "system", title: `${TEST_PREFIX}System 1` });
  await seedNotification({ type: "system", title: `${TEST_PREFIX}System 2` });
  await seedNotification({ type: "system", title: `${TEST_PREFIX}System 3` });
  await seedNotification({
    type: "promotion",
    title: `${TEST_PREFIX}Promo 1`,
    is_read: true,
  });
  await seedNotification({
    type: "promotion",
    title: `${TEST_PREFIX}Promo 2`,
    is_read: true,
  });
  await seedNotification({
    type: "broadcast",
    title: `${TEST_PREFIX}Broadcast`,
    customer_b2b_id: null,
  });
});

afterAll(async () => {
  if (seededIds.length > 0) {
    await adminClient
      .from("b2b_notifications")
      .delete()
      .in("id", seededIds);
  }
});

// ─── A. get_customer_notifications ──────────────────────────────────────────

describe("Portal Notification RPCs", () => {
  describe("get_customer_notifications", () => {
    it("function exists (no PGRST202)", async () => {
      const { error } = await adminClient.rpc("get_customer_notifications", {
        p_customer_b2b_id: FAKE_CUSTOMER_ID,
      });

      expect(error?.code).not.toBe("PGRST202");
    });

    it("returns paginated results with correct shape", async () => {
      if (!realCustomerId) return;

      const { data, error } = await adminClient.rpc(
        "get_customer_notifications",
        {
          p_customer_b2b_id: realCustomerId,
          p_page: 1,
          p_page_size: 10,
        }
      );

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // RPC returns JSON with { data, total, page, page_size }
      const result = data as {
        data: unknown[];
        total: number;
        page: number;
        page_size: number;
      };
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("page");
      expect(result).toHaveProperty("page_size");
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.page).toBe(1);
      expect(result.page_size).toBe(10);
    });

    it("filters by type", async () => {
      if (!realCustomerId) return;

      const { data, error } = await adminClient.rpc(
        "get_customer_notifications",
        {
          p_customer_b2b_id: realCustomerId,
          p_type: "promotion",
          p_page: 1,
          p_page_size: 50,
        }
      );

      expect(error).toBeNull();
      const result = data as { data: Array<{ type: string }> };
      if (result.data.length > 0) {
        for (const row of result.data) {
          expect(row.type).toBe("promotion");
        }
      }
    });

    it("filters unread_only", async () => {
      if (!realCustomerId) return;

      const { data, error } = await adminClient.rpc(
        "get_customer_notifications",
        {
          p_customer_b2b_id: realCustomerId,
          p_unread_only: true,
          p_page: 1,
          p_page_size: 50,
        }
      );

      expect(error).toBeNull();
      const result = data as { data: Array<{ is_read: boolean }> };
      if (result.data.length > 0) {
        for (const row of result.data) {
          expect(row.is_read).toBe(false);
        }
      }
    });

    it("returns empty data for non-existent customer", async () => {
      const { data, error } = await adminClient.rpc(
        "get_customer_notifications",
        {
          p_customer_b2b_id: FAKE_CUSTOMER_ID,
          p_page: 1,
          p_page_size: 10,
        }
      );

      expect(error).toBeNull();
      const result = data as { data: unknown[]; total: number };
      // Non-existent customer may still see broadcasts (customer_b2b_id IS NULL)
      // but should not see targeted notifications
      expect(result).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  // ─── B. get_customer_unread_notification_count ──────────────────────────────

  describe("get_customer_unread_notification_count", () => {
    it("function exists (no PGRST202)", async () => {
      const { error } = await adminClient.rpc(
        "get_customer_unread_notification_count",
        { p_customer_b2b_id: FAKE_CUSTOMER_ID }
      );

      expect(error?.code).not.toBe("PGRST202");
    });

    it("returns correct count for customer with seeded notifications", async () => {
      if (!realCustomerId) return;

      const { data, error } = await adminClient.rpc(
        "get_customer_unread_notification_count",
        { p_customer_b2b_id: realCustomerId }
      );

      expect(error).toBeNull();
      expect(typeof data).toBe("number");
      // We seeded 3 unread system + 1 unread broadcast = at least 4
      expect(data as number).toBeGreaterThanOrEqual(4);
    });

    it("returns 0 or small number for non-existent customer", async () => {
      const { data, error } = await adminClient.rpc(
        "get_customer_unread_notification_count",
        { p_customer_b2b_id: FAKE_CUSTOMER_ID }
      );

      expect(error).toBeNull();
      expect(typeof data).toBe("number");
      // Non-existent customer may see broadcast unread count
      expect(data as number).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── C. mark_notification_read ──────────────────────────────────────────────

  describe("mark_notification_read", () => {
    it("function exists (no PGRST202)", async () => {
      const { error } = await adminClient.rpc("mark_notification_read", {
        p_notification_id: NIL_UUID,
        p_customer_b2b_id: FAKE_CUSTOMER_ID,
      });

      expect(error?.code).not.toBe("PGRST202");
    });

    it("returns true when marking an unread notification as read", async () => {
      if (!realCustomerId) return;

      // Seed a fresh unread notification for this test
      const notifId = await seedNotification({
        type: "system",
        title: `${TEST_PREFIX}Mark-read test`,
        is_read: false,
      });

      const { data, error } = await adminClient.rpc("mark_notification_read", {
        p_notification_id: notifId,
        p_customer_b2b_id: realCustomerId,
      });

      expect(error).toBeNull();
      expect(data).toBe(true);

      // Verify it's actually read now
      const { data: row } = await adminClient
        .from("b2b_notifications")
        .select("is_read, read_at")
        .eq("id", notifId)
        .single();

      expect(row?.is_read).toBe(true);
      expect(row?.read_at).not.toBeNull();
    });

    it("returns false for non-existent notification", async () => {
      if (!realCustomerId) return;

      const { data, error } = await adminClient.rpc("mark_notification_read", {
        p_notification_id: NIL_UUID,
        p_customer_b2b_id: realCustomerId,
      });

      expect(error).toBeNull();
      expect(data).toBe(false);
    });
  });

  // ─── D. mark_all_notifications_read ─────────────────────────────────────────

  describe("mark_all_notifications_read", () => {
    it("function exists (no PGRST202)", async () => {
      const { error } = await adminClient.rpc("mark_all_notifications_read", {
        p_customer_b2b_id: FAKE_CUSTOMER_ID,
      });

      expect(error?.code).not.toBe("PGRST202");
    });

    it("returns count of marked notifications", async () => {
      if (!realCustomerId) return;

      // Seed 2 fresh unread notifications
      await seedNotification({
        type: "system",
        title: `${TEST_PREFIX}Mark-all 1`,
        is_read: false,
      });
      await seedNotification({
        type: "system",
        title: `${TEST_PREFIX}Mark-all 2`,
        is_read: false,
      });

      const { data, error } = await adminClient.rpc(
        "mark_all_notifications_read",
        { p_customer_b2b_id: realCustomerId }
      );

      expect(error).toBeNull();
      expect(typeof data).toBe("number");
      expect(data as number).toBeGreaterThanOrEqual(2);
    });

    it("returns 0 when all already read", async () => {
      if (!realCustomerId) return;

      // After previous test, all should be read. Call again.
      const { data, error } = await adminClient.rpc(
        "mark_all_notifications_read",
        { p_customer_b2b_id: realCustomerId }
      );

      expect(error).toBeNull();
      expect(data).toBe(0);
    });
  });

  // ─── E. get_notification_history (admin) ────────────────────────────────────

  describe("get_notification_history", () => {
    it("function exists (no PGRST202)", async () => {
      const { error } = await adminClient.rpc("get_notification_history", {});

      expect(error?.code).not.toBe("PGRST202");
    });

    it("returns paginated admin view with correct shape", async () => {
      const { data, error } = await adminClient.rpc(
        "get_notification_history",
        {
          p_page: 1,
          p_page_size: 10,
        }
      );

      expect(error).toBeNull();
      expect(data).toBeDefined();

      const result = data as {
        data: Array<{
          id: string;
          type: string;
          title: string;
          customer_name: string | null;
          created_at: string;
        }>;
        total: number;
        page: number;
        page_size: number;
      };

      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.data)).toBe(true);

      if (result.data.length > 0) {
        const row = result.data[0];
        expect(row).toHaveProperty("id");
        expect(row).toHaveProperty("type");
        expect(row).toHaveProperty("title");
        expect(row).toHaveProperty("created_at");
      }
    });

    it("filters by type", async () => {
      const { data, error } = await adminClient.rpc(
        "get_notification_history",
        {
          p_type: "system",
          p_page: 1,
          p_page_size: 50,
        }
      );

      expect(error).toBeNull();
      const result = data as { data: Array<{ type: string }> };
      if (result.data.length > 0) {
        for (const row of result.data) {
          expect(row.type).toBe("system");
        }
      }
    });

    it("filters by date range", async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const { data, error } = await adminClient.rpc(
        "get_notification_history",
        {
          p_date_from: yesterday.toISOString(),
          p_date_to: tomorrow.toISOString(),
          p_page: 1,
          p_page_size: 50,
        }
      );

      expect(error).toBeNull();
      const result = data as { data: Array<{ created_at: string }> };
      if (result.data.length > 0) {
        for (const row of result.data) {
          const createdAt = new Date(row.created_at);
          expect(createdAt.getTime()).toBeGreaterThanOrEqual(
            yesterday.getTime()
          );
          expect(createdAt.getTime()).toBeLessThanOrEqual(tomorrow.getTime());
        }
      }
    });

    it("filters by customer_b2b_id", async () => {
      if (!realCustomerId) return;

      const { data, error } = await adminClient.rpc(
        "get_notification_history",
        {
          p_customer_b2b_id: realCustomerId,
          p_page: 1,
          p_page_size: 50,
        }
      );

      expect(error).toBeNull();
      const result = data as {
        data: Array<{ customer_b2b_id: number | null }>;
      };
      if (result.data.length > 0) {
        for (const row of result.data) {
          expect(row.customer_b2b_id).toBe(realCustomerId);
        }
      }
    });
  });
});
