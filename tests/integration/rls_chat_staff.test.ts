// Integration test: RLS chat tables + helper public.is_chat_staff()
// Verify 3 case:
//  1. Staff (có permission crm.chatbot.handle) thấy được session handoff_pending của user khác
//  2. Customer chỉ thấy session của chính mình (không thấy session user khác)
//  3. Anon (chưa đăng nhập) không thấy được session nào
//
// Yêu cầu: local Supabase chạy ở 127.0.0.1:54321 với migration mới nhất.

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe as _describe, expect, it } from "vitest";

import {
  adminClient,
  createUserClient,
  findUserIdByEmail,
  isProduction,
} from "../helpers/supabase";

// Không seed user/role trên production
const describe = isProduction ? _describe.skip : _describe;

const STAFF_EMAIL = "admin@test.com";
const STAFF_PASSWORD = "Admin@938!";
const CUSTOMER_EMAIL = "kame.ctb@gmail.com";
const CUSTOMER_PASSWORD = "Test@123!";

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

interface SeedRefs {
  staffUserId: string;
  customerUserId: string;
  roleId: string;
  warehouseId: number;
  userRoleId: number | null;
  customerSessionId: string;
  staffViewableSessionId: string;
}

const seed: Partial<SeedRefs> = {};
let staffClient: SupabaseClient;
let customerClient: SupabaseClient;
let anonClient: SupabaseClient;

