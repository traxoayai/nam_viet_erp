import { describe, it, expect, afterAll } from "vitest";

import { adminClient, isProduction } from "../helpers/supabase";

import {
  createTestWarehouse,
  createTestProduct,
  createTestBatch,
  cleanupTestData,
} from "./helpers/fixtures";

const markers: string[] = [];

describe("validate_stock_for_order", () => {
  it.skipIf(isProduction)(
    "ok=true khi đủ tồn (base qty ≥ requested base)",
    async () => {
      const marker = `STOCK-OK-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      await createTestBatch(adminClient, productId, whId, { quantity: 50 });

      const { data, error } = await adminClient.rpc(
        "validate_stock_for_order",
        {
          p_warehouse_id: whId,
          p_items: [
            {
              product_id: productId,
              quantity: 10,
              uom: "Hộp",
              conversion_factor: 1,
            },
          ],
        }
      );
      expect(error).toBeNull();
      expect((data as { ok: boolean }).ok).toBe(true);
      expect((data as { insufficient: unknown[] }).insufficient).toEqual([]);
    }
  );

  it.skipIf(isProduction)(
    "AUDIT #3 oversell UOM: 2 hộp (conversion 10 cái/hộp) → cần 20 cái, tồn 15 → deficit=5",
    async () => {
      const marker = `STOCK-OVERSELL-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      // Override default product_unit "Hộp" (conversion=1) với Cái (base) + Hộp (x10)
      await adminClient
        .from("product_units")
        .delete()
        .eq("product_id", productId);
      await adminClient.from("product_units").insert([
        {
          product_id: productId,
          unit_name: "Cái",
          conversion_rate: 1,
          is_base: true,
          price_sell: 1000,
          price: 1000,
          price_cost: 1000,
          unit_type: "base",
        },
        {
          product_id: productId,
          unit_name: "Hộp",
          conversion_rate: 10,
          is_base: false,
          price_sell: 10000,
          price: 10000,
          price_cost: 10000,
          unit_type: "wholesale",
        },
      ]);
      await createTestBatch(adminClient, productId, whId, { quantity: 15 });

      const { data, error } = await adminClient.rpc(
        "validate_stock_for_order",
        {
          p_warehouse_id: whId,
          p_items: [{ product_id: productId, quantity: 2, uom: "Hộp" }],
        }
      );
      expect(error).toBeNull();
      const result = data as {
        ok: boolean;
        insufficient: Array<{
          product_id: number;
          requested_base: number;
          available_base: number;
          deficit_base: number;
          reason: string;
          conversion_factor: number;
        }>;
      };
      expect(result.ok).toBe(false);
      expect(result.insufficient).toHaveLength(1);
      const row = result.insufficient[0];
      expect(row.product_id).toBe(productId);
      expect(Number(row.conversion_factor)).toBe(10);
      expect(Number(row.requested_base)).toBe(20);
      expect(Number(row.available_base)).toBe(15);
      expect(Number(row.deficit_base)).toBe(5);
      expect(row.reason).toBe("not_enough");
    }
  );

  it.skipIf(isProduction)("1 hộp (cần 10 cái) ≤ tồn 15 → ok=true", async () => {
    const marker = `STOCK-JUST-OK-${Date.now()}`;
    markers.push(marker);
    const whId = await createTestWarehouse(adminClient, { name: marker });
    const { productId } = await createTestProduct(adminClient, {
      name: marker,
    });
    await adminClient
      .from("product_units")
      .delete()
      .eq("product_id", productId);
    await adminClient.from("product_units").insert([
      {
        product_id: productId,
        unit_name: "Cái",
        conversion_rate: 1,
        is_base: true,
        price_sell: 1000,
        price: 1000,
        price_cost: 1000,
        unit_type: "base",
      },
      {
        product_id: productId,
        unit_name: "Hộp",
        conversion_rate: 10,
        is_base: false,
        price_sell: 10000,
        price: 10000,
        price_cost: 10000,
        unit_type: "wholesale",
      },
    ]);
    await createTestBatch(adminClient, productId, whId, { quantity: 15 });

    const { data } = await adminClient.rpc("validate_stock_for_order", {
      p_warehouse_id: whId,
      p_items: [{ product_id: productId, quantity: 1, uom: "Hộp" }],
    });
    expect((data as { ok: boolean }).ok).toBe(true);
  });

  it.skipIf(isProduction)(
    "Multi-item: 1 SP thiếu, 1 SP đủ → insufficient chỉ chứa SP thiếu",
    async () => {
      const marker = `STOCK-MULTI-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const { productId: p1 } = await createTestProduct(adminClient, {
        name: `${marker}-A`,
      });
      const { productId: p2 } = await createTestProduct(adminClient, {
        name: `${marker}-B`,
      });
      await createTestBatch(adminClient, p1, whId, { quantity: 100 });
      await createTestBatch(adminClient, p2, whId, { quantity: 2 });

      const { data } = await adminClient.rpc("validate_stock_for_order", {
        p_warehouse_id: whId,
        p_items: [
          { product_id: p1, quantity: 5, uom: "Hộp", conversion_factor: 1 },
          { product_id: p2, quantity: 5, uom: "Hộp", conversion_factor: 1 },
        ],
      });
      const result = data as {
        ok: boolean;
        insufficient: Array<{ product_id: number }>;
      };
      expect(result.ok).toBe(false);
      expect(result.insufficient).toHaveLength(1);
      expect(result.insufficient[0].product_id).toBe(p2);
    }
  );

  it.skipIf(isProduction)("Empty items → ok=true", async () => {
    const whId = await createTestWarehouse(adminClient, {
      name: `STOCK-EMPTY-${Date.now()}`,
    });
    const { data } = await adminClient.rpc("validate_stock_for_order", {
      p_warehouse_id: whId,
      p_items: [],
    });
    expect((data as { ok: boolean }).ok).toBe(true);
  });

  it.skipIf(isProduction)("Warehouse NULL → RAISE EXCEPTION", async () => {
    const { error } = await adminClient.rpc("validate_stock_for_order", {
      p_warehouse_id: null,
      p_items: [{ product_id: 1, quantity: 1, uom: "Hộp" }],
    });
    expect(error?.message).toMatch(/required/i);
  });

  // Defensive tests (commit 93b737f)
  it.skipIf(isProduction)(
    "unknown_uom: uom không có trong product_units → reason='unknown_uom'",
    async () => {
      const marker = `STOCK-UNK-UOM-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      await createTestBatch(adminClient, productId, whId, { quantity: 100 });

      const { data } = await adminClient.rpc("validate_stock_for_order", {
        p_warehouse_id: whId,
        p_items: [
          { product_id: productId, quantity: 1, uom: "Thùng-không-tồn-tại" },
        ],
      });
      const result = data as {
        ok: boolean;
        insufficient: Array<{ reason: string; product_id: number }>;
      };
      expect(result.ok).toBe(false);
      expect(result.insufficient).toHaveLength(1);
      expect(result.insufficient[0].reason).toBe("unknown_uom");
      expect(result.insufficient[0].product_id).toBe(productId);
    }
  );

  it.skipIf(isProduction)(
    "invalid_payload: thiếu key product_id → reason='invalid_payload'",
    async () => {
      const whId = await createTestWarehouse(adminClient, {
        name: `STOCK-BAD-${Date.now()}`,
      });
      const { data } = await adminClient.rpc("validate_stock_for_order", {
        p_warehouse_id: whId,
        p_items: [{ quantity: 1, uom: "Hộp" }],
      });
      const result = data as {
        ok: boolean;
        insufficient: Array<{ reason: string }>;
      };
      expect(result.ok).toBe(false);
      expect(result.insufficient[0].reason).toBe("invalid_payload");
    }
  );

  it.skipIf(isProduction)(
    "invalid_quantity: qty = 0 → reason='invalid_quantity'",
    async () => {
      const marker = `STOCK-Q0-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });

      const { data } = await adminClient.rpc("validate_stock_for_order", {
        p_warehouse_id: whId,
        p_items: [{ product_id: productId, quantity: 0, uom: "Hộp" }],
      });
      const result = data as {
        ok: boolean;
        insufficient: Array<{ reason: string }>;
      };
      expect(result.ok).toBe(false);
      expect(result.insufficient[0].reason).toBe("invalid_quantity");
    }
  );
});

afterAll(async () => {
  if (!isProduction && markers.length > 0) {
    await cleanupTestData(adminClient, markers);
  }
});
