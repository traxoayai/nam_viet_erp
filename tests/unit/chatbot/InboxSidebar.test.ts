/**
 * Unit test cho InboxSidebar (Plan 2 Task 6).
 * - Mock `useInboxSessions` để cô lập component khỏi network.
 * - Render qua react-dom/client + React.createElement (repo không có
 *   @testing-library).
 * - Verify: hiển thị tên customer + click item gọi onSelectSession đúng row.
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

import type { InboxSessionRow } from "@/features/chatbot/types/chat";

// ─── Hoisted mock ────────────────────────────────────────────────────────────
const mockUseInboxSessions = vi.fn();

vi.mock("@/features/chatbot/hooks/useInboxSessions", () => ({
  useInboxSessions: (...args: unknown[]) => mockUseInboxSessions(...args),
}));

// import sau khi mock hoist
import { InboxSidebar } from "@/features/chatbot/components/inbox/InboxSidebar";

// ─── Harness ─────────────────────────────────────────────────────────────────
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mockUseInboxSessions.mockReset();
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

function makeFixture(): InboxSessionRow {
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
    unresolved_handoff_reason: null,
    last_message_preview: "Xin báo giá",
    last_message_at: "2026-05-16T10:01:00Z",
  };
}

describe("InboxSidebar", () => {
  it("hiển thị tên customer từ session row", async () => {
    mockUseInboxSessions.mockReturnValue({
      data: [makeFixture()],
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
          React.createElement(InboxSidebar, {
            selectedSessionId: null,
            onSelectSession: () => {},
          })
        )
      );
    });

    expect(container.textContent).toContain("Nhà thuốc Lan");
    expect(container.textContent).toContain("Xin báo giá");
  });

  it("click vào item gọi onSelectSession với row tương ứng", async () => {
    const fixture = makeFixture();
    mockUseInboxSessions.mockReturnValue({
      data: [fixture],
      isLoading: false,
    });
    const onSelectSession = vi.fn();
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: qc },
          React.createElement(InboxSidebar, {
            selectedSessionId: null,
            onSelectSession,
          })
        )
      );
    });

    const item = container.querySelector(".ant-list-item");
    expect(item).not.toBeNull();

    await act(async () => {
      item?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSelectSession).toHaveBeenCalledTimes(1);
    const callArg = onSelectSession.mock.calls[0]?.[0] as InboxSessionRow;
    expect(callArg.id).toBe("s1");
    expect(callArg.customer_name).toBe("Nhà thuốc Lan");
  });

  it("hiển thị Empty khi data rỗng và không loading", async () => {
    mockUseInboxSessions.mockReturnValue({ data: [], isLoading: false });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: qc },
          React.createElement(InboxSidebar, {
            selectedSessionId: null,
            onSelectSession: () => {},
          })
        )
      );
    });

    expect(container.textContent).toContain("Không có phiên nào");
  });
});
