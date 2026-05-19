/**
 * Unit test cho ComplianceStatsCards (Agent G3).
 * - Pattern: jsdom + manual createRoot (theo StatsCards.test.ts).
 * - Verify Statistic values + loading skeleton.
 */
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Bật cờ act environment cho React 19
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Shim window.matchMedia
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

// Recharts → ResponsiveContainer dùng ResizeObserver; jsdom không có
if (typeof window !== "undefined" && !window.ResizeObserver) {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
}

// Mock recharts để tránh tự render canvas trong jsdom (nhanh & ổn định hơn)
vi.mock("recharts", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-mock": "recharts" }, children);
  const Stub = () => null;
  return {
    Bar: Stub,
    BarChart: Passthrough,
    CartesianGrid: Stub,
    ResponsiveContainer: Passthrough,
    Tooltip: Stub,
    XAxis: Stub,
    YAxis: Stub,
  };
});

import type { ComplianceStats } from "@/features/chat-compliance/types";

import { ComplianceStatsCards } from "@/features/chat-compliance/components/ComplianceStatsCards";

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

function makeStats(): ComplianceStats {
  return {
    total: 42,
    by_severity: { high: 5, medium: 12, low: 25 },
    by_day: [
      { day: "2026-05-18", count: 7 },
      { day: "2026-05-17", count: 3 },
    ],
  };
}

describe("ComplianceStatsCards", () => {
  it("hiển thị total/high/medium/low khi data full", async () => {
    await act(async () => {
      root.render(
        React.createElement(ComplianceStatsCards, {
          data: makeStats(),
          loading: false,
        })
      );
    });
    // total
    expect(container.textContent).toContain("42");
    // high
    expect(container.textContent).toContain("5");
    // medium
    expect(container.textContent).toContain("12");
    // low
    expect(container.textContent).toContain("25");
    // Nhãn severity
    expect(container.textContent).toContain("Nghiêm trọng");
    expect(container.textContent).toContain("Trung bình");
    expect(container.textContent).toContain("Thấp");
  });

  it("hiển thị Skeleton khi loading", async () => {
    await act(async () => {
      root.render(
        React.createElement(ComplianceStatsCards, {
          data: undefined,
          loading: true,
        })
      );
    });
    expect(container.querySelector(".ant-skeleton")).not.toBeNull();
  });

  it("hiển thị Empty khi by_day rỗng", async () => {
    const empty: ComplianceStats = {
      total: 0,
      by_severity: { high: 0, medium: 0, low: 0 },
      by_day: [],
    };
    await act(async () => {
      root.render(
        React.createElement(ComplianceStatsCards, {
          data: empty,
          loading: false,
        })
      );
    });
    expect(container.querySelector(".ant-empty")).not.toBeNull();
  });
});