describe("RLS chat_sessions + is_chat_staff()", () => {
  beforeAll(async () => {
    // 1. Lấy id của 2 user fixture qua helper
    const staffId = await findUserIdByEmail(STAFF_EMAIL);
    const customerId = await findUserIdByEmail(CUSTOMER_EMAIL);
    if (!staffId)
      throw new Error(`Staff fixture user ${STAFF_EMAIL} not found`);
    if (!customerId)
      throw new Error(`Customer fixture user ${CUSTOMER_EMAIL} not found`);
    seed.staffUserId = staffId;
    seed.customerUserId = customerId;

    // 2. Tạo role test có permission crm.chatbot.handle
    const roleName = `__test_chatbot_staff_${Date.now()}`;
    const { data: roleRow, error: roleErr } = await adminClient
      .from("roles")
      .insert({ name: roleName, description: "test chatbot staff" })
      .select("id")
      .single();
    if (roleErr || !roleRow) throw roleErr || new Error("seed role failed");
    seed.roleId = roleRow.id;

    const { error: rpErr } = await adminClient.from("role_permissions").insert({
      role_id: seed.roleId,
      permission_key: "crm.chatbot.handle",
    });
    if (rpErr) throw rpErr;

    // 3. Lấy 1 warehouse (branch_id required cho user_roles)
    const { data: wh, error: whErr } = await adminClient
      .from("warehouses")
      .select("id")
      .order("id")
      .limit(1)
      .single();
    if (whErr || !wh) throw whErr || new Error("no warehouse");
    seed.warehouseId = wh.id;

    // 4. Gán role test cho staff user (idempotent)
    const { data: existingUR } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", seed.staffUserId)
      .eq("role_id", seed.roleId)
      .eq("branch_id", seed.warehouseId)
      .maybeSingle();
    if (existingUR?.id) {
      seed.userRoleId = existingUR.id;
    } else {
      const { data: urRow, error: urErr } = await adminClient
        .from("user_roles")
        .insert({
          user_id: seed.staffUserId,
          role_id: seed.roleId,
          branch_id: seed.warehouseId,
        })
        .select("id")
        .single();
      if (urErr || !urRow) throw urErr || new Error("seed user_roles failed");
      seed.userRoleId = urRow.id;
    }

    // 5. Auth clients
    staffClient = await createUserClient(STAFF_EMAIL, STAFF_PASSWORD);
    customerClient = await createUserClient(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    anonClient = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 6. Seed 2 chat session:
    //  - customerSession: status='bot', của customer (staff KHÔNG thấy được vì status='bot')
    //  - staffViewableSession: status='handoff_pending', của customer (staff thấy được)
    const { data: s1, error: s1Err } = await adminClient
      .from("chat_sessions")
      .insert({
        user_id: seed.customerUserId,
        status: "bot",
        platform: "web",
      })
      .select("id")
      .single();
    if (s1Err || !s1) throw s1Err || new Error("seed customer session failed");
    seed.customerSessionId = s1.id;

    const { data: s2, error: s2Err } = await adminClient
      .from("chat_sessions")
      .insert({
        user_id: seed.customerUserId,
        status: "handoff_pending",
        platform: "web",
      })
      .select("id")
      .single();
    if (s2Err || !s2) throw s2Err || new Error("seed handoff session failed");
    seed.staffViewableSessionId = s2.id;
  });

  afterAll(async () => {
    if (seed.customerSessionId)
      await adminClient
        .from("chat_sessions")
        .delete()
        .eq("id", seed.customerSessionId);
    if (seed.staffViewableSessionId)
      await adminClient
        .from("chat_sessions")
        .delete()
        .eq("id", seed.staffViewableSessionId);
    if (seed.userRoleId)
      await adminClient.from("user_roles").delete().eq("id", seed.userRoleId);
    if (seed.roleId) {
      await adminClient
        .from("role_permissions")
        .delete()
        .eq("role_id", seed.roleId);
      await adminClient.from("roles").delete().eq("id", seed.roleId);
    }
  });

  it("is_chat_staff() = true cho staff user có permission crm.chatbot.handle", async () => {
    const { data, error } = await staffClient.rpc("is_chat_staff");
    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it("is_chat_staff() = false cho customer user không có permission", async () => {
    const { data, error } = await customerClient.rpc("is_chat_staff");
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it("Staff thấy được session handoff_pending của user khác (chat_sessions_internal policy)", async () => {
    const { data, error } = await staffClient
      .from("chat_sessions")
      .select("id, status, user_id")
      .eq("id", seed.staffViewableSessionId!);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].status).toBe("handoff_pending");
    expect(data![0].user_id).toBe(seed.customerUserId);
  });

  it("Customer chỉ thấy session của chính mình (chat_sessions_own policy)", async () => {
    // Customer query session của chính mình → thấy cả 2 session đã seed
    const { data: ownData, error: ownErr } = await customerClient
      .from("chat_sessions")
      .select("id")
      .in("id", [seed.customerSessionId!, seed.staffViewableSessionId!]);

    expect(ownErr).toBeNull();
    expect(ownData?.map((r) => r.id).sort()).toEqual(
      [seed.customerSessionId, seed.staffViewableSessionId].sort()
    );

    // Customer KHÔNG thấy session của staff user (seed thử 1 row staff-owned)
    const { data: staffSession, error: staffSeedErr } = await adminClient
      .from("chat_sessions")
      .insert({
        user_id: seed.staffUserId!,
        status: "bot",
        platform: "web",
      })
      .select("id")
      .single();
    if (staffSeedErr || !staffSession) throw staffSeedErr;

    try {
      const { data: leakData, error: leakErr } = await customerClient
        .from("chat_sessions")
        .select("id")
        .eq("id", staffSession.id);
      expect(leakErr).toBeNull();
      // RLS chặn → empty array
      expect(leakData).toHaveLength(0);
    } finally {
      await adminClient
        .from("chat_sessions")
        .delete()
        .eq("id", staffSession.id);
    }
  });

  it("Anon (chưa đăng nhập) không thấy được session nào", async () => {
    const { data, error } = await anonClient
      .from("chat_sessions")
      .select("id")
      .in("id", [seed.customerSessionId!, seed.staffViewableSessionId!]);

    // Anon bị block ở 2 layer:
    //  1. RLS policy gọi is_chat_staff() → anon không có EXECUTE → 42501
    //  2. Hoặc trả empty nếu policy short-circuit
    // Cả 2 đều coi như pass — miễn là anon KHÔNG đọc được data.
    if (error) {
      // Permission denied (42501) hoặc insufficient_privilege là acceptable
      expect(["42501", "PGRST301", "PGRST116"]).toContain(error.code);
    } else {
      expect(data).toHaveLength(0);
    }
  });
});
