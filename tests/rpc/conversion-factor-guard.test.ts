/**
 * Integration test cho migration 20260424030000 — 3 layer bảo vệ
 * conversion_factor:
 *
 * Layer 1: DROP DEFAULT 1 → insert order_items thiếu conversion_factor không
 *   silent điền 1
 * Layer 2: Trigger BEFORE INSERT → tự lookup product_units.conversion_rate
 *   và override NEW.conversion_factor bất kể FE gửi gì
 * Layer 3: _resolve_conversion_factor_strict raise khi hint > 0 và khác DB
 */
import { describe, it, expect, afterAll } from "vitest";

import { adminClient, isProduction } from "../helpers/supabase";

import {
  createTestProduct,
  createTestB2BCustomer,
  cleanupTestData,
} from "./helpers/fixtures";

const markers: string[] = [];

describe("conversion_factor guard (migration 030000)", () => {
  it.skipIf(isProduction)(
    "Trigger override: insert order_item với conversion_factor=1 nhưng UOM Hộp factor=10 → DB lưu 10",
    async () => {
      const marker = `GUARD-OVERRIDE-${Date.now()}`;
      markers.push(marker);
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
      });
      const customerId = await createTestB2BCustomer(adminClient, {
        name: marker,
      });

      // Setup UOM: Cái (base=1) + Hộp (factor=10)
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

      // Tạo order parent bằng RPC-less INSERT (test trigger, không qua RPC)
      const { data: order } = await adminClient
        .from("orders")
        .insert({
          code: `${marker}-ORD`,
          customer_id: customerId,
          status: "DRAFT",
          order_type: "B2B",
          warehouse_id: null,
          total_amount: 10000,
          final_amount: 10000,
          payment_method: "credit",
          payment_status: "unpaid",
          // source bỏ trống -> dùng default 'erp' (giá trị source không liên quan
          // mục đích test này; tránh để rớt order source='test' làm nhiễu
          // get_sales_orders_view ở test khác — portal-hub).
        })
        .select("id")
        .single();

      // FE (hoặc direct SQL) gửi conversion_factor=1 (hardcoded sai)
      const { data: item, error } = await adminClient
        .from("order_items")
        .insert({
          order_id: order!.id as string,
          product_id: productId,
          quantity: 1,
          uom: "Hộp",
          conversion_factor: 1, // ← HÌNH HARDCODED SAI
          unit_price: 10000,
          discount: 0,
        })
        .select("conversion_factor")
        .single();

      expect(error).toBeNull();
      // Trigger tự override → DB phải lưu 10
      expect(Number(item!.conversion_factor)).toBe(10);
    }
  );

  it.skipIf(isProduction)("Trigger UOM không tồn tại → RAISE", async () => {
    const marker = `GUARD-BADUOM-${Date.now()}`;
    markers.push(marker);
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

    const { data: order } = await adminClient
      .from("orders")
      .insert({
        code: `${marker}-ORD`,
        customer_id: customerId,
        status: "DRAFT",
        order_type: "B2B",
        warehouse_id: null,
        total_amount: 10000,
        final_amount: 10000,
        payment_method: "credit",
        payment_status: "unpaid",
        source: "test",
      })
      .select("id")
      .single();

    const { error } = await adminClient.from("order_items").insert({
      order_id: order!.id as string,
      product_id: productId,
      quantity: 1,
      uom: "Tấn", // KHÔNG tồn tại
      conversion_factor: 1,
      unit_price: 10000,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/UOM.*không tồn tại|Tấn/);
  });

  it.skipIf(isProduction)(
    "Helper strict v2: hint khác DB → RAISE",
    async () => {
      const marker = `GUARD-HINTMISMATCH-${Date.now()}`;
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
        unit_name: "Hộp",
        conversion_rate: 10,
        is_base: false,
        price_sell: 10000,
        price: 10000,
        price_cost: 10000,
        unit_type: "wholesale",
      });

      // FE gửi hint=1 nhưng DB=10
      const { error } = await adminClient.rpc(
        "_resolve_conversion_factor_strict" as never,
        {
          p_product_id: productId,
          p_uom: "Hộp",
          p_explicit_factor: 1, // ← KHÁC DB
        }
      );
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/mismatch|FE gửi.*nhưng DB/);
    }
  );

  it.skipIf(isProduction)(
    "Helper strict v2: hint match DB → trả hint (không raise)",
    async () => {
      const marker = `GUARD-HINTMATCH-${Date.now()}`;
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
        unit_name: "Hộp",
        conversion_rate: 10,
        is_base: false,
        price_sell: 10000,
        price: 10000,
        price_cost: 10000,
        unit_type: "wholesale",
      });

      const { data, error } = await adminClient.rpc(
        "_resolve_conversion_factor_strict" as never,
        {
          p_product_id: productId,
          p_uom: "Hộp",
          p_explicit_factor: 10, // ← KHỚP DB
        }
      );
      expect(error).toBeNull();
      expect(Number(data)).toBe(10);
    }
  );
});

afterAll(async () => {
  if (markers.length > 0) {
    await cleanupTestData(adminClient, markers);
  }
});
