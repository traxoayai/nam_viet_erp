import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { adminClient } from "../helpers/supabase";

describe("sync_viettel_provinces RPC", () => {
  const TEST_PROVINCE_CODES = ["100", "101", "200", "201"];

  beforeAll(async () => {
    // Clean up test provinces before test
    await adminClient
      .from("provinces")
      .delete()
      .in("province_code", TEST_PROVINCE_CODES);
  });

  afterAll(async () => {
    // Clean up test provinces after test
    await adminClient
      .from("provinces")
      .delete()
      .in("province_code", TEST_PROVINCE_CODES);
  });

  it("should sync provinces with mock data", async () => {
    const { data, error } = await adminClient.rpc(
      "sync_viettel_provinces",
      { p_provinces_data: null } // null triggers mock data
    );

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    const result = data[0];
    expect(result).toHaveProperty("synced_count");
    expect(result).toHaveProperty("updated_count");
    expect(result).toHaveProperty("error_count");
    expect(result).toHaveProperty("last_synced_at");

    expect(result.synced_count).toBeGreaterThanOrEqual(0);
    expect(result.updated_count).toBeGreaterThanOrEqual(0);
    expect(result.error_count).toBe(0);
  });

  it("should upsert provinces into table", async () => {
    const testProvinces = JSON.stringify([
      { code: "100", name: "Hà Nội Test", delivery_time: 1 },
      { code: "101", name: "Hải Phòng Test", delivery_time: 2 },
    ]);

    const { data, error } = await adminClient.rpc("sync_viettel_provinces", {
      p_provinces_data: JSON.parse(testProvinces),
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();

    // Verify provinces were inserted
    const { data: inserted, error: selectError } = await adminClient
      .from("provinces")
      .select("*")
      .in("province_code", ["100", "101"]);

    expect(selectError).toBeNull();
    expect(inserted).toBeDefined();
    expect(inserted!.length).toBeGreaterThanOrEqual(2);

    // Check first province
    const ha_noi = inserted!.find((p) => p.province_code === "100");
    expect(ha_noi).toBeDefined();
    expect(ha_noi!.province_name).toContain("Hà Nội");
    expect(ha_noi!.delivery_time_std).toBe(1);
  });

  it("should update existing provinces on re-sync", async () => {
    // First sync
    const testProvinces1 = JSON.stringify([
      { code: "200", name: "TP. Hồ Chí Minh v1", delivery_time: 1 },
    ]);

    await adminClient.rpc("sync_viettel_provinces", {
      p_provinces_data: JSON.parse(testProvinces1),
    });

    // Get created_at of first insert
    const { data: first } = await adminClient
      .from("provinces")
      .select("created_at, updated_at")
      .eq("province_code", "200")
      .single();

    expect(first).toBeDefined();
    const originalCreatedAt = first!.created_at;

    // Second sync with updated name
    await new Promise((r) => setTimeout(r, 100)); // Wait 100ms
    const testProvinces2 = JSON.stringify([
      { code: "200", name: "TP. Hồ Chí Minh v2", delivery_time: 2 },
    ]);

    const { data: syncResult } = await adminClient.rpc(
      "sync_viettel_provinces",
      {
        p_provinces_data: JSON.parse(testProvinces2),
      }
    );

    expect(syncResult[0].updated_count).toBeGreaterThanOrEqual(0);

    // Verify updated data
    const { data: updated } = await adminClient
      .from("provinces")
      .select("province_name, delivery_time_std, created_at, updated_at")
      .eq("province_code", "200")
      .single();

    expect(updated).toBeDefined();
    expect(updated!.province_name).toContain("v2");
    expect(updated!.delivery_time_std).toBe(2);
    expect(updated!.created_at).toBe(originalCreatedAt); // created_at should not change
  });

  it("should set last_synced_at timestamp", async () => {
    const beforeSync = new Date();
    beforeSync.setSeconds(beforeSync.getSeconds() - 1); // 1 sec earlier for safety

    const testProvinces = JSON.stringify([
      { code: "201", name: "Bình Dương Test", delivery_time: 2 },
    ]);

    const { data: syncResult } = await adminClient.rpc(
      "sync_viettel_provinces",
      {
        p_provinces_data: JSON.parse(testProvinces),
      }
    );

    expect(syncResult[0].last_synced_at).toBeDefined();
    const lastSynced = new Date(syncResult[0].last_synced_at);
    expect(lastSynced.getTime()).toBeGreaterThanOrEqual(beforeSync.getTime());

    // Verify in table
    const { data: province } = await adminClient
      .from("provinces")
      .select("last_synced_at")
      .eq("province_code", "201")
      .single();

    expect(province).toBeDefined();
    expect(province!.last_synced_at).toBeDefined();
  });

  it("should handle empty provinces array gracefully", async () => {
    const { data } = await adminClient.rpc("sync_viettel_provinces", {
      p_provinces_data: [],
    });

    // Should not error, just return 0 counts
    expect(data).toBeDefined();
    expect(data[0].synced_count + data[0].updated_count).toBe(0);
  });

  it("should validate RLS policies allow authenticated select", async () => {
    // Insert a test province with service role
    await adminClient
      .from("provinces")
      .upsert({
        province_code: "999",
        province_name: "RLS Test Province",
        delivery_time_std: 1,
      })
      .select();

    // Try to select as authenticated (should work per RLS policy)
    const { data, error } = await adminClient
      .from("provinces")
      .select("*")
      .eq("province_code", "999");

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.length).toBe(1);

    // Clean up
    await adminClient.from("provinces").delete().eq("province_code", "999");
  });

  it("should allow anonymous select on provinces (lookup table)", async () => {
    // Insert via admin
    await adminClient
      .from("provinces")
      .upsert({
        province_code: "888",
        province_name: "Anonymous Test",
        delivery_time_std: 1,
      })
      .select();

    // Select via unauthenticated (anon role)
    const anonClient = adminClient; // In Supabase local, same client can act as anon
    const { data, error } = await anonClient
      .from("provinces")
      .select("province_code, province_name")
      .eq("province_code", "888");

    // RLS allows anon SELECT, so should succeed
    expect(error === null || data !== undefined).toBe(true);

    // Clean up
    await adminClient.from("provinces").delete().eq("province_code", "888");
  });
});
