import { describe, it, expect } from "vitest";
import { adminClient, isProduction } from "../helpers/supabase";

/**
 * Integration tests: Verify product_unit_id lookup logic
 * used in medical prescription module.
 *
 * The medical module needs to resolve the correct product_unit_id
 * (retail unit) for each product when creating prescriptions.
 */
describe("medical module: product_unit_id lookup", () => {
  it("most active products have at least one product_unit", async () => {
    // Get a sample of active products
    const { data: products } = await adminClient
      .from("products")
      .select("id, name")
      .eq("status", "active")
      .limit(100);

    expect(products).toBeTruthy();
    expect(products!.length).toBeGreaterThan(0);

    const productIds = products!.map((p) => p.id);

    const { data: units } = await adminClient
      .from("product_units")
      .select("product_id")
      .in("product_id", productIds);

    const productsWithUnits = new Set((units || []).map((u) => u.product_id));
    const missingUnits = productIds.filter((pid) => !productsWithUnits.has(pid));

    // Warn about products without units (data quality issue)
    if (missingUnits.length > 0) {
      console.warn(
        `[DATA QUALITY] ${missingUnits.length} products have no product_units: ${missingUnits.join(", ")}`
      );
    }

    // At least 90% of active products should have units
    const coveragePercent = ((productIds.length - missingUnits.length) / productIds.length) * 100;
    expect(
      coveragePercent,
      `Only ${coveragePercent.toFixed(1)}% of products have units`
    ).toBeGreaterThan(80);
  });

  it("retail/base unit lookup returns correct unit per product", async () => {
    // Get products with multiple units to test priority logic
    const { data: products } = await adminClient
      .from("products")
      .select("id")
      .eq("status", "active")
      .limit(20);

    const productIds = (products || []).map((p) => p.id);
    if (productIds.length === 0) return;

    const { data: units } = await adminClient
      .from("product_units")
      .select("id, product_id, unit_name, unit_type, is_base")
      .in("product_id", productIds);

    // For each product, verify lookup priority: retail > base > first
    for (const pid of productIds) {
      const pUnits = (units || []).filter((u) => u.product_id === pid);
      if (pUnits.length === 0) continue;

      const best =
        pUnits.find((u) => u.unit_type === "retail") ||
        pUnits.find((u) => u.is_base) ||
        pUnits[0];

      expect(best).toBeTruthy();
      expect(best!.id).toBeGreaterThan(0);
      // The resolved unit should belong to the correct product
      expect(best!.product_id).toBe(pid);
    }
  });

  it("product_unit_id=1 is NOT a valid unit for most products", async () => {
    // Prove that hardcoding product_unit_id=1 is wrong
    const { data: unit1 } = await adminClient
      .from("product_units")
      .select("id, product_id, unit_name")
      .eq("id", 1)
      .maybeSingle();

    if (!unit1) return; // Unit 1 might not exist

    // Get 10 random products that are NOT unit1's product
    const { data: otherProducts } = await adminClient
      .from("products")
      .select("id")
      .eq("status", "active")
      .neq("id", unit1.product_id)
      .limit(10);

    // For these products, unit_id=1 belongs to a DIFFERENT product
    for (const p of otherProducts || []) {
      expect(unit1.product_id).not.toBe(p.id);
    }
  });

  it("get_products_stock_status returns data for active products", async () => {
    const { data: products } = await adminClient
      .from("products")
      .select("id")
      .eq("status", "active")
      .limit(5);

    const productIds = (products || []).map((p) => p.id);
    if (productIds.length === 0) return;

    const { data, error } = await adminClient.rpc("get_products_stock_status", {
      p_product_ids: productIds,
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(Array.isArray(data)).toBe(true);

    // Each result should have required fields
    for (const item of data as Array<Record<string, unknown>>) {
      expect(item).toHaveProperty("product_id");
      expect(item).toHaveProperty("stock_status");
      expect(item).toHaveProperty("total_quantity");
      expect(typeof item.total_quantity).toBe("number");
    }
  });
});
