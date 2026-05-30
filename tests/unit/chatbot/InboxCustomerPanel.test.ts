/**
 * Unit test cho InboxCustomerPanel (Plan 2 Task 8).
 * - Mock `getChatCustomerSummary` để cô lập component khỏi network.
 * - Render qua react-dom/client + React.createElement (repo không có
 *   @testing-library).
 * - Verify: hiển thị display_name + công nợ + đơn gần nhất + fallback empty.
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

import type { ChatCustomerSummary } from "@/features/chatbot/api/customerSummaryApi";

// ─── Hoisted mock ────────────────────────────────────────────────────────────
const mockGetSummary = vi.fn();

vi.mock("@/features/chatbot/api/customerSummaryApi", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@/features/chatbot/api/customerSummaryApi")
    >();
  return {
    ...original,
    getChatCustomerSummary: (...args: unknown[]) => mockGetSummary(...args),
  };
});

// import sau khi mock hoist
import { InboxCustomerPanel } from "@/features/chatbot/components/inbox/InboxCustomerPanel";

// ─── Harness ─────────────────────────────────────────────────────────────────
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mockGetSummary.mockReset();
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

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });
}

function fixtureFull(): ChatCustomerSummary {
  return {
    portal_user: {
      id: "pu1",
      display_name: "Nhà thuốc Lan",
      phone: "0900000001",
      email: "lan@nhathuoc.vn",
      role: "owner",
    },
    customer: {
      id: 42,
      name: "CTY TNHH NHÀ THUỐC LAN",
      customer_code: "KH0042",
      tax_code: "0312345678",
      vat_address: "12 Lê Lợi, Q.1, TP.HCM",
      shipping_address: null,
    },
    recent_orders: [
      {
        id: "o1",
        code: "DH00001",
        total: 1_200_000,
        status: "PENDING",
        created_at: "2026-05-15T09:00:00Z",
      },
    ],
    debt: {
      debt_total: 5_000_000,
      debt_limit: 100_000_000,
      available_credit: 95_000_000,
      pending_orders_total: 1_200_000,
    },
  };
}

describe("InboxCustomerPanel", () => {
  it("không render gì khi userId = null", async () => {
    const qc = makeQueryClient();

    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: qc },
          React.createElement(InboxCustomerPanel, { userId: null })
        )
      );
    });

    expect(container.textContent ?? "").toBe("");
    expect(mockGetSummary).not.toHaveBeenCalled();
  });

  it("hiển thị display_name + công nợ + đơn gần nhất", async () => {
    mockGetSummary.mockResolvedValue(fixtureFull());
    const qc = makeQueryClient();

    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: qc },
          React.createElement(InboxCustomerPanel, { userId: "auth-uid-1" })
        )
      );
    });

    // Chờ react-query settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Nhà thuốc Lan");
    expect(text).toContain("Công nợ");
    // 5.000.000 — format vi-VN dùng dấu chấm
    expect(text).toContain("5.000.000");
    expect(text).toContain("DH00001");
    expect(text).toContain("PENDING");
    expect(mockGetSummary).toHaveBeenCalledWith("auth-uid-1");
  });

  it("hiển thị Empty khi khách chưa có portal_user", async () => {
    mockGetSummary.mockResolvedValue({
      portal_user: null,
      customer: null,
      recent_orders: [],
      debt: null,
    });
    const qc = makeQueryClient();

    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: qc },
          React.createElement(InboxCustomerPanel, { userId: "auth-uid-2" })
        )
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(container.textContent ?? "").toContain("Khách chưa đăng ký Portal");
  });
});
