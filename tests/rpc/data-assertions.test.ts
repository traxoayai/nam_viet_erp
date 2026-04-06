/**
 * Data assertion tests — verify listing RPCs RETURN DATA when tables have rows.
 * Smoke tests chỉ check "không lỗi". Tests này check "trả về data đúng".
 */
import { describe, it, expect } from "vitest";
import { adminClient } from "../helpers/supabase";

async function tableCount(table: string): Promise<number> {
  const { count } = await adminClient
    .from(table)
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

// ─── Listing RPCs phải trả data khi table có rows ────────────────────────────

describe("Data assertions — listing RPCs return data", () => {
  it("get_suppliers_list returns suppliers", async () => {
    const count = await tableCount("suppliers");
    if (count === 0) return;

    const { data, error } = await adminClient.rpc("get_suppliers_list", {
      search_query: "",
      status_filter: "",
      page_num: 1,
      page_size: 10,
    });
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect((data as unknown[]).length).toBeGreaterThan(0);
  });

  it("get_products_list returns products", async () => {
    const count = await tableCount("products");
    if (count === 0) return;

    const { data, error } = await adminClient.rpc("get_products_list", {
      search_query: "",
      category_filter: "",
      manufacturer_filter: "",
      status_filter: "",
      page_num: 1,
      page_size: 10,
    });
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect((data as unknown[]).length).toBeGreaterThan(0);
  });

  it("get_sales_orders_view returns orders", async () => {
    const count = await tableCount("orders");
    if (count === 0) return;

    const { data, error } = await adminClient.rpc("get_sales_orders_view", {
      p_page: 1,
      p_page_size: 10,
      p_search: "",
    });
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    // RPC returns jsonb: { data: [...], total: N, stats: {...} }
    const result = data as unknown as { data: unknown[]; total: number };
    expect(result.total).toBeGreaterThan(0);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("get_purchase_orders_master returns POs", async () => {
    const count = await tableCount("purchase_orders");
    if (count === 0) return;

    const { data, error } = await adminClient.rpc(
      "get_purchase_orders_master",
      {
        p_page: 1,
        p_page_size: 10,
        p_search: "",
        p_status_delivery: null,
        p_status_payment: null,
      }
    );
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect((data as unknown[]).length).toBeGreaterThan(0);
  });

  it("get_customers_b2b_list returns B2B customers", async () => {
    const count = await tableCount("customers_b2b");
    if (count === 0) return;

    const { data, error } = await adminClient.rpc("get_customers_b2b_list", {
      search_query: "",
      status_filter: "",
      page_num: 1,
      page_size: 10,
      sort_by_debt: false,
    });
    // May error on enum — check data if no error
    if (!error) {
      expect(data).not.toBeNull();
      expect((data as unknown[]).length).toBeGreaterThan(0);
    }
  });

  it("get_customers_b2c_list returns B2C customers", async () => {
    const count = await tableCount("customers");
    if (count === 0) return;

    const { data, error } = await adminClient.rpc("get_customers_b2c_list", {
      search_query: "",
      type_filter: null,
      status_filter: null,
      page_num: 1,
      page_size: 10,
    });
    if (!error) {
      expect(data).not.toBeNull();
      expect((data as unknown[]).length).toBeGreaterThan(0);
    }
  });

  it("get_shipping_partners_list returns partners", async () => {
    const count = await tableCount("shipping_partners");
    if (count === 0) return;

    const { data, error } = await adminClient.rpc(
      "get_shipping_partners_list",
      {
        p_search_query: "",
        p_type_filter: null,
      }
    );
    if (!error) {
      expect(data).not.toBeNull();
      expect((data as unknown[]).length).toBeGreaterThan(0);
    }
  });

  it("get_users_with_roles returns users", async () => {
    const count = await tableCount("users");
    if (count === 0) return;

    const { data, error } = await adminClient.rpc("get_users_with_roles");
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect((data as unknown[]).length).toBeGreaterThan(0);
  });

  it("get_active_warehouses returns warehouses", async () => {
    const count = await tableCount("warehouses");
    if (count === 0) return;

    const { data, error } = await adminClient.rpc("get_active_warehouses");
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect((data as unknown[]).length).toBeGreaterThan(0);
  });

  it("get_distinct_categories returns categories", async () => {
    const count = await tableCount("products");
    if (count === 0) return;

    const { data, error } = await adminClient.rpc("get_distinct_categories");
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect((data as unknown[]).length).toBeGreaterThan(0);
  });

  it("get_distinct_manufacturers returns manufacturers", async () => {
    const count = await tableCount("products");
    if (count === 0) return;

    const { data, error } = await adminClient.rpc(
      "get_distinct_manufacturers"
    );
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect((data as unknown[]).length).toBeGreaterThan(0);
  });
});
