/**
 * Unit test cho useChatStats (Plan 2 Task 11.2).
 * - Mock 4 fetch function của analyticsApi.
 * - Render hook qua QueryClientProvider, poll cho tới khi overview.data có.
 * - Verify overview/perDay/intents/unmatched đều fire đúng args + resolve.
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
const mockFetchStatsOverview = vi.fn();
const mockFetchSessionsPerDay = vi.fn();
const mockFetchTopIntents = vi.fn();
const mockFetchUnmatched = vi.fn();

vi.mock("@/features/chatbot/api/analyticsApi", () => ({
  fetchStatsOverview: (...args: unknown[]) => mockFetchStatsOverview(...args),
  fetchSessionsPerDay: (...args: unknown[]) => mockFetchSessionsPerDay(...args),
  fetchTopIntents: (...args: unknown[]) => mockFetchTopIntents(...args),
  fetchUnmatched: (...args: unknown[]) => mockFetchUnmatched(...args),
}));

import type { AnalyticsFilters } from "@/features/chatbot/api/analyticsApi";

import { useChatStats } from "@/features/chatbot/hooks/useChatStats";

// ─── Harness ─────────────────────────────────────────────────────────────────
let container: HTMLDivElement;
let root: Root;
let lastResult: ReturnType<typeof useChatStats> | null = null;

function HookProbe({ filters }: { filters: AnalyticsFilters }) {
  lastResult = useChatStats(filters);
  return null;
}

beforeEach(() => {
  mockFetchStatsOverview.mockReset();
  mockFetchSessionsPerDay.mockReset();
  mockFetchTopIntents.mockReset();
  mockFetchUnmatched.mockReset();
  lastResult = null;
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

describe("useChatStats", () => {
  it("fire 4 query song song và resolve data", async () => {
    mockFetchStatsOverview.mockResolvedValue({
      total_sessions: 10,
      orders_via_bot: 2,
      handoff_rate: 5,
      ai_cost_usd: 0,
    });
    mockFetchSessionsPerDay.mockResolvedValue([
      { day: "2026-05-15", sessions: 5, orders: 1 },
    ]);
    mockFetchTopIntents.mockResolvedValue([
      { intent: "search_product", count: 7 },
    ]);
    mockFetchUnmatched.mockResolvedValue([
      {
        question: "có thuốc gì?",
        occurred_at: "2026-05-15T10:00:00Z",
        session_id: "s1",
      },
    ]);

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const filters: AnalyticsFilters = {
      from: "2026-05-09",
      to: "2026-05-16",
    };

    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: qc },
          React.createElement(HookProbe, { filters })
        )
      );
    });

    // Flush microtasks cho useQueries resolve. Poll cho tới khi cả 4 slot có
    // data — tránh flake khi 3 test file chạy song song trong worker pool.
    for (
      let i = 0;
      i < 60 &&
      (!lastResult?.overview?.data ||
        !lastResult?.perDay?.data ||
        !lastResult?.intents?.data ||
        !lastResult?.unmatched?.data);
      i++
    ) {
      await act(async () => {
        await Promise.resolve();
      });
    }

    expect(mockFetchStatsOverview).toHaveBeenCalledWith(filters);
    expect(mockFetchSessionsPerDay).toHaveBeenCalledWith(filters);
    expect(mockFetchTopIntents).toHaveBeenCalledWith(filters);
    expect(mockFetchUnmatched).toHaveBeenCalledWith(filters);

    expect(lastResult?.overview?.data?.total_sessions).toBe(10);
    expect(lastResult?.perDay?.data?.length).toBe(1);
    expect(lastResult?.intents?.data?.[0]?.intent).toBe("search_product");
    expect(lastResult?.unmatched?.data?.[0]?.session_id).toBe("s1");
  });
});
