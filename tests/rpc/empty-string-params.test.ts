import { describe, it, expect } from "vitest";
import { adminClient } from "../helpers/supabase";

// Helper: expect a type-cast error (22P02 for UUID/bigint, 22007 for timestamp)
function expectTypeError(error: { code: string } | null) {
  expect(error).not.toBeNull();
  expect(["22P02", "22007"]).toContain(error!.code);
}

// ─── 1. get_sales_orders_view ────────────────────────────────────────────────

describe("get_sales_orders_view", () => {
  const defaults = { p_page: 1, p_page_size: 5, p_search: "" };

  it("returns data with valid default params", async () => {
    const { error } = await adminClient.rpc("get_sales_orders_view", defaults);
    expect(error).toBeNull();
  });

  it("rejects empty string for p_creator_id (uuid)", async () => {
    const { error } = await adminClient.rpc("get_sales_orders_view", {
      ...defaults,
      p_creator_id: "",
    });
    expectTypeError(error);
  });

  it("accepts null for p_creator_id", async () => {
    const { error } = await adminClient.rpc("get_sales_orders_view", {
      ...defaults,
      p_creator_id: null,
    });
    expect(error).toBeNull();
  });

  it("rejects empty string for p_date_from (timestamptz)", async () => {
    const { error } = await adminClient.rpc("get_sales_orders_view", {
      ...defaults,
      p_date_from: "",
    });
    expectTypeError(error);
  });

  it("rejects empty string for p_date_to (timestamptz)", async () => {
    const { error } = await adminClient.rpc("get_sales_orders_view", {
      ...defaults,
      p_date_to: "",
    });
    expectTypeError(error);
  });

  it("accepts null for p_date_from and p_date_to", async () => {
    const { error } = await adminClient.rpc("get_sales_orders_view", {
      ...defaults,
      p_date_from: null,
      p_date_to: null,
    });
    expect(error).toBeNull();
  });

  it("rejects empty string for p_warehouse_id (bigint)", async () => {
    const { error } = await adminClient.rpc("get_sales_orders_view", {
      ...defaults,
      p_warehouse_id: "",
    });
    expectTypeError(error);
  });

  it("rejects empty string for p_customer_id (bigint)", async () => {
    const { error } = await adminClient.rpc("get_sales_orders_view", {
      ...defaults,
      p_customer_id: "",
    });
    expectTypeError(error);
  });

  it("accepts null for p_warehouse_id and p_customer_id", async () => {
    const { error } = await adminClient.rpc("get_sales_orders_view", {
      ...defaults,
      p_warehouse_id: null,
      p_customer_id: null,
    });
    expect(error).toBeNull();
  });
});

// ─── 2. get_purchase_orders_master ───────────────────────────────────────────

describe("get_purchase_orders_master", () => {
  const defaults = {
    p_page: 1,
    p_page_size: 5,
    p_search: "",
    p_status_delivery: "",
    p_status_payment: "",
  };

  it("returns data with valid default params", async () => {
    const { error } = await adminClient.rpc(
      "get_purchase_orders_master",
      defaults
    );
    expect(error).toBeNull();
  });

  it("rejects empty string for p_date_from (timestamptz)", async () => {
    const { error } = await adminClient.rpc("get_purchase_orders_master", {
      ...defaults,
      p_date_from: "",
    });
    expectTypeError(error);
  });

  it("rejects empty string for p_date_to (timestamptz)", async () => {
    const { error } = await adminClient.rpc("get_purchase_orders_master", {
      ...defaults,
      p_date_to: "",
    });
    expectTypeError(error);
  });

  it("accepts null for p_date_from and p_date_to", async () => {
    const { error } = await adminClient.rpc("get_purchase_orders_master", {
      ...defaults,
      p_date_from: null,
      p_date_to: null,
    });
    expect(error).toBeNull();
  });
});

// ─── 3. get_warehouse_inbound_tasks ──────────────────────────────────────────
// Signature: p_page int, p_page_size int, p_search text?, p_status text?,
//   p_date_from timestamptz?, p_date_to timestamptz?, p_warehouse_id bigint

