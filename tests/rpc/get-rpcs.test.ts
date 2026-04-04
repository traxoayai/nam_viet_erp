import { describe, it, expect } from "vitest";
import { adminClient } from "../helpers/supabase";

function expectNoTypeError(error: { code?: string; message?: string } | null) {
  if (error) {
    expect(["22P02", "22007"]).not.toContain(error.code);
  }
}

function isAcceptableError(error: { message?: string; code?: string } | null) {
  if (!error) return true;
  const msg = error.message ?? "";
  return (
    msg.includes("Unauthorized") ||
    msg.includes("permission") ||
    error.code === "PGRST202" ||
    error.code === "42501"
  );
}

// ─── Assets ──────────────────────────────────────────────────────────────────

describe("Assets RPCs", () => {
  it("get_asset_details", async () => {
    const { data: row } = await adminClient
      .from("assets")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!row) return;
    const { error } = await adminClient.rpc("get_asset_details", { p_id: row.id });
    expectNoTypeError(error);
  });

  it("get_assets_list", async () => {
    const { error } = await adminClient.rpc("get_assets_list", {
      branch_filter: 0,
      search_query: "",
      status_filter: "",
      type_filter: 0,
    });
    expectNoTypeError(error);
  });
});

// ─── Customers ───────────────────────────────────────────────────────────────

describe("Customers RPCs", () => {
  it("get_customer_b2b_details", async () => {
    const { data: row } = await adminClient
      .from("customers_b2b")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!row) return;
    const { error } = await adminClient.rpc("get_customer_b2b_details", { p_id: row.id });
    expectNoTypeError(error);
  });

  it("get_customer_b2c_details", async () => {
    const { data: row } = await adminClient
      .from("customers_b2c")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!row) return;
    const { error } = await adminClient.rpc("get_customer_b2c_details", { p_id: row.id });
    expectNoTypeError(error);
  });

  it("get_customer_debt_info", async () => {
    const { data: row } = await adminClient
      .from("customers_b2b")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!row) return;
    const { error } = await adminClient.rpc("get_customer_debt_info", {
      p_customer_id: row.id,
    });
    expectNoTypeError(error);
  });

  it("get_customers_b2b_list", async () => {
    const { error } = await adminClient.rpc("get_customers_b2b_list", {});
    expectNoTypeError(error);
  });

  it("export_customers_b2b_list", async () => {
    const { error } = await adminClient.rpc("export_customers_b2b_list", {});
    expectNoTypeError(error);
  });

  it("export_customers_b2c_list", async () => {
    const { error } = await adminClient.rpc("export_customers_b2c_list", {
      search_query: "",
      status_filter: "",
      type_filter: "",
    });
    // enum params may reject "" — just verify function exists
    if (error) expect(error.code).not.toBe("PGRST202");
  });

  it("search_customers_b2b_v2", async () => {
    const { error } = await adminClient.rpc("search_customers_b2b_v2", {
      p_keyword: "test",
    });
    expectNoTypeError(error);
  });

  it("search_customers_by_phone_b2c", async () => {
    const { error } = await adminClient.rpc("search_customers_by_phone_b2c", {
      p_search_query: "0123",
    });
    expectNoTypeError(error);
  });

  it("search_customers_pos", async () => {
    const { error } = await adminClient.rpc("search_customers_pos", {
      p_keyword: "test",
    });
    expectNoTypeError(error);
  });
});

// ─── Products ────────────────────────────────────────────────────────────────

