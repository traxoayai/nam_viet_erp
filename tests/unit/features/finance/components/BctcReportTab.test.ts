/**
 * Unit test cho useBctcReport hook.
 * - Mock financialReportsService (3 fetch function).
 * - Render hook qua QueryClientProvider.
 * - Verify 3 RPC gọi đúng + data resolve.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Bật cờ act environment cho React 19
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// ─── Hoisted mocks ──────────────────────────────────────────────────────────
const mockGetBalanceSheet = vi.fn();
const mockGetVatDeclaration = vi.fn();
const mockGetCashFlow = vi.fn();

vi.mock("@/features/finance/api/financialReportsService", () => ({
  financialReportsService: {
    getBalanceSheet: (...args: unknown[]) => mockGetBalanceSheet(...args),
    getVatDeclaration: (...args: unknown[]) => mockGetVatDeclaration(...args),
    getCashFlow: (...args: unknown[]) => mockGetCashFlow(...args),
  },
}));

import { useBctcReport } from "@/features/finance/hooks/useBctcReport";

// ─── Harness ─────────────────────────────────────────────────────────────────
let container: HTMLDivElement;
let root: Root;
let lastResult: ReturnType<typeof useBctcReport> | null = null;

interface HookProbeProps {
  year: number;
  month: number;
}

function HookProbe({ year, month }: HookProbeProps) {
  lastResult = useBctcReport({ year, month });
  return null;
}

beforeEach(() => {
  mockGetBalanceSheet.mockReset();
  mockGetVatDeclaration.mockReset();
  mockGetCashFlow.mockReset();
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

// ─── useBctcReport tests ──────────────────────────────────────────────────────

describe("useBctcReport", () => {
  it("gọi getBalanceSheet với year=2026, month=6, book=INTERNAL", async () => {
    const mockBalance = [
      { ma_so: "110", ten_chi_tieu: "Tiền mặt", so_tien: 5000000 },
    ];
    const mockVat = [
      { tax_rate: 10, sum_pre_tax: 100000000, sum_vat: 10000000 },
    ];
    const mockCashFlow = {
      dong_tien_vao: 80000000,
      dong_tien_ra: 50000000,
      luu_chuyen_thuan: 30000000,
    };

    mockGetBalanceSheet.mockResolvedValueOnce(mockBalance);
    mockGetVatDeclaration.mockResolvedValueOnce(mockVat);
    mockGetCashFlow.mockResolvedValueOnce(mockCashFlow);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    act(() => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(HookProbe, { year: 2026, month: 6 })
        )
      );
    });

    await new Promise((resolve) =>
      setTimeout(() => {
        expect(mockGetBalanceSheet).toHaveBeenCalledWith({
          book: "INTERNAL",
          year: 2026,
          month: 6,
        });
        resolve(null);
      }, 100)
    );

    expect(lastResult?.balanceSheet).toEqual(mockBalance);
  });

  it("gọi getVatDeclaration với year=2026, month=6, direction=outbound", async () => {
    const mockBalance: unknown[] = [];
    const mockVat = [
      { tax_rate: 10, sum_pre_tax: 100000000, sum_vat: 10000000 },
    ];
    const mockCashFlow = {
      dong_tien_vao: 0,
      dong_tien_ra: 0,
      luu_chuyen_thuan: 0,
    };

    mockGetBalanceSheet.mockResolvedValueOnce(mockBalance);
    mockGetVatDeclaration.mockResolvedValueOnce(mockVat);
    mockGetCashFlow.mockResolvedValueOnce(mockCashFlow);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    act(() => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(HookProbe, { year: 2026, month: 6 })
        )
      );
    });

    await new Promise((resolve) =>
      setTimeout(() => {
        expect(mockGetVatDeclaration).toHaveBeenCalledWith({
          direction: "outbound",
          year: 2026,
          month: 6,
        });
        resolve(null);
      }, 100)
    );

    expect(lastResult?.vatDeclaration).toEqual(mockVat);
  });

  it("gọi getCashFlow với year=2026, month=6, book=INTERNAL", async () => {
    const mockBalance: unknown[] = [];
    const mockVat: unknown[] = [];
    const mockCashFlow = {
      dong_tien_vao: 80000000,
      dong_tien_ra: 50000000,
      luu_chuyen_thuan: 30000000,
    };

    mockGetBalanceSheet.mockResolvedValueOnce(mockBalance);
    mockGetVatDeclaration.mockResolvedValueOnce(mockVat);
    mockGetCashFlow.mockResolvedValueOnce(mockCashFlow);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    act(() => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(HookProbe, { year: 2026, month: 6 })
        )
      );
    });

    await new Promise((resolve) =>
      setTimeout(() => {
        expect(mockGetCashFlow).toHaveBeenCalledWith({
          book: "INTERNAL",
          year: 2026,
          month: 6,
        });
        resolve(null);
      }, 100)
    );

    expect(lastResult?.cashFlow).toEqual(mockCashFlow);
  });

  it("trả về [] khi data null", async () => {
    mockGetBalanceSheet.mockResolvedValueOnce(null);
    mockGetVatDeclaration.mockResolvedValueOnce(null);
    mockGetCashFlow.mockResolvedValueOnce(null);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    act(() => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(HookProbe, { year: 2026, month: 6 })
        )
      );
    });

    await new Promise((resolve) =>
      setTimeout(() => {
        expect(lastResult?.balanceSheet).toEqual([]);
        expect(lastResult?.vatDeclaration).toEqual([]);
        resolve(null);
      }, 100)
    );
  });
});
