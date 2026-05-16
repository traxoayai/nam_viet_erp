// Integration test: RPC public.audit_chat_messages_daily()
// Plan 2 Task 17 — verify 2 case:
//  1. Seed 1 chat_session + 1 chat_message role='bot' content vi phạm với
//     created_at = '2026-05-15'. Call audit_chat_messages_daily('2026-05-15')
//     qua service_role. Assert: flagged >= 1, chat_compliance_audits có row
//     với message_id đó, rule_code='R-04'.
//  2. Call lần 2 cùng day → flagged = 0 (idempotent qua UNIQUE constraint).
//
// Audit RPC chỉ GRANT cho service_role → dùng adminClient.

import { afterAll, beforeAll, describe as _describe, expect, it } from "vitest";

import { adminClient, isProduction } from "../helpers/supabase";

const describe = isProduction ? _describe.skip : _describe;

const AUDIT_DAY = "2026-05-15";

interface SeedRefs {
  customerUserId: string;
  sessionId: string;
  botMessageId: string;
}

const seed: Partial<SeedRefs> = {};

const VIOLATING_CONTENT =
  "Liều dùng thuốc này cho bà bầu cần lưu ý tác dụng phụ và chống chỉ định.";

interface AuditResult {
  day: string;
  scanned: number;
  flagged: number;
}

describe("audit_chat_messages_daily() — batch compliance audit", () => {
  beforeAll(async () => {
    // Lấy 1 user bất kỳ làm chủ session (RPC không gate quyền theo user_id).
    const CUSTOMER_EMAIL = "kame.ctb@gmail.com";
    let customerId: string | undefined;
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) break;
      const u = data?.users?.find((x) => x.email === CUSTOMER_EMAIL);
      if (u?.id) {
        customerId = u.id;
        break;
      }
      if (!data?.users?.length || data.users.length < 200) break;
    }
    if (!customerId)
      throw new Error(`Customer fixture ${CUSTOMER_EMAIL} không tồn tại`);
    seed.customerUserId = customerId;

    // Seed 1 chat_session
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

    // Seed 1 bot message vi phạm với created_at trong AUDIT_DAY
    // created_at có DEFAULT now() nhưng có thể override.
    const auditAtIso = `${AUDIT_DAY}T12:00:00+00:00`;
    const { data: m, error: mErr } = await adminClient
      .from("chat_messages")
      .insert({
        session_id: seed.sessionId,
        role: "bot",
        content_type: "text",
        content: VIOLATING_CONTENT,
        created_at: auditAtIso,
      })
      .select("id")
      .single();
    if (mErr || !m) throw mErr || new Error("seed chat_message bot failed");
    seed.botMessageId = m.id;
  });

  afterAll(async () => {
    // Dọn audit rows trước (FK ON DELETE CASCADE đã có nhưng tường minh hơn)
    if (seed.botMessageId) {
      await adminClient
        .from("chat_compliance_audits")
        .delete()
        .eq("message_id", seed.botMessageId);
    }
    if (seed.sessionId) {
      // CASCADE từ chat_sessions sẽ xóa chat_messages
      await adminClient.from("chat_sessions").delete().eq("id", seed.sessionId);
    }
  });

  it("Call lần 1 — flagged >= 1 và lưu row vào chat_compliance_audits", async () => {
    const { data, error } = await adminClient.rpc("audit_chat_messages_daily", {
      p_for_day: AUDIT_DAY,
      p_sample_size: 50,
    });

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const result = data as unknown as AuditResult;
    expect(result.day).toBe(AUDIT_DAY);
    expect(result.scanned).toBeGreaterThanOrEqual(1);
    expect(result.flagged).toBeGreaterThanOrEqual(1);

    // Verify row tồn tại trong bảng audit
    const { data: rows, error: selErr } = await adminClient
      .from("chat_compliance_audits")
      .select("id, rule_code, severity, matched_keywords, excerpt, status")
      .eq("message_id", seed.botMessageId!);

    expect(selErr).toBeNull();
    expect(rows).not.toBeNull();
    expect(rows!.length).toBe(1);
    const row = rows![0];
    expect(row.rule_code).toBe("R-04");
    expect(["medium", "high"]).toContain(row.severity);
    expect(row.status).toBe("open");
    expect(Array.isArray(row.matched_keywords)).toBe(true);
    expect((row.matched_keywords ?? []).length).toBeGreaterThanOrEqual(2);
    expect(typeof row.excerpt).toBe("string");
    expect(row.excerpt!.length).toBeGreaterThan(0);
  });

  it("Call lần 2 cùng day → flagged = 0 (idempotent qua UNIQUE constraint)", async () => {
    const { data, error } = await adminClient.rpc("audit_chat_messages_daily", {
      p_for_day: AUDIT_DAY,
      p_sample_size: 50,
    });

    expect(error).toBeNull();
    const result = data as unknown as AuditResult;
    expect(result.day).toBe(AUDIT_DAY);
    // scanned vẫn >= 1 (sample lại), nhưng flagged phải = 0 do ON CONFLICT
    expect(result.flagged).toBe(0);
  });
});
