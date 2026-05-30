// Integration test: 5 RPC inbox (Plan 2 Task 4).
// Verify qua actual DB local. Pattern seed inline giống rls_chat_staff.test.ts.

import { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe as _describe, expect, it } from "vitest";

import {
  adminClient,
  createUserClient,
  findUserIdByEmail,
  isProduction,
} from "../helpers/supabase";

const describe = isProduction ? _describe.skip : _describe;

const STAFF_EMAIL = "admin@test.com";
const STAFF_PASSWORD = process.env.TEST_STAFF_PASSWORD;
if (!STAFF_PASSWORD && !isProduction) {
  throw new Error("TEST_STAFF_PASSWORD env var required (do not hardcode)");
}
const CUSTOMER_EMAIL = "kame.ctb@gmail.com";
const CUSTOMER_PASSWORD = "Test@123!";

interface SeedRefs {
  staffUserId: string;
  customerUserId: string;
  roleId: string;
  warehouseId: number;
  userRoleId: number | null;
  sessionId: string;
  handoffId: string;
}

const seed: Partial<SeedRefs> = {};
let staffClient: SupabaseClient;
let customerClient: SupabaseClient;

describe("Inbox RPCs (list/assign/send/close/return)", () => {
  beforeAll(async () => {
    // 1. Lấy id 2 user fixture qua helper
    const staffId = await findUserIdByEmail(STAFF_EMAIL);
    const customerId = await findUserIdByEmail(CUSTOMER_EMAIL);
    if (!staffId) throw new Error(`Staff fixture ${STAFF_EMAIL} not found`);
    if (!customerId)
      throw new Error(`Customer fixture ${CUSTOMER_EMAIL} not found`);
    seed.staffUserId = staffId;
    seed.customerUserId = customerId;

    // 2. Tạo role test có permission crm.chatbot.handle
    const roleName = `__test_inbox_rpc_${Date.now()}`;
    const { data: roleRow, error: roleErr } = await adminClient
      .from("roles")
      .insert({ name: roleName, description: "test inbox rpc staff" })
      .select("id")
      .single();
    if (roleErr || !roleRow) throw roleErr || new Error("seed role failed");
    seed.roleId = roleRow.id;

    const { error: rpErr } = await adminClient.from("role_permissions").insert({
      role_id: seed.roleId,
      permission_key: "crm.chatbot.handle",
    });
    if (rpErr) throw rpErr;

    // 3. Warehouse cho user_roles.branch_id
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

    // 6. Seed 1 chat_session status='handoff_pending' của customer
    const { data: s, error: sErr } = await adminClient
      .from("chat_sessions")
      .insert({
        user_id: seed.customerUserId,
        status: "handoff_pending",
        platform: "web",
      })
      .select("id")
      .single();
    if (sErr || !s) throw sErr || new Error("seed chat_session failed");
    seed.sessionId = s.id;

    // 7. Seed 1 chat_handoff unresolved
    const { data: h, error: hErr } = await adminClient
      .from("chat_handoffs")
      .insert({
        session_id: seed.sessionId,
        reason: "Khách yêu cầu gặp sales",
      })
      .select("id")
      .single();
    if (hErr || !h) throw hErr || new Error("seed chat_handoff failed");
    seed.handoffId = h.id;
  });

  afterAll(async () => {
    if (seed.sessionId) {
      // Xóa messages + handoffs + session
      await adminClient
        .from("chat_messages")
        .delete()
        .eq("session_id", seed.sessionId);
      await adminClient
        .from("chat_handoffs")
        .delete()
        .eq("session_id", seed.sessionId);
      await adminClient.from("chat_sessions").delete().eq("id", seed.sessionId);
    }
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

  it("1. Staff gọi list_inbox_sessions('pending') → thấy session đã seed", async () => {
    const { data, error } = await staffClient.rpc("list_inbox_sessions", {
      p_tab: "pending",
      p_limit: 100,
    });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    const row = (data as Array<{ id: string; status: string }>)?.find(
      (r) => r.id === seed.sessionId
    );
    expect(row).toBeDefined();
    expect(row!.status).toBe("handoff_pending");
  });

  it("2. Staff gọi assign_chat_session_to_self → status=human, assigned_sales_id=staff, handoff resolved", async () => {
    const { error } = await staffClient.rpc("assign_chat_session_to_self", {
      p_session_id: seed.sessionId!,
    });
    expect(error).toBeNull();

    const { data: sessionRow, error: sErr } = await adminClient
      .from("chat_sessions")
      .select("status, assigned_sales_id")
      .eq("id", seed.sessionId!)
      .single();
    expect(sErr).toBeNull();
    expect(sessionRow!.status).toBe("human");
    expect(sessionRow!.assigned_sales_id).toBe(seed.staffUserId);

    const { data: handoffRow, error: hErr } = await adminClient
      .from("chat_handoffs")
      .select("resolved_at")
      .eq("id", seed.handoffId!)
      .single();
    expect(hErr).toBeNull();
    expect(handoffRow!.resolved_at).not.toBeNull();
  });

  it("3. Staff gọi send_sales_reply → row role='sales' xuất hiện", async () => {
    const { data, error } = await staffClient.rpc("send_sales_reply", {
      p_session_id: seed.sessionId!,
      p_content: "Em hỗ trợ anh chị ngay ạ",
    });
    expect(error).toBeNull();
    expect(data).not.toBeNull();

    const row = data as { id: string; role: string; content: string };
    expect(row.role).toBe("sales");
    expect(row.content).toBe("Em hỗ trợ anh chị ngay ạ");

    // verify row tồn tại trong DB
    const { data: msg, error: mErr } = await adminClient
      .from("chat_messages")
      .select("id, role, content, session_id")
      .eq("id", row.id)
      .single();
    expect(mErr).toBeNull();
    expect(msg!.session_id).toBe(seed.sessionId);
    expect(msg!.role).toBe("sales");
  });

  it("4. Customer gọi send_sales_reply → error 42501", async () => {
    const { data, error } = await customerClient.rpc("send_sales_reply", {
      p_session_id: seed.sessionId!,
      p_content: "Tôi không phải sales",
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("5. Staff gọi close_chat_session → status='closed' + system message 'đóng'", async () => {
    const { error } = await staffClient.rpc("close_chat_session", {
      p_session_id: seed.sessionId!,
    });
    expect(error).toBeNull();

    const { data: sessionRow, error: sErr } = await adminClient
      .from("chat_sessions")
      .select("status, closed_at")
      .eq("id", seed.sessionId!)
      .single();
    expect(sErr).toBeNull();
    expect(sessionRow!.status).toBe("closed");
    expect(sessionRow!.closed_at).not.toBeNull();

    const { data: systemMsg, error: mErr } = await adminClient
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", seed.sessionId!)
      .eq("role", "system")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(mErr).toBeNull();
    expect(systemMsg).not.toBeNull();
    expect(systemMsg!.content).toMatch(/đóng/i);
  });
});