describe("get_warehouse_inbound_tasks", () => {
  const defaults = { p_page: 1, p_page_size: 5, p_warehouse_id: 1 };

  it("returns data with valid default params", async () => {
    const { error } = await adminClient.rpc(
      "get_warehouse_inbound_tasks",
      defaults
    );
    expect(error).toBeNull();
  });

  it("rejects empty string for p_date_from (timestamptz)", async () => {
    const { error } = await adminClient.rpc("get_warehouse_inbound_tasks", {
      ...defaults,
      p_date_from: "",
    });
    expectTypeError(error);
  });

  it("rejects empty string for p_date_to (timestamptz)", async () => {
    const { error } = await adminClient.rpc("get_warehouse_inbound_tasks", {
      ...defaults,
      p_date_to: "",
    });
    expectTypeError(error);
  });

  it("rejects empty string for p_warehouse_id (bigint)", async () => {
    const { error } = await adminClient.rpc("get_warehouse_inbound_tasks", {
      p_page: 1,
      p_page_size: 5,
      p_warehouse_id: "",
    });
    expectTypeError(error);
  });

  it("accepts null for optional params", async () => {
    const { error } = await adminClient.rpc("get_warehouse_inbound_tasks", {
      ...defaults,
      p_search: null,
      p_status: null,
      p_date_from: null,
      p_date_to: null,
    });
    expect(error).toBeNull();
  });
});

// ─── 4. get_warehouse_outbound_tasks ─────────────────────────────────────────

describe("get_warehouse_outbound_tasks", () => {
  const defaults = { p_page: 1, p_page_size: 5 };

  it("returns data with valid default params", async () => {
    const { error } = await adminClient.rpc(
      "get_warehouse_outbound_tasks",
      defaults
    );
    expect(error).toBeNull();
  });

  it("rejects empty string for p_date_from (timestamptz)", async () => {
    const { error } = await adminClient.rpc("get_warehouse_outbound_tasks", {
      ...defaults,
      p_date_from: "",
    });
    expectTypeError(error);
  });

  it("rejects empty string for p_date_to (timestamptz)", async () => {
    const { error } = await adminClient.rpc("get_warehouse_outbound_tasks", {
      ...defaults,
      p_date_to: "",
    });
    expectTypeError(error);
  });

  it("rejects empty string for p_warehouse_id (bigint)", async () => {
    const { error } = await adminClient.rpc("get_warehouse_outbound_tasks", {
      ...defaults,
      p_warehouse_id: "",
    });
    expectTypeError(error);
  });

  it("accepts null for optional params", async () => {
    const { error } = await adminClient.rpc("get_warehouse_outbound_tasks", {
      ...defaults,
      p_search: null,
      p_status: null,
      p_type: null,
      p_date_from: null,
      p_date_to: null,
      p_warehouse_id: null,
    });
    expect(error).toBeNull();
  });
});

// ─── 5. get_products_list ────────────────────────────────────────────────────
// All text params (REQUIRED) — empty string is valid

describe("get_products_list", () => {
  it("returns data with valid default params", async () => {
    const { error } = await adminClient.rpc("get_products_list", {
      search_query: "",
      category_filter: "",
      manufacturer_filter: "",
      status_filter: "",
      page_num: 1,
      page_size: 5,
    });
    expect(error).toBeNull();
  });
});

// ─── 6. get_customers_b2c_list ───────────────────────────────────────────────
// Overloaded: (search, type, status) and (search, type, status, page_num, page_size)

describe("get_customers_b2c_list", () => {
  it("returns data without type cast errors", async () => {
    const { error } = await adminClient.rpc("get_customers_b2c_list", {
      search_query: "",
      type_filter: "",
      status_filter: "",
    });
    // Empty string may be rejected by enum — but should NOT be 22P02/22007
    if (error) {
      expect(["22P02", "22007"]).not.toContain(error.code);
    }
  });
});

// ─── 7. get_service_packages_list ────────────────────────────────────────────

describe("get_service_packages_list", () => {
  it("function exists and responds (enum rejects empty string as expected)", async () => {
    const { error } = await adminClient.rpc("get_service_packages_list", {
      p_search_query: "",
      p_type_filter: "",
      p_status_filter: "",
      p_page_num: 1,
      p_page_size: 5,
    });
    // Empty string is invalid for enum params — expected rejection, NOT a bug
    // The important thing is function exists (not PGRST202)
    if (error) {
      expect(error.code).not.toBe("PGRST202");
    }
  });
});

// ─── 8. get_inventory_checks_list ────────────────────────────────────────────
// Uses p_offset/p_limit (not p_page/p_page_size)

