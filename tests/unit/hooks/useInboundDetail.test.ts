import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSafeRpc = vi.fn();
vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));

// Mock antd
vi.mock("antd", () => ({
  message: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
  },
  Modal: { confirm: vi.fn() },
}));

// Mock react-router-dom
vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(() => vi.fn()),
}));

// Mock inbound service
vi.mock("@/features/inventory/api/inboundService", () => ({
  inboundService: {
    submitReceipt: vi.fn(),
  },
}));

// Mock constants
vi.mock("@/shared/constants/defaults", () => ({
  DEFAULT_WAREHOUSE_ID: 1,
}));

// Mock the inbound store
const mockWorkingItems = [
  { product_id: 1, input_quantity: 10, input_lot: "LOT1", input_expiry: "2027-01-01" },
];
vi.mock("@/features/inventory/stores/useInboundStore", () => ({
  useInboundStore: vi.fn(() => ({
    detail: null,
    loading: false,
    error: null,
    workingItems: mockWorkingItems,
    fetchDetail: vi.fn(),
    updateWorkingItem: vi.fn(),
    resetDetail: vi.fn(),
  })),
}));

describe("useInboundDetail - safeRpc calls", () => {
  beforeEach(() => {
    mockSafeRpc.mockReset();
    mockSafeRpc.mockResolvedValue({ data: null, error: null });
  });

  it("handleSaveDraft calls safeRpc with save_inbound_draft and correct params", async () => {
    // Import after mocks are set up
    const { useInboundDetail } = await import(
      "@/features/inventory/hooks/useInboundDetail"
    );

    // We need to render the hook to get handleSaveDraft
    const { createElement } = require("react");
    const { renderToStaticMarkup } = require("react-dom/server");

    let hookResult: ReturnType<typeof useInboundDetail>;
    function TestComponent() {
      hookResult = useInboundDetail("42");
      return null;
    }
    renderToStaticMarkup(createElement(TestComponent));

    await hookResult!.handleSaveDraft();

    expect(mockSafeRpc).toHaveBeenCalledWith("save_inbound_draft", {
      p_po_id: 42,
      p_draft_data: mockWorkingItems,
    });
  });

  it("save_inbound_draft passes p_po_id as a number", async () => {
    const { useInboundDetail } = await import(
      "@/features/inventory/hooks/useInboundDetail"
    );

    const { createElement } = require("react");
    const { renderToStaticMarkup } = require("react-dom/server");

    let hookResult: ReturnType<typeof useInboundDetail>;
    function TestComponent() {
      hookResult = useInboundDetail("99");
      return null;
    }
    renderToStaticMarkup(createElement(TestComponent));

    await hookResult!.handleSaveDraft();

    const call = mockSafeRpc.mock.calls.find(
      (c: any[]) => c[0] === "save_inbound_draft"
    );
    expect(call).toBeDefined();
    expect(typeof call![1].p_po_id).toBe("number");
    expect(call![1].p_po_id).toBe(99);
  });

  it("handleSaveDraft does nothing when id is undefined", async () => {
    const { useInboundDetail } = await import(
      "@/features/inventory/hooks/useInboundDetail"
    );

    const { createElement } = require("react");
    const { renderToStaticMarkup } = require("react-dom/server");

    let hookResult: ReturnType<typeof useInboundDetail>;
    function TestComponent() {
      hookResult = useInboundDetail(undefined);
      return null;
    }
    renderToStaticMarkup(createElement(TestComponent));

    await hookResult!.handleSaveDraft();

    expect(mockSafeRpc).not.toHaveBeenCalled();
  });
});
