import { describe, it, expect } from "vitest";
import { adminClient } from "../helpers/supabase";

/**
 * Portal B2B RPCs introduced/extended in migrations 20260409100000, 20260410120000.
 * Guards against PostgREST PGRST202 (missing fn) / PGRST203 (overload ambiguity).
 */
describe("B2B Portal catalog RPCs", () => {
  it("get_wholesale_catalog — portal-style payload (8 params, no multi-filter extras)", async () => {
    const { error } = await adminClient.rpc("get_wholesale_catalog", {
      p_search: "",
      p_category: "",
      p_manufacturer: "",
      p_price_min: 0,
      p_price_max: 0,
      p_page: 1,
      p_page_size: 5,
      p_sort: "best-seller",
    });
    expect(error?.code).not.toBe("PGRST202");
    expect(error?.code).not.toBe("PGRST203");
    if (error) {
      expect(error.message).not.toMatch(/Could not find|Ambiguous/i);
    }
  });

  it("get_wholesale_catalog — explicit new multi-filter params (empty)", async () => {
    const { error } = await adminClient.rpc("get_wholesale_catalog", {
      p_search: "",
      p_category: "",
      p_manufacturer: "",
      p_price_min: 0,
      p_price_max: 0,
      p_page: 1,
      p_page_size: 5,
      p_sort: "best-seller",
      p_categories: "",
      p_manufacturers: "",
      p_countries: "",
      p_dosage_forms: "",
    });
    expect(error?.code).not.toBe("PGRST202");
    expect(error?.code).not.toBe("PGRST203");
  });

  it("get_product_batch_info — exists for a real product", async () => {
    const { data: prod } = await adminClient
      .from("products")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!prod) return;
    const { error } = await adminClient.rpc("get_product_batch_info", {
      p_product_id: prod.id,
    });
    expect(error?.code).not.toBe("PGRST202");
    expect(error?.code).not.toBe("PGRST203");
  });

  it("get_customer_purchase_stats — exists for a real B2B customer", async () => {
    const { data: row } = await adminClient
      .from("customers_b2b")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!row) return;
    const { error } = await adminClient.rpc("get_customer_purchase_stats", {
      p_customer_id: row.id,
      p_limit: 5,
    });
    expect(error?.code).not.toBe("PGRST202");
    expect(error?.code).not.toBe("PGRST203");
  });
});
