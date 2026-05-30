// Integration test: bảng chat_feedback + RLS
// Verify 3 case:
//  1. Staff (permission crm.chatbot.handle) insert được feedback thành công.
//  2. Staff KHÔNG insert được 2 feedback cùng (message_id, reporter_id) — unique constraint.
//  3. Customer (user thường) KHÔNG SELECT được feedback rows.
//
// Yêu cầu: local Supabase chạy ở 127.0.0.1:54321 với migration mới nhất.

import { SupabaseClient } from "@supabase/supabase-js";
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
  botMessageId: string;
  feedbackId: string | null;
}

const seed: Partial<SeedRefs> = { feedbackId: null };
let staffClient: SupabaseClient;
let customerClient: SupabaseClient;

describe("chat_feedback table + RLS", () => {
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
    const roleName = `__test_chatfb_staff_${Date.now()}`;
    const { data: roleRow, error: roleErr } = await adminClient
      .from("roles")
      .insert({ name: roleName, description: "test chat_feedback staff" })
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

    // 6. Seed 1 chat session + 1 bot message để làm message_id FK
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

    const { data: m, error: mErr } = await adminClient
      .from("chat_messages")
      .insert({
        session_id: seed.sessionId,
        role: "bot",
        content_type: "text",
        content: "Bot trả lời sai SKU XYZ-NOT-EXIST",
      })
      .select("id")
      .single();
    if (mErr || !m) throw mErr || new Error("seed chat_message bot failed");
    seed.botMessageId = m.id;
  });

  afterAll(async () => {
    // Xóa feedback đã insert
    if (seed.feedbackId)
      await adminClient
        .from("chat_feedback")
        .delete()
        .eq("id", seed.feedbackId);
    // Cleanup feedback theo message_id (đề phòng test fail giữa chừng)
    if (seed.botMessageId)
      await adminClient
        .from("chat_feedback")
        .delete()
        .eq("message_id", seed.botMessageId);
    if (seed.sessionId)
      await adminClient.from("chat_sessions").delete().eq("id", seed.sessionId);
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

  it("Staff insert được feedback thành công", async () => {
    const { data, error } = await staffClient
      .from("chat_feedback")
      .insert({
        message_id: seed.botMessageId!,
        reporter_id: seed.staffUserId!,
        feedback_type: "wrong_answer",
        note: "Bot bịa SKU không tồn tại",
      })
      .select("id, feedback_type, note")
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.feedback_type).toBe("wrong_answer");
    expect(data!.note).toBe("Bot bịa SKU không tồn tại");
    seed.feedbackId = data!.id;
  });

  it("Staff KHÔNG insert được 2 feedback cùng (message_id, reporter_id) — unique constraint", async () => {
    const { data, error } = await staffClient
      .from("chat_feedback")
      .insert({
        message_id: seed.botMessageId!,
        reporter_id: seed.staffUserId!,
        feedback_type: "fabricated_sku",
        note: "Insert lần 2 — phải lỗi unique",
      })
      .select("id")
      .single();

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    // Postgres unique_violation = 23505
    expect(error!.code).toBe("23505");
  });

  it("Customer (không có permission) KHÔNG SELECT được feedback rows", async () => {
    const { data, error } = await customerClient
      .from("chat_feedback")
      .select("id")
      .eq("message_id", seed.botMessageId!);

    // RLS chặn → empty array (policy is_chat_staff() = false → 0 rows)
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
