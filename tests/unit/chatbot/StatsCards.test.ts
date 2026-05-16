/**
 * Unit test cho StatsCards (Plan 2 Task 12.2).
 * - Pattern theo InboxSidebar.test.ts: jsdom + manual createRoot.
 * - Verify hiển thị value của các Statistic khi data đầy đủ.
 * - Verify Skeleton khi loading.
 */
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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

import type { ChatStatsOverview } from "@/features/chatbot/api/analyticsApi";

import { StatsCards } from "@/features/chatbot/components/analytics/StatsCards";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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

function makeData(): ChatStatsOverview {
  return {
    total_sessions: 100,
    orders_via_bot: 12,
    handoff_rate: 8.5,
    ai_cost_usd: 0,
    orders_note: "Đơn được attribute từ phiên chat",
  };
}

describe("StatsCards", () => {
  it("hiển thị các KPI khi data full", async () => {
    await act(async () => {
      root.render(
        React.createElement(StatsCards, { data: makeData(), loading: false })
      );
    });

    // total_sessions = 100
    expect(container.textContent).toContain("100");
    // orders_via_bot = 12
    expect(container.textContent).toContain("12");
    // handoff_rate = 8.5 (precision=1)
    expect(container.textContent).toContain("8.5");
    // note dưới card "Đơn từ bot"
    expect(container.textContent).toContain("Đơn được attribute từ phiên chat");
    // Disclaimer FREE-only
    expect(container.textContent).toContain("FREE-only stack");
  });

  it("hiển thị Skeleton khi loading", async () => {
    await act(async () => {
      root.render(
        React.createElement(StatsCards, { data: undefined, loading: true })
      );
    });

    expect(container.querySelector(".ant-skeleton")).not.toBeNull();
  });

  it("hiển thị Skeleton khi data chưa có (kể cả loading=false)", async () => {
    await act(async () => {
      root.render(
        React.createElement(StatsCards, { data: undefined, loading: false })
      );
    });

    expect(container.querySelector(".ant-skeleton")).not.toBeNull();
  });
});
