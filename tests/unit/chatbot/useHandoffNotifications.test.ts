/**
 * Unit test cho useHandoffNotifications (Plan 2 Task 21).
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

// ─── Hoisted mocks ──────────────────────────────────────────────────────────
const mockRemoveChannel = vi.fn();
const mockSubscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
const mockOn = vi.fn();
const mockChannel = vi.fn();

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

// import sau khi vi.mock được hoist
import { useHandoffNotifications } from "@/features/chatbot/hooks/useHandoffNotifications";

// Helper: tạo fake channel có chain `.on().subscribe()`
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

function TestComponent({ enabled }: { enabled: boolean }) {
  useHandoffNotifications(enabled);
  return null;
}

beforeEach(() => {
  mockRemoveChannel.mockReset();
  mockSubscribe.mockClear();
  mockOn.mockClear();
  mockChannel.mockReset();
  mockChannel.mockImplementation(() => makeFakeChannel());
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

describe("useHandoffNotifications", () => {
  it("subscribe khi enabled=true", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: qc },
          React.createElement(TestComponent, { enabled: true })
        )
      );
    });

    expect(mockChannel).toHaveBeenCalledWith("global:chat_handoffs");
    expect(mockOn).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalled();

    const handoffCall = mockOn.mock.calls[0];
    expect(handoffCall?.[1]).toMatchObject({
      event: "INSERT",
      schema: "public",
      table: "chat_handoffs",
    });
  });

  it("không subscribe khi enabled=false", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: qc },
          React.createElement(TestComponent, { enabled: false })
        )
      );
    });

    expect(mockChannel).not.toHaveBeenCalled();
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("removeChannel khi unmount", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: qc },
          React.createElement(TestComponent, { enabled: true })
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
