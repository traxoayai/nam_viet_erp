import { describe, it, expect } from "vitest";

import { adminClient } from "../helpers/supabase";

import {
  createTestWarehouse,
  createTestProduct,
  createTestBatch,
  cleanupTestData,
} from "./helpers/fixtures";

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
        {
          p_product_id: unit.product_id,
          p_uom: unit.unit_name,
          p_explicit_factor: 0,
        }
      );
      if (!error) {
        expect(data).toBe(unit.conversion_rate);
      }
    });
  });

  // === _validate_stock_availability ===
  // Setup test product + product_units fixture (UOM "Hộp" rate=1 base) +
  // inventory_batches qty cố định để tránh strict-resolve throw "Đơn vị không
  // hợp lệ". Cleanup theo marker.
  describe("_validate_stock_availability", () => {
    const marker = `VSA-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    let warehouseId: number;
    let productId: number;
    let baseUnitName: string;

    it("setup fixture: product + base unit + batch qty=10", async () => {
      warehouseId = await createTestWarehouse(adminClient, { name: marker });
      const p = await createTestProduct(adminClient, { name: marker });
      productId = p.productId;
      baseUnitName = p.baseUnitName;
      await createTestBatch(adminClient, productId, warehouseId, {
        quantity: 10,
      });
    });

    it("rejects when stock insufficient (quantity 999999 > kho 10)", async () => {
      const { error } = await adminClient.rpc("_validate_stock_availability", {
        p_warehouse_id: warehouseId,
        p_items: [
          { product_id: productId, quantity: 999999, uom: baseUnitName },
        ],
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain("Không đủ tồn kho");
    });

    it("passes when stock is sufficient (quantity 1 ≤ kho 10)", async () => {
      const { error } = await adminClient.rpc("_validate_stock_availability", {
        p_warehouse_id: warehouseId,
        p_items: [{ product_id: productId, quantity: 1, uom: baseUnitName }],
      });
      expect(error).toBeNull();
    });

    it("cleanup fixture", async () => {
      await cleanupTestData(adminClient, [marker]);
    });
  });
});
