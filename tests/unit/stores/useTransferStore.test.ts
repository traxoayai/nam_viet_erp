import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks (available inside vi.mock factories) ---
const { mockSafeRpc, mockMessage } = vi.hoisted(() => ({
  mockSafeRpc: vi.fn(),
  mockMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));

vi.mock("antd", () => ({
  message: mockMessage,
}));

vi.mock("@/features/inventory/api/transferService", () => ({
  transferService: {
    fetchTransfers: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    getTransferDetail: vi.fn().mockResolvedValue(null),
    fetchSourceBatches: vi.fn().mockResolvedValue([]),
    fetchBatchesForTransfer: vi.fn().mockResolvedValue({}),
    createAutoReplenishment: vi.fn().mockResolvedValue(null),
    approveTransfer: vi.fn().mockResolvedValue(null),
    cancelTransfer: vi.fn().mockResolvedValue(null),
    deleteTransfer: vi.fn().mockResolvedValue(null),
    deleteTransferItem: vi.fn().mockResolvedValue(null),
    updateTransferStatus: vi.fn().mockResolvedValue(null),
    checkAvailability: vi.fn().mockResolvedValue(0),
    createManualTransfer: vi.fn().mockResolvedValue(null),
  },
}));

// Mock useAuthStore for confirmTransferInbound
vi.mock("@/features/auth/stores/useAuthStore", () => ({
  useAuthStore: {
    getState: () => ({
      profile: { warehouse_id: 5, branch_id: 5 },
    }),
  },
}));

// --- Import store AFTER mocks ---
import { useTransferStore } from "@/features/inventory/stores/useTransferStore";

describe("useTransferStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTransferStore.setState({
      transfers: [],
      currentTransfer: null,
      shippingDraft: {},
      availableBatchesMap: {},
      scannedCode: "",
      isAllocationDone: false,
      loading: false,
      totalCount: 0,
    });
  });

  describe("submitTransferShipment (confirmOutbound)", () => {
    it("calls safeRpc with 'confirm_transfer_outbound_fefo' and transfer id", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });

      // Set current transfer so the action doesn't early-return
      useTransferStore.setState({
        currentTransfer: {
          id: 42,
          source_warehouse_id: 1,
          dest_warehouse_id: 2,
          items: [],
        } as any,
      });

      await useTransferStore.getState().submitTransferShipment();

      expect(mockSafeRpc).toHaveBeenCalledWith("confirm_transfer_outbound_fefo", {
        p_transfer_id: 42,
      });
    });

    it("shows success message on successful outbound", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });

      useTransferStore.setState({
        currentTransfer: {
          id: 10,
          source_warehouse_id: 1,
          dest_warehouse_id: 2,
          items: [],
        } as any,
      });

      await useTransferStore.getState().submitTransferShipment();

      expect(mockMessage.success).toHaveBeenCalledWith(
        "Xuất kho thành công! Hệ thống đã tự động chọn lô (FEFO)."
      );
    });

    it("returns false when no currentTransfer is set", async () => {
      useTransferStore.setState({ currentTransfer: null });

      const result = await useTransferStore.getState().submitTransferShipment();

      expect(result).toBe(false);
      expect(mockSafeRpc).not.toHaveBeenCalled();
    });

    it("shows error message on RPC failure", async () => {
      mockSafeRpc.mockRejectedValue(new Error("Kho khong du hang"));

      useTransferStore.setState({
        currentTransfer: {
          id: 10,
          source_warehouse_id: 1,
          dest_warehouse_id: 2,
          items: [],
        } as any,
      });

      const result = await useTransferStore.getState().submitTransferShipment();

      expect(result).toBe(false);
      expect(mockMessage.error).toHaveBeenCalledWith("Kho khong du hang");
    });
  });

  describe("confirmTransferInbound", () => {
    it("calls safeRpc with 'confirm_transfer_inbound' and correct params", async () => {
      mockSafeRpc.mockResolvedValue({ data: { items_processed: 3 } });

      useTransferStore.setState({
        currentTransfer: {
          id: 77,
          source_warehouse_id: 1,
          dest_warehouse_id: 5, // Must match user's warehouse
          items: [],
        } as any,
      });

      await useTransferStore.getState().confirmTransferInbound();

      expect(mockSafeRpc).toHaveBeenCalledWith("confirm_transfer_inbound", {
        p_transfer_id: 77,
        p_actor_warehouse_id: 5,
      });
    });

    it("uses overrideWarehouseId when provided", async () => {
      mockSafeRpc.mockResolvedValue({ data: { items_processed: 2 } });

      useTransferStore.setState({
        currentTransfer: {
          id: 88,
          source_warehouse_id: 1,
          dest_warehouse_id: 9, // Must match override
          items: [],
        } as any,
      });

      await useTransferStore.getState().confirmTransferInbound(9);

      expect(mockSafeRpc).toHaveBeenCalledWith("confirm_transfer_inbound", {
        p_transfer_id: 88,
        p_actor_warehouse_id: 9,
      });
    });

    it("shows success message with items_processed count", async () => {
      mockSafeRpc.mockResolvedValue({ data: { items_processed: 5 } });

      useTransferStore.setState({
        currentTransfer: {
          id: 77,
          source_warehouse_id: 1,
          dest_warehouse_id: 5,
          items: [],
        } as any,
      });

      await useTransferStore.getState().confirmTransferInbound();

      expect(mockMessage.success).toHaveBeenCalledWith(
        "Nhập kho thành công! Đã cộng tồn kho cho 5 lô hàng."
      );
    });

    it("returns false when currentTransfer is null", async () => {
      useTransferStore.setState({ currentTransfer: null });

      const result = await useTransferStore.getState().confirmTransferInbound();

      expect(result).toBe(false);
      expect(mockSafeRpc).not.toHaveBeenCalled();
    });

    it("returns false when warehouse mismatch", async () => {
      useTransferStore.setState({
        currentTransfer: {
          id: 77,
          source_warehouse_id: 1,
          dest_warehouse_id: 99, // Different from user warehouse (5)
          items: [],
        } as any,
      });

      const result = await useTransferStore.getState().confirmTransferInbound();

      expect(result).toBe(false);
      expect(mockSafeRpc).not.toHaveBeenCalled();
      expect(mockMessage.error).toHaveBeenCalled();
    });

    it("shows error message on RPC failure", async () => {
      mockSafeRpc.mockRejectedValue(new Error("Inbound failed"));

      useTransferStore.setState({
        currentTransfer: {
          id: 77,
          source_warehouse_id: 1,
          dest_warehouse_id: 5,
          items: [],
        } as any,
      });

      const result = await useTransferStore.getState().confirmTransferInbound();

      expect(result).toBe(false);
      expect(mockMessage.error).toHaveBeenCalledWith("Inbound failed");
    });
  });
});
