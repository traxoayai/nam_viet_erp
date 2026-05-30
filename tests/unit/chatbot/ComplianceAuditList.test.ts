/**
 * Unit test cho ComplianceAuditList (Plan 2 Task 18).
 * - Mock `useComplianceAudits` (1 audit row R-04).
 * - Mock `reviewAudit` để verify verdict='reviewed_violation' khi click "Vi phạm".
 * - Render qua react-dom/client + React.createElement (repo không có
 *   @testing-library). AntD Modal render qua portal → query document.body.
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

import type { ComplianceAudit } from "@/features/chatbot/api/complianceApi";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const mockUseComplianceAudits = vi.fn();
const mockReviewAudit = vi.fn();

vi.mock("@/features/chatbot/hooks/useComplianceAudits", () => ({
  useComplianceAudits: (...args: unknown[]) => mockUseComplianceAudits(...args),
}));

vi.mock("@/features/chatbot/api/complianceApi", () => ({
  reviewAudit: (...args: unknown[]) => mockReviewAudit(...args),
}));

// import sau khi mock hoist
import { ComplianceAuditList } from "@/features/chatbot/components/compliance/ComplianceAuditList";

// ─── Harness ─────────────────────────────────────────────────────────────────
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mockUseComplianceAudits.mockReset();
  mockReviewAudit.mockReset();
  mockReviewAudit.mockResolvedValue(undefined);

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  // Dọn AntD portals còn sót (Modal render vào body)
  document.body.querySelectorAll(".ant-modal-root").forEach((el) => {
    el.remove();
  });
});

function makeFixture(): ComplianceAudit {
  return {
    id: "a1",
    message_id: "m1",
    session_id: "s1",
    rule_code: "R-04",
    severity: "high",
    matched_keywords: ["xarelto", "liều"],
    excerpt: "Anh uống xarelto liều 20mg mỗi ngày nhé",
    status: "open",
    audited_at: "2026-05-16T02:00:00Z",
    reviewer_note: null,
  };
}

describe("ComplianceAuditList", () => {
  it("hiển thị rule_code R-04 trong bảng", async () => {
    mockUseComplianceAudits.mockReturnValue({
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
          React.createElement(ComplianceAuditList)
        )
      );
    });

    expect(container.textContent).toContain("R-04");
    expect(container.textContent).toContain("xarelto");
  });

  it("click Review → click 'Vi phạm' gọi reviewAudit với verdict='reviewed_violation'", async () => {
    mockUseComplianceAudits.mockReturnValue({
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
          React.createElement(ComplianceAuditList)
        )
      );
    });

    // Click "Review" button trong row (inside container)
    const rowReviewBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => (b.textContent ?? "").trim() === "Review"
    );
    expect(rowReviewBtn).toBeDefined();

    await act(async () => {
      rowReviewBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Flush microtasks để Modal render xong
    await act(async () => {
      await Promise.resolve();
    });

    // Modal render qua portal → query toàn body
    const violationBtn = Array.from(
      document.body.querySelectorAll("button")
    ).find((b) => (b.textContent ?? "").includes("Vi phạm"));
    expect(violationBtn).toBeDefined();

    await act(async () => {
      violationBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Flush async reviewAudit
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockReviewAudit).toHaveBeenCalledTimes(1);
    const callArg = mockReviewAudit.mock.calls[0]?.[0] as {
      id: string;
      verdict: string;
    };
    expect(callArg.id).toBe("a1");
    expect(callArg.verdict).toBe("reviewed_violation");
  });
});