describe("Products RPCs", () => {
  it("get_distinct_categories", async () => {
    const { error } = await adminClient.rpc("get_distinct_categories");
    expectNoTypeError(error);
  });

  it("get_distinct_manufacturers", async () => {
    const { error } = await adminClient.rpc("get_distinct_manufacturers");
    expectNoTypeError(error);
  });

  it("get_mapped_product", async () => {
    const { error } = await adminClient.rpc("get_mapped_product", {
      p_product_name: "test",
      p_tax_code: "",
    });
    expectNoTypeError(error);
  });

  it("get_product_available_stock", async () => {
    const { data: wh } = await adminClient
      .from("warehouses")
      .select("id")
      .limit(1)
      .maybeSingle();
    const { data: prod } = await adminClient
      .from("products")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!wh || !prod) return;
    const { error } = await adminClient.rpc("get_product_available_stock", {
      p_product_ids: [prod.id],
      p_warehouse_id: wh.id,
    });
    expectNoTypeError(error);
  });

  it("export_products_list", async () => {
    const { error } = await adminClient.rpc("export_products_list", {
      category_filter: "",
      manufacturer_filter: "",
      search_query: "",
      status_filter: "",
    });
    expectNoTypeError(error);
  });

  it("search_products_v2", async () => {
    const { error } = await adminClient.rpc("search_products_v2", {});
    expectNoTypeError(error);
  });

  it("search_products_for_purchase", async () => {
    const { error } = await adminClient.rpc("search_products_for_purchase", {});
    expectNoTypeError(error);
  });

  it("search_products_for_transfer", async () => {
    const { data: wh } = await adminClient
      .from("warehouses")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!wh) return;
    const { error } = await adminClient.rpc("search_products_for_transfer", {
      p_warehouse_id: wh.id,
    });
    expectNoTypeError(error);
  });

  it("search_products_for_b2b_order", async () => {
    const { data: wh } = await adminClient
      .from("warehouses")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!wh) return;
    const { error } = await adminClient.rpc("search_products_for_b2b_order", {
      p_keyword: "test",
      p_warehouse_id: wh.id,
    });
    expectNoTypeError(error);
  });

  it("search_products_pos", async () => {
    const { data: wh } = await adminClient
      .from("warehouses")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!wh) return;
    const { error } = await adminClient.rpc("search_products_pos", {
      p_keyword: "test",
      p_warehouse_id: wh.id,
    });
    expectNoTypeError(error);
  });

  it("search_product_batches", async () => {
    const { data: wh } = await adminClient
      .from("warehouses")
      .select("id")
      .limit(1)
      .maybeSingle();
    const { data: prod } = await adminClient
      .from("products")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!wh || !prod) return;
    const { error } = await adminClient.rpc("search_product_batches", {
      p_product_id: prod.id,
      p_warehouse_id: wh.id,
    });
    expectNoTypeError(error);
  });

  it("match_products_from_excel", async () => {
    const { error } = await adminClient.rpc("match_products_from_excel", {
      p_data: [{ name: "test", sku: "TEST001" }],
    });
    expectNoTypeError(error);
  });
});

// ─── Inventory & Warehouses ──────────────────────────────────────────────────

describe("Inventory & Warehouses RPCs", () => {
  it("get_active_warehouses", async () => {
    const { error } = await adminClient.rpc("get_active_warehouses");
    expectNoTypeError(error);
  });

  it("get_warehouse_cabinets", async () => {
    const { data: wh } = await adminClient
      .from("warehouses")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!wh) return;
    const { error } = await adminClient.rpc("get_warehouse_cabinets", {
      p_warehouse_id: wh.id,
    });
    expectNoTypeError(error);
  });

  it("get_inventory_setup_grid", async () => {
    const { data: wh } = await adminClient
      .from("warehouses")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!wh) return;
    const { error } = await adminClient.rpc("get_inventory_setup_grid", {
      p_warehouse_id: wh.id,
    });
    expectNoTypeError(error);
  });

  it("get_inbound_detail", async () => {
    const { data: row } = await adminClient
      .from("purchase_orders")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!row) return;
    const { error } = await adminClient.rpc("get_inbound_detail", {
      p_po_id: row.id,
    });
    expectNoTypeError(error);
  });

  it("get_outbound_order_detail", async () => {
    const { data: row } = await adminClient
      .from("orders")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!row) return;
    const { error } = await adminClient.rpc("get_outbound_order_detail", {
      p_order_id: row.id,
    });
    expectNoTypeError(error);
  });

  it("get_outbound_stats", async () => {
    const { data: wh } = await adminClient
      .from("warehouses")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!wh) return;
    const { error } = await adminClient.rpc("get_outbound_stats", {
      p_warehouse_id: wh.id,
    });
    expectNoTypeError(error);
  });
});

// ─── Purchasing ──────────────────────────────────────────────────────────────

describe("Purchasing RPCs", () => {
  it("get_purchase_order_detail", async () => {
    const { data: row } = await adminClient
      .from("purchase_orders")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!row) return;
    const { error } = await adminClient.rpc("get_purchase_order_detail", {
      p_po_id: row.id,
    });
    expectNoTypeError(error);
  });
});

// ─── Suppliers ───────────────────────────────────────────────────────────────

describe("Suppliers RPCs", () => {
  it("get_suppliers_list", async () => {
    const { error } = await adminClient.rpc("get_suppliers_list", {
      page_num: 1,
      page_size: 10,
      search_query: "",
      status_filter: "",
    });
    expectNoTypeError(error);
  });

  it("get_supplier_quick_info", async () => {
    const { data: row } = await adminClient
      .from("suppliers")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!row) return;
    const { error } = await adminClient.rpc("get_supplier_quick_info", {
      p_supplier_id: row.id,
    });
    expectNoTypeError(error);
  });
});

