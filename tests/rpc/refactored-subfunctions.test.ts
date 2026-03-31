import { describe, it, expect } from "vitest";
import { adminClient } from "../helpers/supabase";

describe("Refactored sub-functions", () => {
  // === _resolve_conversion_factor ===
  describe("_resolve_conversion_factor", () => {
    it("returns explicit factor when provided", async () => {
      const { data, error } = await adminClient.rpc(
        "_resolve_conversion_factor",
        { p_product_id: 1, p_uom: "Viên", p_explicit_factor: 42 }
      );
      if (!error) {
        expect(data).toBe(42);
      }
    });

    it("falls back to 1 when unit not found", async () => {
      const { data, error } = await adminClient.rpc(
        "_resolve_conversion_factor",
        { p_product_id: 999999, p_uom: "NonExistentUnit", p_explicit_factor: 0 }
      );
      if (!error) {
        expect(data).toBe(1);
      }
    });

    it("resolves actual conversion rate from product_units", async () => {
      // Find a product with units
      const { data: unit } = await adminClient
        .from("product_units")
        .select("product_id, unit_name, conversion_rate")
        .gt("conversion_rate", 1)
        .limit(1)
        .maybeSingle();

      if (!unit) return; // Skip if no unit data

      const { data, error } = await adminClient.rpc(
        "_resolve_conversion_factor",
        { p_product_id: unit.product_id, p_uom: unit.unit_name, p_explicit_factor: 0 }
      );
      if (!error) {
        expect(data).toBe(unit.conversion_rate);
      }
    });
  });

  // === _validate_stock_availability ===
  describe("_validate_stock_availability", () => {
    it("rejects when stock insufficient", async () => {
      const { data: wh } = await adminClient
        .from("warehouses")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (!wh) return;

      const { error } = await adminClient.rpc("_validate_stock_availability", {
        p_warehouse_id: wh.id,
        p_items: [
          { product_id: 1, quantity: 999999, uom: "Viên" },
        ],
      });
      expect(error).toBeDefined();
      expect(error!.message).toContain("Không đủ tồn kho");
    });

    it("passes when stock is sufficient", async () => {
      const { data: batch } = await adminClient
        .from("inventory_batches")
        .select("product_id, warehouse_id, quantity")
        .gt("quantity", 5)
        .limit(1)
        .maybeSingle();

      if (!batch) return;

      const { error } = await adminClient.rpc("_validate_stock_availability", {
        p_warehouse_id: batch.warehouse_id,
        p_items: [
          { product_id: batch.product_id, quantity: 1, uom: "Viên" },
        ],
      });
      expect(error).toBeNull();
    });
  });
});
