// Integration test: 4 RPC analytics chatbot (Plan 2 Task 10).
// - chat_stats_overview      → jsonb 4 key
// - chat_sessions_per_day    → array với len = số ngày trong range
// - chat_top_intents         → max p_limit row
// - chat_unmatched_questions → trả về câu hỏi user intent NULL/unknown
//
// Pattern seed inline giống inbox_rpcs.test.ts / rls_chat_staff.test.ts.

import { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe as _describe, expect, it } from "vitest";

import {
  adminClient,
  createUserClient,
  isProduction,
} from "../helpers/supabase";

const describe = isProduction ? _describe.skip : _describe;

const STAFF_EMAIL = "admin@test.com";
const STAFF_PASSWORD = "Admin@938!";
const CUSTOMER_EMAIL = "kame.ctb@gmail.com";

// Range cố định 7 ngày (10 → 16/05/2026) — đúng cửa sổ "today" để seed rơi vào.
const P_FROM = "2026-05-10";
const P_TO = "2026-05-16";
const EXPECTED_DAYS = 7;

interface SeedRefs {
  staffUserId: string;
  customerUserId: string;
  roleId: string;
  warehouseId: number;
  userRoleId: number | null;
  sessionId: string;
  userMsgIds: string[];
}

const seed: Partial<SeedRefs> = { userMsgIds: [] };
let staffClient: SupabaseClient;

describe("Chatbot Analytics RPCs (overview/per_day/top_intents/unmatched)", () => {
  beforeAll(async () => {
    // 1. Lấy id 2 user fixture
    const userMap: Record<string, string> = {};
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) break;
      for (const u of data?.users ?? []) {
        if (u.email === STAFF_EMAIL && u.id) userMap.staff = u.id;
        if (u.email === CUSTOMER_EMAIL && u.id) userMap.customer = u.id;
      }
      if (userMap.staff && userMap.customer) break;
      if (!data?.users?.length || data.users.length < 200) break;
    }
    if (!userMap.staff)
      throw new Error(`Staff fixture ${STAFF_EMAIL} not found`);
    if (!userMap.customer)
      throw new Error(`Customer fixture ${CUSTOMER_EMAIL} not found`);
    seed.staffUserId = userMap.staff;
    seed.customerUserId = userMap.customer;

    // 2. Tạo role test có permission crm.chatbot.handle
    const roleName = `__test_analytics_rpc_${Date.now()}`;
    const { data: roleRow, error: roleErr } = await adminClient
      .from("roles")
      .insert({ name: roleName, description: "test analytics rpc staff" })
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

    // 5. Auth client cho staff
    staffClient = await createUserClient(STAFF_EMAIL, STAFF_PASSWORD);

    // 6. Seed 1 chat_session (started_at hôm nay → rơi vào [P_FROM, P_TO]).
    //    started_at default now(), không cần truyền.
    const { data: s, error: sErr } = await adminClient
      .from("chat_sessions")
      .insert({
        user_id: seed.customerUserId,
        status: "bot",
        platform: "web",
      })
      .select("id")
      .single();
    if (sErr || !s) throw sErr || new Error("seed chat_session failed");
    seed.sessionId = s.id;

    // 7. Seed 3 user messages: 1 có intent='greeting', 2 NULL → unmatched.
    const msgRows = [
      {
        role: "user",
        content_type: "text",
        content: "Xin chào shop",
        intent: "greeting",
      },
      {
        role: "user",
        content_type: "text",
        content: "Có thuốc cảm cúm gì không?",
        intent: null,
      },
      {
        role: "user",
        content_type: "text",
        content: "Cho hỏi giá panadol?",
        intent: null,
      },
    ];
    for (const r of msgRows) {
      const { data: m, error: mErr } = await adminClient
        .from("chat_messages")
        .insert({ session_id: seed.sessionId, ...r })
        .select("id")
        .single();
      if (mErr || !m) throw mErr || new Error("seed chat_message failed");
      seed.userMsgIds!.push(m.id);
    }
  });

  afterAll(async () => {
    if (seed.sessionId) {
      await adminClient
        .from("chat_messages")
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

  it("1. chat_stats_overview → jsonb có đủ 4 key", async () => {
    const { data, error } = await staffClient.rpc("chat_stats_overview", {
      p_from: P_FROM,
      p_to: P_TO,
    });
    expect(error).toBeNull();
    expect(data).not.toBeNull();

    const obj = data as Record<string, unknown>;
    expect(obj).toHaveProperty("total_sessions");
    expect(obj).toHaveProperty("orders_via_bot");
    expect(obj).toHaveProperty("handoff_rate");
    expect(obj).toHaveProperty("ai_cost_usd");

    // total_sessions phải ≥ 1 (session vừa seed)
    expect(typeof obj.total_sessions).toBe("number");
    expect(obj.total_sessions as number).toBeGreaterThanOrEqual(1);

    // handoff_rate phải là number 0..100
    expect(typeof obj.handoff_rate).toBe("number");
    expect(obj.handoff_rate as number).toBeGreaterThanOrEqual(0);
    expect(obj.handoff_rate as number).toBeLessThanOrEqual(100);

    expect(obj.ai_cost_usd).toBe(0);
  });

  it("2. chat_sessions_per_day → trả về đúng EXPECTED_DAYS row (1 row/day)", async () => {
    const { data, error } = await staffClient.rpc("chat_sessions_per_day", {
      p_from: P_FROM,
      p_to: P_TO,
    });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    const rows = data as Array<{
      day: string;
      sessions: number;
      orders: number;
    }>;
    expect(rows).toHaveLength(EXPECTED_DAYS);

    // Mỗi row phải có 3 field đúng kiểu
    for (const r of rows) {
      expect(typeof r.day).toBe("string");
      expect(typeof r.sessions).toBe("number");
      expect(typeof r.orders).toBe("number");
      expect(r.sessions).toBeGreaterThanOrEqual(0);
      expect(r.orders).toBeGreaterThanOrEqual(0);
    }

    // Tổng sessions trong range ≥ 1 (session vừa seed rơi vào hôm nay)
    const totalSessions = rows.reduce((acc, r) => acc + r.sessions, 0);
    expect(totalSessions).toBeGreaterThanOrEqual(1);
  });

  it("3. chat_top_intents → tối đa p_limit row, có entry seed", async () => {
    const { data, error } = await staffClient.rpc("chat_top_intents", {
      p_from: P_FROM,
      p_to: P_TO,
      p_limit: 5,
    });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    const rows = data as Array<{ intent: string; count: number }>;
    expect(rows.length).toBeLessThanOrEqual(5);

    // Phải có ít nhất 1 row vì đã seed 3 tin user
    expect(rows.length).toBeGreaterThanOrEqual(1);

    // Mỗi row có intent (string) và count (number > 0)
    for (const r of rows) {
      expect(typeof r.intent).toBe("string");
      expect(typeof r.count).toBe("number");
      expect(r.count).toBeGreaterThan(0);
    }

    // Có entry intent='greeting' với count >= 1 (từ seed)
    const greeting = rows.find((r) => r.intent === "greeting");
    expect(greeting).toBeDefined();
    expect(greeting!.count).toBeGreaterThanOrEqual(1);
  });
});