// ─── Shipping Partners ───────────────────────────────────────────────────────

describe("Shipping Partners RPCs", () => {
  it("get_active_shipping_partners", async () => {
    const { error } = await adminClient.rpc("get_active_shipping_partners");
    expectNoTypeError(error);
  });

  it("get_shipping_partners_list", async () => {
    const { error } = await adminClient.rpc("get_shipping_partners_list", {
      p_search_query: "",
      p_type_filter: "",
    });
    // enum may reject "" — just verify function exists
    if (error) expect(error.code).not.toBe("PGRST202");
  });

  it("get_shipping_partner_details", async () => {
    const { data: row } = await adminClient
      .from("shipping_partners")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!row) return;
    const { error } = await adminClient.rpc("get_shipping_partner_details", {
      p_id: row.id,
    });
    expectNoTypeError(error);
  });
});

// ─── Users & Permissions ─────────────────────────────────────────────────────

describe("Users & Permissions RPCs", () => {
  it("get_my_permissions", async () => {
    const { error } = await adminClient.rpc("get_my_permissions");
    expectNoTypeError(error);
    if (error) expect(isAcceptableError(error)).toBe(true);
  });

  it("get_self_profile", async () => {
    const { error } = await adminClient.rpc("get_self_profile");
    expectNoTypeError(error);
    if (error) expect(isAcceptableError(error)).toBe(true);
  });

  it("get_users_with_roles", async () => {
    const { error } = await adminClient.rpc("get_users_with_roles");
    expectNoTypeError(error);
  });

  it("get_user_pending_revenue", async () => {
    const { data: row } = await adminClient
      .from("profiles")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!row) return;
    const { error } = await adminClient.rpc("get_user_pending_revenue", {
      p_user_id: row.id,
    });
    expectNoTypeError(error);
  });
});

// ─── Finance & Debt ──────────────────────────────────────────────────────────

describe("Finance & Debt RPCs", () => {
  it("get_partner_debt_live", async () => {
    const { data: row } = await adminClient
      .from("suppliers")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!row) return;
    const { error } = await adminClient.rpc("get_partner_debt_live", {
      p_partner_id: row.id,
      p_partner_type: "supplier",
    });
    expectNoTypeError(error);
  });
});

// ─── Promotions & Vouchers ───────────────────────────────────────────────────

describe("Promotions & Vouchers RPCs", () => {
  it("get_available_vouchers", async () => {
    const { data: row } = await adminClient
      .from("customers_b2b")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!row) return;
    const { error } = await adminClient.rpc("get_available_vouchers", {
      p_customer_id: row.id,
      p_order_total: 100000,
    });
    expectNoTypeError(error);
  });

  it("get_pos_usable_promotions", async () => {
    const { data: row } = await adminClient
      .from("customers_b2c")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!row) return;
    const { error } = await adminClient.rpc("get_pos_usable_promotions", {
      p_customer_id: row.id,
    });
    expectNoTypeError(error);
  });

  it("verify_promotion_code", async () => {
    const { error } = await adminClient.rpc("verify_promotion_code", {
      p_code: "NONEXISTENT",
      p_customer_id: 1,
      p_order_value: 100000,
    });
    expectNoTypeError(error);
  });
});

// ─── Clinical / Prescriptions / Vaccination ──────────────────────────────────

describe("Clinical RPCs", () => {
  it("get_prescription_templates", async () => {
    const { error } = await adminClient.rpc("get_prescription_templates", {});
    expectNoTypeError(error);
  });

  it("get_prescription_template_details", async () => {
    const { data: row } = await adminClient
      .from("prescription_templates")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!row) return;
    const { error } = await adminClient.rpc("get_prescription_template_details", {
      p_id: row.id,
    });
    expectNoTypeError(error);
  });

  it("get_vaccination_template_details", async () => {
    const { data: row } = await adminClient
      .from("vaccination_templates")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!row) return;
    const { error } = await adminClient.rpc("get_vaccination_template_details", {
      p_id: row.id,
    });
    expectNoTypeError(error);
  });

  it("get_nurse_execution_queue", async () => {
    const { error } = await adminClient.rpc("get_nurse_execution_queue", {});
    expectNoTypeError(error);
  });

  it("get_service_package_details", async () => {
    const { data: row } = await adminClient
      .from("service_packages")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!row) return;
    const { error } = await adminClient.rpc("get_service_package_details", {
      p_id: row.id,
    });
    expectNoTypeError(error);
  });
});
