import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSafeRpc = vi.fn();
vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));

// Mock antd message to prevent side effects
vi.mock("antd", () => ({
  message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

// We need React for hooks that use useState/useCallback
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return actual;
});

import { useBookingResources } from "@/features/booking/hooks/useBookingResources";

// Helper: since this is a React hook with useState, we extract the action functions
// by rendering the hook in a minimal way. But per the instructions, we can test
// the safeRpc calls by directly invoking the returned action functions.
// We'll use a simple approach: call the hook's internal logic by extracting it.

// For hooks using useState, we use a lightweight render approach
function renderHookSync<T>(hookFn: () => T): T {
  let result: T;
  const { createElement } = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");

  function TestComponent() {
    result = hookFn();
    return null;
  }

  renderToStaticMarkup(createElement(TestComponent));
  return result!;
}

describe("useBookingResources - safeRpc calls", () => {
  beforeEach(() => {
    mockSafeRpc.mockReset();
    mockSafeRpc.mockResolvedValue({ data: [], error: null });
  });

  it("searchCustomers calls safeRpc with get_customers_b2c_list and correct params", async () => {
    const hook = renderHookSync(() => useBookingResources());
    await hook.actions.searchCustomers("Nguyen");

    expect(mockSafeRpc).toHaveBeenCalledWith("get_customers_b2c_list", {
      search_query: "Nguyen",
      type_filter: null,
      status_filter: "active",
      page_num: 1,
      page_size: 20,
    });
  });

  it("fetchVaccines calls safeRpc with get_service_packages_list and correct params", async () => {
    const hook = renderHookSync(() => useBookingResources());
    await hook.actions.fetchVaccines("vaccine_keyword");

    expect(mockSafeRpc).toHaveBeenCalledWith("get_service_packages_list", {
      p_search_query: "vaccine_keyword",
      p_type_filter: "service",
      p_status_filter: "active",
      p_page_num: 1,
      p_page_size: 50,
    });
  });

  it("fetchVaccines defaults to empty keyword", async () => {
    const hook = renderHookSync(() => useBookingResources());
    await hook.actions.fetchVaccines();

    expect(mockSafeRpc).toHaveBeenCalledWith("get_service_packages_list", {
      p_search_query: "",
      p_type_filter: "service",
      p_status_filter: "active",
      p_page_num: 1,
      p_page_size: 50,
    });
  });

  it("createCustomer calls safeRpc with create_customer_b2c and correct params", async () => {
    const hook = renderHookSync(() => useBookingResources());
    const customerData = {
      name: "Tran Van A",
      phone: "0901234567",
      dob: "1990-01-01",
      gender: "male",
      address: "123 Street",
    };
    await hook.actions.createCustomer(customerData);

    expect(mockSafeRpc).toHaveBeenCalledWith("create_customer_b2c", {
      p_customer_data: {
        name: "Tran Van A",
        phone: "0901234567",
        dob: "1990-01-01",
        gender: "male",
        address: "123 Street",
      },
      p_guardians: [],
    });
  });

  it("updateCustomer calls safeRpc with update_customer_b2c and correct params", async () => {
    const hook = renderHookSync(() => useBookingResources());
    const customerData = {
      name: "Updated Name",
      phone: "0909999999",
      dob: "1985-06-15",
      gender: "female",
      address: "456 Avenue",
    };
    await hook.actions.updateCustomer(42, customerData);

    expect(mockSafeRpc).toHaveBeenCalledWith("update_customer_b2c", {
      p_id: 42,
      p_customer_data: {
        name: "Updated Name",
        phone: "0909999999",
        dob: "1985-06-15",
        gender: "female",
        address: "456 Avenue",
      },
    });
  });

  it("fetchDoctors calls safeRpc with get_users_with_roles", async () => {
    const hook = renderHookSync(() => useBookingResources());
    await hook.actions.fetchDoctors();

    expect(mockSafeRpc).toHaveBeenCalledWith("get_users_with_roles", undefined);
  });
});
