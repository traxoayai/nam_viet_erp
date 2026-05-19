import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────
const mockSafeRpc = vi.fn();
const mockInsert = vi.fn();
const mockFromChain = (table: string) => ({
  insert: (row: unknown) => mockInsert(table, row),
});
const mockGetUser = vi.fn();

vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: unknown[]) => mockSafeRpc(...args),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: (table: string) => mockFromChain(table),
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}));

// import sau khi mock đã được vi.mock hoist
import {
  listInboxSessions,
  reportFeedback,
  sendSalesReply,
} from "@/features/chatbot/api/inboxApi";

describe("inboxApi unit", () => {
  beforeEach(() => {
    mockSafeRpc.mockReset();
    mockInsert.mockReset();
    mockGetUser.mockReset();
  });

  // ── listInboxSessions ────────────────────────────────────────────────────
  it("listInboxSessions gọi safeRpc với p_tab + default p_limit=50", async () => {
    mockSafeRpc.mockResolvedValue({ data: [], error: null });

    const result = await listInboxSessions({ tab: "pending" });

    expect(mockSafeRpc).toHaveBeenCalledWith("list_inbox_sessions", {
      p_tab: "pending",
      p_limit: 50,
    });
    expect(result).toEqual([]);
  });

  it("listInboxSessions truyền p_limit custom", async () => {
    mockSafeRpc.mockResolvedValue({ data: [], error: null });

    await listInboxSessions({ tab: "active", limit: 10 });

    expect(mockSafeRpc).toHaveBeenCalledWith("list_inbox_sessions", {
      p_tab: "active",
      p_limit: 10,
    });
  });

  // ── sendSalesReply ───────────────────────────────────────────────────────
  it("sendSalesReply throw khi safeRpc trả error", async () => {
    const fakeError = { code: "42501", message: "denied" };
    mockSafeRpc.mockResolvedValue({ data: null, error: fakeError });

    await expect(
      sendSalesReply({ sessionId: "s-1", content: "hi" })
    ).rejects.toBe(fakeError);

    expect(mockSafeRpc).toHaveBeenCalledWith("send_sales_reply", {
      p_session_id: "s-1",
      p_content: "hi",
    });
  });

  // ── reportFeedback ───────────────────────────────────────────────────────
  it("reportFeedback insert đúng row vào table chat_feedback", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u-9" } },
      error: null,
    });
    mockInsert.mockResolvedValue({ data: null, error: null });

    await reportFeedback({
      messageId: "m-1",
      feedbackType: "fabricated_sku",
      note: "Bot bịa",
    });

    expect(mockInsert).toHaveBeenCalledWith("chat_feedback", {
      message_id: "m-1",
      reporter_id: "u-9",
      feedback_type: "fabricated_sku",
      note: "Bot bịa",
    });
  });

  it("reportFeedback throw khi chưa đăng nhập", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(
      reportFeedback({ messageId: "m-1", feedbackType: "other" })
    ).rejects.toThrow("Chưa đăng nhập");

    expect(mockInsert).not.toHaveBeenCalled();
  });
});
