// Unit test cho SynonymForm (Gap 1 P2.5).
// - Test validation: synonym length >= 2.
// - Test submit gọi useAddSynonym.mutateAsync với đúng params.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

// ─── Hoisted mock ────────────────────────────────────────────────────────────
const mockMutateAsync = vi.fn();
const mockUseAddSynonym = vi.fn();

vi.mock("@/features/chatbot/hooks/useSynonyms", () => ({
  useAddSynonym: () => mockUseAddSynonym(),
}));

import { SynonymForm } from "@/features/chatbot/components/synonyms/SynonymForm";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mockMutateAsync.mockReset();
  mockUseAddSynonym.mockReset();
  mockUseAddSynonym.mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
  });
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

function renderForm(productId = 1) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return act(async () => {
    root.render(
      React.createElement(
        QueryClientProvider,
        { client: qc },
        React.createElement(SynonymForm, { productId })
      )
    );
  });
}

function getInput(): HTMLInputElement {
  const el = container.querySelector(
    'input[placeholder="vd: xa20, xarelto20"]'
  ) as HTMLInputElement | null;
  if (!el) throw new Error("Không tìm thấy input synonym");
  return el;
}

function getSubmitBtn(): HTMLButtonElement {
  const btns = Array.from(container.querySelectorAll("button"));
  const btn = btns.find((b) => b.textContent?.includes("Thêm"));
  if (!btn) throw new Error("Không tìm thấy nút Thêm");
  return btn as HTMLButtonElement;
}

async function setInputValue(input: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("SynonymForm", () => {
  it("không submit khi synonym < 2 ký tự (validation client)", async () => {
    await renderForm(42);
    const input = getInput();
    await setInputValue(input, "x");

    await act(async () => {
      getSubmitBtn().click();
    });

    // AntD form validation chặn submit → mutateAsync KHÔNG được gọi
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("submit hợp lệ → gọi mutateAsync với productId + synonym + weight default", async () => {
    mockMutateAsync.mockResolvedValue(1);
    await renderForm(42);
    const input = getInput();
    await setInputValue(input, "xa20");

    await act(async () => {
      getSubmitBtn().click();
    });
    // Đợi microtask flush
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    const arg = mockMutateAsync.mock.calls[0]?.[0] as {
      productId: number;
      synonym: string;
      weight: number;
    };
    expect(arg.productId).toBe(42);
    expect(arg.synonym).toBe("xa20");
    expect(arg.weight).toBe(1.0);
  });
});