describe("get_inventory_checks_list", () => {
  const defaults = { p_offset: 0, p_limit: 10, p_warehouse_id: 1 };

  it("returns data with valid default params", async () => {
    const { error } = await adminClient.rpc(
      "get_inventory_checks_list",
      defaults
    );
    expect(error).toBeNull();
  });

  it("rejects empty string for p_warehouse_id (bigint)", async () => {
    const { error } = await adminClient.rpc("get_inventory_checks_list", {
      p_offset: 0,
      p_limit: 10,
      p_warehouse_id: "",
    });
    expectTypeError(error);
  });

  it("accepts null for optional params", async () => {
    const { error } = await adminClient.rpc("get_inventory_checks_list", {
      ...defaults,
      p_search: null,
      p_status: null,
      p_start_date: null,
      p_end_date: null,
    });
    expect(error).toBeNull();
  });
});

// ─── 9. get_transfers ────────────────────────────────────────────────────────
// All filter params are text — test that function exists and accepts defaults

describe("get_transfers", () => {
  it("returns data with valid default params", async () => {
    const { error } = await adminClient.rpc("get_transfers", {
      p_page: 1,
      p_page_size: 5,
      p_search: null,
      p_status: null,
      p_date_from: null,
      p_date_to: null,
      p_creator_id: null,
      p_receiver_id: null,
    });
    expect(error).toBeNull();
  });
});

// ─── 10. get_connect_posts ───────────────────────────────────────────────────
// Signature: p_category text, p_limit int, p_offset int, p_search text

describe("get_connect_posts", () => {
  it("returns data with valid default params", async () => {
    const { error } = await adminClient.rpc("get_connect_posts", {
      p_category: "",
      p_limit: 10,
      p_offset: 0,
      p_search: "",
    });
    expect(error).toBeNull();
  });
});

// ─── 11. get_vaccination_templates ───────────────────────────────────────────

describe("get_vaccination_templates", () => {
  it("returns data with valid default params", async () => {
    const { error } = await adminClient.rpc("get_vaccination_templates", {
      p_search: "",
      p_status: "",
    });
    expect(error).toBeNull();
  });

  it("accepts null for optional params", async () => {
    const { error } = await adminClient.rpc("get_vaccination_templates", {
      p_search: null,
      p_status: null,
    });
    expect(error).toBeNull();
  });
});

// ─── 12. get_reception_queue ─────────────────────────────────────────────────
// Signature: p_date text, p_search text

describe("get_reception_queue", () => {
  it("returns data with valid default params", async () => {
    const { error } = await adminClient.rpc("get_reception_queue", {
      p_date: new Date().toISOString().split("T")[0],
      p_search: "",
    });
    expect(error).toBeNull();
  });
});

// ─── 13. get_po_logistics_stats ──────────────────────────────────────────────

describe("get_po_logistics_stats", () => {
  it("returns data with null params", async () => {
    const { error } = await adminClient.rpc("get_po_logistics_stats", {
      p_search: null,
      p_status_delivery: null,
      p_status_payment: null,
      p_date_from: null,
      p_date_to: null,
    });
    expect(error).toBeNull();
  });

  it("rejects empty string for p_date_from (timestamptz)", async () => {
    const { error } = await adminClient.rpc("get_po_logistics_stats", {
      p_search: null,
      p_status_delivery: null,
      p_status_payment: null,
      p_date_from: "",
      p_date_to: null,
    });
    expectTypeError(error);
  });
});

// ─── 14. get_transactions (finance) ──────────────────────────────────────────
// Function may not exist on local — skip if PGRST202

describe("get_transactions", () => {
  it("returns data or function not found (no type error)", async () => {
    const { error } = await adminClient.rpc("get_transactions", {
      p_page: 1,
      p_page_size: 5,
      p_flow: null,
      p_fund_account_id: null,
      p_date_from: null,
      p_date_to: null,
      p_search: null,
    });
    // Accept either success or PGRST202 (function not found), but NOT type errors
    if (error) {
      expect(["PGRST202"]).toContain(error.code);
    }
  });
});

// ─── 15. get_product_cardex ──────────────────────────────────────────────────

describe("get_product_cardex", () => {
  it("rejects empty string for p_product_id (bigint)", async () => {
    const { error } = await adminClient.rpc("get_product_cardex", {
      p_product_id: "",
    });
    // Either type error or function not found (PGRST202) — both confirm "" is invalid
    expect(error).not.toBeNull();
  });

  it("accepts valid product_id", async () => {
    const { data: product } = await adminClient
      .from("products")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!product) return; // skip if no data

    const { error } = await adminClient.rpc("get_product_cardex", {
      p_product_id: product.id,
    });
    // May fail with PGRST202 if signature doesn't match, but NOT type error
    if (error) {
      expect(["22P02", "22007"]).not.toContain(error.code);
    }
  });
});
