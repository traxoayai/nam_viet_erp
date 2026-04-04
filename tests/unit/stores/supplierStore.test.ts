import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks (available inside vi.mock factories) ---
const { mockSafeRpc, mockSupabaseFrom } = vi.hoisted(() => ({
  mockSafeRpc: vi.fn(),
  mockSupabaseFrom: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}));

vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: (...args: any[]) => mockSupabaseFrom(...args),
  },
}));

// --- Import store AFTER mocks ---
import { useSupplierStore } from "@/features/purchasing/stores/supplierStore";

describe("useSupplierStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useSupplierStore.setState({
      suppliers: [],
      currentSupplier: null,
      loading: false,
      loadingDetails: false,
      filters: {},
      page: 1,
      pageSize: 10,
      totalCount: 0,
    });
  });

  describe("fetchSuppliers", () => {
    it("calls safeRpc with 'get_suppliers_list' and correct params", async () => {
      mockSafeRpc.mockResolvedValue({ data: [] });

      useSupplierStore.setState({
        filters: { search_query: "ABC", status_filter: "active" },
        page: 2,
        pageSize: 20,
      });

      await useSupplierStore.getState().fetchSuppliers();

      expect(mockSafeRpc).toHaveBeenCalledWith("get_suppliers_list", {
        search_query: "ABC",
        status_filter: "active",
        page_num: 2,
        page_size: 20,
      });
    });

    it("updates suppliers and totalCount from returned data", async () => {
      mockSafeRpc.mockResolvedValue({
        data: [
          { id: 1, name: "NCC A", debt: "500000", total_count: 42 },
          { id: 2, name: "NCC B", debt: null, total_count: 42 },
        ],
      });

      await useSupplierStore.getState().fetchSuppliers();

      const state = useSupplierStore.getState();
      expect(state.suppliers).toHaveLength(2);
      expect(state.suppliers[0].debt).toBe(500000);
      expect(state.suppliers[1].debt).toBe(0);
      expect(state.totalCount).toBe(42);
      expect(state.loading).toBe(false);
    });

    it("passes empty string for empty filter fields", async () => {
      mockSafeRpc.mockResolvedValue({ data: [] });

      useSupplierStore.setState({ filters: {}, page: 1, pageSize: 10 });
      await useSupplierStore.getState().fetchSuppliers();

      expect(mockSafeRpc).toHaveBeenCalledWith("get_suppliers_list", {
        search_query: "",
        status_filter: "",
        page_num: 1,
        page_size: 10,
      });
    });
  });

  describe("addSupplier", () => {
    it("calls safeRpc with 'create_supplier' and mapped params", async () => {
      // First call = create_supplier, second call = fetchSuppliers (inside addSupplier)
      mockSafeRpc.mockResolvedValue({ data: 123 });

      const values = {
        name: "NCC Test",
        tax_code: "123456",
        phone: "0909090909",
        email: "test@mail.com",
        status: "active",
      };

      await useSupplierStore.getState().addSupplier(values);

      expect(mockSafeRpc).toHaveBeenCalledWith("create_supplier", {
        p_name: "NCC Test",
        p_tax_code: "123456",
        p_contact_person: null,
        p_phone: "0909090909",
        p_email: "test@mail.com",
        p_address: null,
        p_payment_term: null,
        p_bank_account: null,
        p_bank_name: null,
        p_bank_holder: null,
        p_delivery_method: null,
        p_lead_time: null,
        p_status: "active",
        p_notes: null,
      });
    });
  });

  describe("updateSupplier", () => {
    it("calls safeRpc with 'update_supplier' and includes p_id", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });

      const values = {
        name: "NCC Updated",
        phone: "0123456789",
        status: "inactive",
      };

      await useSupplierStore.getState().updateSupplier(99, values);

      expect(mockSafeRpc).toHaveBeenCalledWith("update_supplier", {
        p_id: 99,
        p_name: "NCC Updated",
        p_tax_code: null,
        p_contact_person: null,
        p_phone: "0123456789",
        p_email: null,
        p_address: null,
        p_payment_term: null,
        p_bank_account: null,
        p_bank_name: null,
        p_bank_holder: null,
        p_delivery_method: null,
        p_lead_time: null,
        p_status: "inactive",
        p_notes: null,
      });
    });
  });

  describe("deleteSupplier", () => {
    it("calls safeRpc with 'delete_supplier' and p_id", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });

      await useSupplierStore.getState().deleteSupplier(55);

      expect(mockSafeRpc).toHaveBeenCalledWith("delete_supplier", { p_id: 55 });
    });
  });
});
