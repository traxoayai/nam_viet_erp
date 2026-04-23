import { describe, it, expect } from "vitest";
import { adminClient } from "../helpers/supabase";

/**
 * Portal B2B RPCs introduced/extended in migrations 20260409100000, 20260410120000.
 * Guards against:
 *   - PostgREST PGRST202 (missing fn) / PGRST203 (overload ambiguity)
 *   - Postgres 42883 undefined_function — body references helper chưa define
 *     (regression: migration 20260423160000 gọi split_words_vn chưa có define)
 *   - Postgres 42P01 undefined_table, 42703 undefined_column — body stale schema
 * Execution-level errors (body runs nhưng fail) phải assert không có error,
 * không chỉ check code PGRST.
 */
describe("B2B Portal catalog RPCs", () => {
  const expectRpcExecutesCleanly = (error: { code?: string; message: string } | null) => {
    // Resolution errors
    expect(error?.code).not.toBe("PGRST202");
    expect(error?.code).not.toBe("PGRST203");
    // Body execution errors — đây là gap bản test cũ miss
    expect(error?.code).not.toBe("42883"); // undefined_function (missing helper)
    expect(error?.code).not.toBe("42P01"); // undefined_table
    expect(error?.code).not.toBe("42703"); // undefined_column
    expect(error?.code).not.toBe("42702"); // ambiguous_column
    if (error) {
      expect(error.message).not.toMatch(/does not exist|Could not find|Ambiguous/i);
    }
  };

  it("get_wholesale_catalog — portal-style payload (8 params, no multi-filter extras)", async () => {
    const { data, error } = await adminClient.rpc("get_wholesale_catalog", {
      p_search: "",
      p_category: "",
      p_manufacturer: "",
      p_price_min: 0,
      p_price_max: 0,
      p_page: 1,
      p_page_size: 5,
      p_sort: "best-seller",
    });
    expectRpcExecutesCleanly(error);
    // Body phải chạy xong và trả JSON shape đúng
    expect(error).toBeNull();
    expect(data).toBeTypeOf("object");
    const obj = data as Record<string, unknown>;
    expect(obj).toHaveProperty("data");
    expect(obj).toHaveProperty("total");
    expect(Array.isArray(obj.data)).toBe(true);
  });

  it("get_wholesale_catalog — với search keyword (exercise split_words_vn path)", async () => {
    // Regression guard: migration 20260423160000 gọi split_words_vn(p_search).
    // Test trước không set p_search nên không trigger bug → broken helper vẫn pass.
    // Phải test với search != '' để bắt buộc function chạy qua branch đó.
    const { data, error } = await adminClient.rpc("get_wholesale_catalog", {
      p_search: "para",
      p_category: "",
      p_manufacturer: "",
      p_price_min: 0,
      p_price_max: 0,
      p_page: 1,
      p_page_size: 5,
      p_sort: "best-seller",
    });
    expectRpcExecutesCleanly(error);
    expect(error).toBeNull();
    expect(data).toBeTypeOf("object");
  });

  it("get_wholesale_catalog — search multi-word (fuzzy AND logic)", async () => {
    const { error } = await adminClient.rpc("get_wholesale_catalog", {
      p_search: "eff 150",
      p_category: "",
      p_manufacturer: "",
      p_price_min: 0,
      p_price_max: 0,
      p_page: 1,
      p_page_size: 5,
      p_sort: "best-seller",
    });
    expectRpcExecutesCleanly(error);
    expect(error).toBeNull();
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
    expectRpcExecutesCleanly(error);
    expect(error).toBeNull();
  });

  it("get_wholesale_catalog — all sort options execute cleanly", async () => {
    const sorts = [
      "best-seller", "price-asc", "price-desc", "newest",
      "name-asc", "name-desc", "stock-asc", "stock-desc",
      "expiry-asc", "expiry-desc",
    ];
    for (const sort of sorts) {
      const { error } = await adminClient.rpc("get_wholesale_catalog", {
        p_search: "",
        p_category: "",
        p_manufacturer: "",
        p_price_min: 0,
        p_price_max: 0,
        p_page: 1,
        p_page_size: 3,
        p_sort: sort,
      });
      expectRpcExecutesCleanly(error);
      expect(error, `sort=${sort} phải chạy sạch`).toBeNull();
    }
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
    expectRpcExecutesCleanly(error);
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
    expectRpcExecutesCleanly(error);
  });
});
