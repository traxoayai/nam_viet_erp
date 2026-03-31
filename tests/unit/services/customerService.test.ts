import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSafeRpc = vi.fn();

vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));
vi.mock("@/shared/api/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));
vi.mock("@/shared/api/storageService", () => ({
  uploadFile: vi.fn(),
}));
vi.mock("xlsx", () => ({
  read: vi.fn(),
  utils: { sheet_to_json: vi.fn() },
}));

import {
  fetchCustomers,
  fetchCustomerDetails,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  reactivateCustomer,
  exportCustomers,
  searchGuardians,
} from "@/features/sales/api/customerService";

describe("customerService", () => {
  beforeEach(() => {
    mockSafeRpc.mockReset();
  });

  // --- fetchCustomers ---
  describe("fetchCustomers", () => {
    it("calls get_customers_b2c_list with correct params", async () => {
      mockSafeRpc.mockResolvedValue({ data: [{ id: 1, name: "KH1", total_count: 25 }] });
      const result = await fetchCustomers(
        { search_query: "Nguyen", type_filter: "CaNhan", status_filter: "active" },
        2, 10, "desc"
      );
      expect(mockSafeRpc).toHaveBeenCalledWith("get_customers_b2c_list", {
        search_query: "Nguyen",
        type_filter: "CaNhan",
        status_filter: "active",
        page_num: 2,
        page_size: 10,
        sort_by_debt: "desc",
      });
      expect(result.totalCount).toBe(25);
      expect(result.data).toHaveLength(1);
    });

    it("returns empty data and 0 count when data is null", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await fetchCustomers({}, 1, 20);
      expect(result).toEqual({ data: [], totalCount: 0 });
    });

    it("defaults sortByDebt to null", async () => {
      mockSafeRpc.mockResolvedValue({ data: [] });
      await fetchCustomers({}, 1, 20);
      expect(mockSafeRpc).toHaveBeenCalledWith("get_customers_b2c_list", expect.objectContaining({
        sort_by_debt: null,
      }));
    });
  });

  // --- fetchCustomerDetails ---
  describe("fetchCustomerDetails", () => {
    it("calls get_customer_b2c_details with p_id", async () => {
      mockSafeRpc.mockResolvedValue({ data: { id: 5, name: "Chi Lan" } });
      const result = await fetchCustomerDetails(5);
      expect(mockSafeRpc).toHaveBeenCalledWith("get_customer_b2c_details", { p_id: 5 });
      expect(result).toEqual({ id: 5, name: "Chi Lan" });
    });
  });

  // --- createCustomer ---
  describe("createCustomer", () => {
    it("calls create_customer_b2c with data and guardians", async () => {
      mockSafeRpc.mockResolvedValue({ data: 42 });
      const customerData = { name: "Tran Van B", phone: "0912345678" };
      const guardians = [{ name: "Nguyen Van C", phone: "0901234567" }];
      const result = await createCustomer(customerData, guardians);
      expect(mockSafeRpc).toHaveBeenCalledWith("create_customer_b2c", {
        p_customer_data: customerData,
        p_guardians: guardians,
      });
      expect(result).toBe(42);
    });
  });

  // --- updateCustomer ---
  describe("updateCustomer", () => {
    it("calls update_customer_b2c with id, data, and guardians", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await updateCustomer(5, { name: "Updated" }, []);
      expect(mockSafeRpc).toHaveBeenCalledWith("update_customer_b2c", {
        p_id: 5,
        p_customer_data: { name: "Updated" },
        p_guardians: [],
      });
      expect(result).toBe(true);
    });
  });

  // --- deleteCustomer ---
  describe("deleteCustomer", () => {
    it("calls delete_customer_b2c with p_id", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await deleteCustomer(10);
      expect(mockSafeRpc).toHaveBeenCalledWith("delete_customer_b2c", { p_id: 10 });
      expect(result).toBe(true);
    });
  });

  // --- reactivateCustomer ---
  describe("reactivateCustomer", () => {
    it("calls reactivate_customer_b2c with p_id", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await reactivateCustomer(10);
      expect(mockSafeRpc).toHaveBeenCalledWith("reactivate_customer_b2c", { p_id: 10 });
      expect(result).toBe(true);
    });
  });

  // --- exportCustomers ---
  describe("exportCustomers", () => {
    it("calls export_customers_b2c_list with filters", async () => {
      mockSafeRpc.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] });
      const result = await exportCustomers({
        search_query: "test",
        type_filter: "ToChuc",
        status_filter: "active",
      });
      expect(mockSafeRpc).toHaveBeenCalledWith("export_customers_b2c_list", {
        search_query: "test",
        type_filter: "ToChuc",
        status_filter: "active",
      });
      expect(result).toHaveLength(2);
    });

    it("returns empty array when data is null", async () => {
      mockSafeRpc.mockResolvedValue({ data: null });
      const result = await exportCustomers({});
      expect(result).toEqual([]);
    });
  });

  // --- searchGuardians (searchByPhone) ---
  describe("searchGuardians", () => {
    it("calls search_customers_by_phone_b2c with query", async () => {
      mockSafeRpc.mockResolvedValue({ data: [{ id: 1, phone: "0901234567" }] });
      const result = await searchGuardians("0901");
      expect(mockSafeRpc).toHaveBeenCalledWith("search_customers_by_phone_b2c", {
        p_search_query: "0901",
      });
      expect(result).toEqual([{ id: 1, phone: "0901234567" }]);
    });

    it("returns empty array for short queries (< 3 chars)", async () => {
      const result = await searchGuardians("09");
      expect(mockSafeRpc).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("returns empty array for empty query", async () => {
      const result = await searchGuardians("");
      expect(mockSafeRpc).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
});
