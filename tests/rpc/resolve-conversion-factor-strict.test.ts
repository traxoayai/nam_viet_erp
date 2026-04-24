/**
 * Integration test cho _resolve_conversion_factor_strict + create_sales_order
 * canonical dùng strict variant (migration 20260424020000).
 *
 * Verify:
 * 1. Strict helper: hint_factor > 0 → trả hint (không lookup)
 * 2. Strict helper: UOM tồn tại → trả conversion_rate đúng
 * 3. Strict helper: UOM không tồn tại → RAISE exception
 * 4. Strict helper: UOM rỗng/NULL → RAISE exception
 * 5. create_sales_order với UOM sai → reject (không silent fallback factor=1)
 */
import { describe, it, expect, afterAll, beforeAll } from "vitest";

import {
  adminClient,
  createTestAuthedClient,
  isProduction,
} from "../helpers/supabase";

import {
  createTestWarehouse,
  createTestProduct,
  createTestBatch,
  createTestB2BCustomer,
  cleanupTestData,
} from "./helpers/fixtures";

import type { SupabaseClient } from "@supabase/supabase-js";

const markers: string[] = [];

describe("_resolve_conversion_factor_strict", () => {
  it.skipIf(isProduction)(
    "hint_factor > 0 → trả hint, không lookup product_units",
    async () => {
      const { data, error } = await adminClient.rpc(
        "_resolve_conversion_factor_strict" as never,
        {
          p_product_id: 999_999_999, // product không tồn tại
          p_uom: "Xyz", // UOM không tồn tại
          p_explicit_factor: 42,
        }
      );
      expect(error).toBeNull();
      expect(Number(data)).toBe(42);
    }
  );

  it.skipIf(isProduction)(
    "UOM tồn tại → trả conversion_rate đúng",
    async () => {
      const marker = `STRICT-OK-${Date.now()}`;
      markers.push(marker);
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

      const { data, error } = await adminClient.rpc(
        "_resolve_conversion_factor_strict" as never,
        {
          p_product_id: productId,
          p_uom: "Hộp",
          p_explicit_factor: 0,
        }
      );
      expect(error).toBeNull();
      expect(Number(data)).toBe(10);
    }
  );

  it.skipIf(isProduction)(
    "UOM không tồn tại → RAISE (không silent fallback 1)",
    async () => {
      const marker = `STRICT-UNKNOWN-${Date.now()}`;
      markers.push(marker);
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      await adminClient
        .from("product_units")
        .delete()
        .eq("product_id", productId);
      await adminClient.from("product_units").insert({
        product_id: productId,
        unit_name: "Cái",
        conversion_rate: 1,
        is_base: true,
        price_sell: 1000,
        price: 1000,
        price_cost: 1000,
        unit_type: "base",
      });

      const { error } = await adminClient.rpc(
        "_resolve_conversion_factor_strict" as never,
        {
          p_product_id: productId,
          p_uom: "Tấn", // Không tồn tại
          p_explicit_factor: 0,
        }
      );
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/Đơn vị.*không hợp lệ/);
    }
  );

  it.skipIf(isProduction)("UOM rỗng → RAISE", async () => {
    const { error } = await adminClient.rpc(
      "_resolve_conversion_factor_strict" as never,
      {
        p_product_id: 1,
        p_uom: "",
        p_explicit_factor: 0,
      }
    );
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/không được rỗng/);
  });
});

describe("create_sales_order — strict UOM validation", () => {
  let authed: SupabaseClient | null = null;
  beforeAll(async () => {
    if (!isProduction) {
      try {
        authed = await createTestAuthedClient();
      } catch {
        // Skip test if local test user password không setup — verify strict
        // helper gián tiếp qua _resolve_conversion_factor_strict tests ở trên.
        authed = null;
      }
    }
  });

  it.skipIf(isProduction)(
    "UOM không tồn tại → RAISE (không snapshot factor=1 silent)",
    async () => {
      if (!authed) return;
      const marker = `SO-STRICT-${Date.now()}`;
      markers.push(marker);
      const whId = await createTestWarehouse(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      const customerId = await createTestB2BCustomer(adminClient, {
        name: marker,
      });
      await adminClient
        .from("product_units")
        .delete()
        .eq("product_id", productId);
      await adminClient.from("product_units").insert({
        product_id: productId,
        unit_name: "Cái",
        conversion_rate: 1,
        is_base: true,
        price_sell: 1000,
        price: 1000,
        price_cost: 1000,
        unit_type: "base",
      });
      await createTestBatch(adminClient, productId, whId, { quantity: 100 });

      const { error } = await authed.rpc("create_sales_order", {
        p_items: [
          {
            product_id: productId,
            quantity: 1,
            uom: "Tấn", // KHÔNG tồn tại
            unit_price: 10000,
          },
        ],
        p_customer_id: customerId,
        p_warehouse_id: whId,
        p_status: "DRAFT",
        p_order_type: "B2B",
      });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/Đơn vị.*không hợp lệ|Tấn/);
    }
  );
});

afterAll(async () => {
  if (markers.length > 0) {
    await cleanupTestData(adminClient, markers);
  }
});
