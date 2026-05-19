/**
 * Unit test cho useInboxSessions (Plan 2 Task 5).
 * Convention repo: file `.test.ts`, env jsdom (đã set ở vitest.config.ts),
 * render qua react-dom/client + React.createElement (không có
 * @testing-library trong repo).
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

import type { InboxSessionRow } from "@/features/chatbot/types/chat";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────
const mockListInboxSessions = vi.fn();
const mockRemoveChannel = vi.fn();
const mockSubscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
const mockOn = vi.fn();
const mockChannel = vi.fn();

vi.mock("@/features/chatbot/api/inboxApi", () => ({
  listInboxSessions: (...args: unknown[]) => mockListInboxSessions(...args),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

// import sau khi vi.mock được hoist
import { useInboxSessions } from "@/features/chatbot/hooks/useInboxSessions";

// Helper: tạo fake channel có chain `.on().on().subscribe()`
function makeFakeChannel() {
  const chain = {
    on: (...args: unknown[]) => {
      mockOn(...args);
      return chain;
    },
    subscribe: () => mockSubscribe(),
  };
  return chain;
}

// ─── Test harness ────────────────────────────────────────────────────────────
let container: HTMLDivElement;
let root: Root;
let lastHookResult: ReturnType<typeof useInboxSessions> | null = null;

function HookProbe({ tab }: { tab: "pending" | "active" | "closed" }) {
  lastHookResult = useInboxSessions(tab);
  return null;
}

beforeEach(() => {
  mockListInboxSessions.mockReset();
  mockRemoveChannel.mockReset();
  mockSubscribe.mockClear();
  mockOn.mockClear();
  mockChannel.mockReset();
  mockChannel.mockImplementation(() => makeFakeChannel());
  lastHookResult = null;
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

describe("useInboxSessions", () => {
  it("fetch data qua listInboxSessions và trả về mảng", async () => {
    const fixture: InboxSessionRow[] = [
      {
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
        unresolved_handoff_reason: "sales_request",
        last_message_preview: "Xin báo giá",
        last_message_at: "2026-05-16T10:01:00Z",
      },
    ];
    mockListInboxSessions.mockResolvedValue(fixture);

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: qc },
          React.createElement(HookProbe, { tab: "pending" })
        )
      );
    });

    // Flush microtasks + macrotasks cho useQuery resolve (poll tới khi data có).
    // Cần `setTimeout(0)` để cho react-query schedule render lại sau khi
    // queryFn resolve — chỉ Promise.resolve() chưa đủ trong React 19 + jsdom.
    for (let i = 0; i < 50 && !lastHookResult?.data; i++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    expect(mockListInboxSessions).toHaveBeenCalledWith({ tab: "pending" });
    expect(lastHookResult?.data?.length).toBe(1);
    expect(lastHookResult?.data?.[0]?.customer_name).toBe("Nhà thuốc Lan");
  });

  it("subscribe realtime channel chat_sessions + chat_handoffs", async () => {
    mockListInboxSessions.mockResolvedValue([]);
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: qc },
          React.createElement(HookProbe, { tab: "active" })
        )
      );
    });

    expect(mockChannel).toHaveBeenCalledWith("inbox:active");
    // 2 subscription: chat_sessions, chat_handoffs
    expect(mockOn).toHaveBeenCalledTimes(2);
    expect(mockSubscribe).toHaveBeenCalled();

    const sessionsCall = mockOn.mock.calls.find(
      (c) => (c[1] as { table: string }).table === "chat_sessions"
    );
    const handoffsCall = mockOn.mock.calls.find(
      (c) => (c[1] as { table: string }).table === "chat_handoffs"
    );
    expect(sessionsCall?.[1]).toMatchObject({ event: "*" });
    expect(handoffsCall?.[1]).toMatchObject({ event: "INSERT" });
  });

  it("removeChannel khi unmount", async () => {
    mockListInboxSessions.mockResolvedValue([]);
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: qc },
          React.createElement(HookProbe, { tab: "pending" })
        )
      );
    });

    await act(async () => {
      root.unmount();
    });

    expect(mockRemoveChannel).toHaveBeenCalled();
    // re-mount cho afterEach cleanup khỏi double-unmount
    root = createRoot(container);
  });
});
