import { describe, it, expect } from "vitest";
import { adminClient } from "../helpers/supabase";

const FAKE_UUID = "00000000-0000-0000-0000-000000000000";

describe("Portal Users Management", () => {
  // ─── A. get_portal_users_list ───────────────────────────────────────────────
  describe("get_portal_users_list", () => {
    it("function exists (no PGRST202)", async () => {
      const { error } = await adminClient.rpc("get_portal_users_list", {
        p_search: null,
        p_status: null,
      });

      expect(error?.code).not.toBe("PGRST202");
    });

    it("returns array with correct shape", async () => {
      const { data, error } = await adminClient.rpc("get_portal_users_list", {
        p_search: null,
        p_status: null,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);

      if (Array.isArray(data) && data.length > 0) {
        const row = data[0];
        expect(row).toHaveProperty("id");
        expect(row).toHaveProperty("auth_user_id");
        expect(row).toHaveProperty("customer_b2b_id");
        expect(row).toHaveProperty("display_name");
        expect(row).toHaveProperty("email");
        expect(row).toHaveProperty("phone");
        expect(row).toHaveProperty("role");
        expect(row).toHaveProperty("status");
        expect(row).toHaveProperty("last_login_at");
        expect(row).toHaveProperty("created_at");
        expect(row).toHaveProperty("customer_name");
        expect(row).toHaveProperty("customer_code");
      }
    });

    it("accepts p_search filter — returns empty for nonexistent term", async () => {
      const { data, error } = await adminClient.rpc("get_portal_users_list", {
        p_search: "nonexistent_xyzzy",
        p_status: null,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });

    it("accepts p_status filter", async () => {
      const { data, error } = await adminClient.rpc("get_portal_users_list", {
        p_search: null,
        p_status: "active",
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it("returns data when no filters", async () => {
      const { data, error } = await adminClient.rpc("get_portal_users_list", {
        p_search: null,
        p_status: null,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  // ─── B. create_portal_user_from_erp ─────────────────────────────────────────
  describe("create_portal_user_from_erp", () => {
    it("function exists (no PGRST202)", async () => {
      const { error } = await adminClient.rpc("create_portal_user_from_erp", {
        p_customer_b2b_id: 999999,
        p_auth_user_id: FAKE_UUID,
        p_email: "test@nonexistent.local",
        p_display_name: "Test User",
        p_phone: "0000000000",
        p_role: "buyer",
      });

      expect(error?.code).not.toBe("PGRST202");
    });

    it("rejects invalid customer_b2b_id", async () => {
      const { error } = await adminClient.rpc("create_portal_user_from_erp", {
        p_customer_b2b_id: 999999,
        p_auth_user_id: FAKE_UUID,
        p_email: "test@nonexistent.local",
        p_display_name: "Test User",
        p_phone: "0000000000",
        p_role: "buyer",
      });

      expect(error).not.toBeNull();
      expect(error?.code).toBe("P0001");
    });

    it("rejects duplicate auth_user_id", async () => {
      // First, check if any portal_users exist to get an auth_user_id
      const { data: existingUsers } = await adminClient
        .from("portal_users")
        .select("auth_user_id, customer_b2b_id")
        .limit(1);

      if (existingUsers && existingUsers.length > 0) {
        const existing = existingUsers[0];
        const { error } = await adminClient.rpc("create_portal_user_from_erp", {
          p_customer_b2b_id: existing.customer_b2b_id,
          p_auth_user_id: existing.auth_user_id,
          p_email: "duplicate@test.local",
          p_display_name: "Duplicate User",
          p_phone: "0000000000",
          p_role: "buyer",
        });

        expect(error).not.toBeNull();
        // Could be P0001 (RAISE EXCEPTION) or 23505 (unique_violation)
        expect(["P0001", "23505"]).toContain(error?.code);
      }
    });
  });

  // ─── C. toggle_portal_user_status ───────────────────────────────────────────
  describe("toggle_portal_user_status", () => {
    it("function exists (no PGRST202)", async () => {
      const { error } = await adminClient.rpc("toggle_portal_user_status", {
        p_portal_user_id: FAKE_UUID,
        p_new_status: "active",
      });

      expect(error?.code).not.toBe("PGRST202");
    });

    it("rejects invalid status value", async () => {
      const { error } = await adminClient.rpc("toggle_portal_user_status", {
        p_portal_user_id: FAKE_UUID,
        p_new_status: "deleted",
      });

      expect(error).not.toBeNull();
      expect(error?.code).toBe("P0001");
    });

    it("rejects non-existent portal_user_id", async () => {
      const { error } = await adminClient.rpc("toggle_portal_user_status", {
        p_portal_user_id: FAKE_UUID,
        p_new_status: "active",
      });

      expect(error).not.toBeNull();
      expect(error?.code).toBe("P0001");
    });
  });

  // ─── D. registration_requests.auth_user_id column ───────────────────────────
  describe("registration_requests.auth_user_id column", () => {
    it("column exists", async () => {
      const { data, error } = await adminClient
        .from("registration_requests")
        .select("auth_user_id")
        .limit(1);

      expect(error).toBeNull();
    });
  });
});
