/**
 * Unit test cho InboxThread (Plan 2 Task 7).
 * - Mock `useSessionThread` để cô lập khỏi network/realtime.
 * - Mock `inboxApi` (assignSelfToSession) để verify gọi đúng session.id.
 * - Render qua react-dom/client + React.createElement (repo không có
 *   @testing-library).
 * - Verify:
 *   1. 2 messages visible (text "Cho xarelto").
 *   2. Click "Nhận phiên" → assignSelfToSession gọi với session.id='s1'.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Bật cờ act environment cho React 19 (jsdom env không tự bật)
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Shim window.matchMedia (jsdom không có, AntD responsive cần)
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

import type {
  ChatMessage,
  InboxSessionRow,
} from "@/features/chatbot/types/chat";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const mockUseSessionThread = vi.fn();
const mockAssignSelfToSession = vi.fn();
const mockReturnToBot = vi.fn();
const mockCloseSession = vi.fn();
const mockSendSalesReply = vi.fn();
const mockReportFeedback = vi.fn();

vi.mock("@/features/chatbot/hooks/useSessionThread", () => ({
  useSessionThread: (...args: unknown[]) => mockUseSessionThread(...args),
}));

vi.mock("@/features/chatbot/api/inboxApi", () => ({
  assignSelfToSession: (...args: unknown[]) => mockAssignSelfToSession(...args),
  returnToBot: (...args: unknown[]) => mockReturnToBot(...args),
  closeSession: (...args: unknown[]) => mockCloseSession(...args),
  sendSalesReply: (...args: unknown[]) => mockSendSalesReply(...args),
  reportFeedback: (...args: unknown[]) => mockReportFeedback(...args),
}));

// import sau khi mock hoist
import { InboxThread } from "@/features/chatbot/components/inbox/InboxThread";

// ─── Harness ─────────────────────────────────────────────────────────────────
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mockUseSessionThread.mockReset();
  mockAssignSelfToSession.mockReset();
  mockAssignSelfToSession.mockResolvedValue(undefined);
  mockReturnToBot.mockReset();
  mockCloseSession.mockReset();
  mockSendSalesReply.mockReset();
  mockReportFeedback.mockReset();

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function makeSession(): InboxSessionRow {
  return {
    id: "s1",
    user_id: "u1",
    status: "handoff_pending",
    assigned_sales_id: null,
    draft_cart_id: null,
    platform: "web",
    context: {},
    started_at: "2026-05-16T10:00:00Z",
    last_activity_at: "2026-05-16T10:01:00Z",
    closed_at: null,
    customer_name: "Nhà thuốc Lan",
    customer_phone: "0900000001",
    unresolved_handoff_reason: "Hỏi giá xarelto",
    last_message_preview: "Em tìm thấy XAR20-30",
    last_message_at: "2026-05-16T10:01:00Z",
  };
}

function makeMessages(): ChatMessage[] {
  return [
    {
      id: "m1",
      session_id: "s1",
      role: "user",
      content_type: "text",
      content: "Cho xarelto",
      attachments: null,
      llm_meta: null,
      intent: null,
      entities: null,
      deleted_at: null,
      created_at: "2026-05-16T10:00:30Z",
    },
    {
      id: "m2",
      session_id: "s1",
      role: "bot",
      content_type: "text",
      content: "Em tìm thấy XAR20-30",
      attachments: null,
      llm_meta: null,
      intent: null,
      entities: null,
      deleted_at: null,
      created_at: "2026-05-16T10:00:45Z",
    },
  ];
}

describe("InboxThread", () => {
  it("hiển thị 2 messages từ useSessionThread", async () => {
    mockUseSessionThread.mockReturnValue({
      data: makeMessages(),
      isLoading: false,
    });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: qc },
          React.createElement(InboxThread, { session: makeSession() })
        )
      );
    });

    expect(container.textContent).toContain("Cho xarelto");
    expect(container.textContent).toContain("Em tìm thấy XAR20-30");
  });

  it("click 'Nhận phiên' gọi assignSelfToSession với session.id='s1'", async () => {
    mockUseSessionThread.mockReturnValue({
      data: makeMessages(),
      isLoading: false,
    });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: qc },
          React.createElement(InboxThread, { session: makeSession() })
        )
      );
    });

    // Tìm button "Nhận phiên" qua textContent
    const buttons = Array.from(container.querySelectorAll("button"));
    const assignBtn = buttons.find((b) =>
      (b.textContent ?? "").includes("Nhận phiên")
    );
    expect(assignBtn).toBeDefined();

    await act(async () => {
      assignBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Flush microtasks (action chạy async)
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockAssignSelfToSession).toHaveBeenCalledTimes(1);
    expect(mockAssignSelfToSession).toHaveBeenCalledWith("s1");
  });
});
