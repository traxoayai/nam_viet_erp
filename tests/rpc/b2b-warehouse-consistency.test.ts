/**
 * Integration test: B2B warehouse consistency (2026-04-17)
 *
 * Regression guard cho các fix:
 * 1. get_b2b_warehouse_id() trả về kho B2B đang active
 * 2. create_sales_order ép warehouse_id = kho B2B khi order_type='B2B'
 * 3. confirm_outbound_packing idempotent (không trừ kho 2 lần)
 *    - Cover cả action_group 'sale' (từ _deduct_stock_fefo) VÀ 'SALE' (từ function này)
 * 4. Trigger orders_deduct_on_confirm tự trừ khi B2B → CONFIRMED
 * 5. Trigger orders_restock_on_cancel tự hoàn khi → CANCELLED
 * 6. _check_b2b_credit_exposure hiện DISABLED (return void)
 */
import { describe, it, expect, afterAll, beforeAll } from "vitest";

import {
  adminClient,
  createTestAuthedClient,
  isProduction,
} from "../helpers/supabase";

import type { SupabaseClient } from "@supabase/supabase-js";

let b2bWarehouseId: number | null = null;
let testCustomerId: number | null = null;
let testProductId: number | null = null;
let authedClient: SupabaseClient | null = null;
const createdOrderIds: string[] = [];

beforeAll(async () => {
  // Soft-setup: các test phụ thuộc seed data sẽ tự skip nếu thiếu,
  // thay vì throw làm fail toàn bộ file khi chạy trên DB chưa seed.
  // authedClient: RPC yêu cầu auth.uid() dùng user fixture test
  // (kame.ctb@gmail.com). Local-only, không chạy trên prod.
  if (!isProduction) {
    try {
      authedClient = await createTestAuthedClient();
    } catch {
      authedClient = null;
    }
  }
  const { data: whId } = await adminClient.rpc("get_b2b_warehouse_id");
  b2bWarehouseId = (whId as unknown as number) ?? null;

  const { data: customers } = await adminClient
    .from("customers_b2b")
    .select("id")
    .limit(1)
    .maybeSingle();
  testCustomerId = customers?.id ?? null;

  if (b2bWarehouseId) {
    const { data: stock } = await adminClient
      .from("inventory_batches")
      .select("product_id, quantity")
      .eq("warehouse_id", b2bWarehouseId)
      .gt("quantity", 50)
      .limit(1)
      .maybeSingle();
    testProductId = stock?.product_id ?? null;
  }
});

afterAll(async () => {
  for (const oid of createdOrderIds) {
    await adminClient.from("order_items").delete().eq("order_id", oid);
    await adminClient.from("inventory_transactions").delete().eq("ref_id", oid);
    await adminClient.from("orders").delete().eq("id", oid);
  }
});

describe("get_b2b_warehouse_id", () => {
  it("trả về id kho có type='b2b', status='active'", async (ctx) => {
    if (!b2bWarehouseId) return ctx.skip();
    expect(typeof b2bWarehouseId).toBe("number");
    expect(b2bWarehouseId).toBeGreaterThan(0);

    const { data: wh } = await adminClient
      .from("warehouses")
      .select("id, type, status")
      .eq("id", b2bWarehouseId)
      .single();
    expect(wh!.type).toBe("b2b");
    expect(wh!.status).toBe("active");
  });
});

describe("_check_b2b_credit_exposure (DISABLED)", () => {
  it("không throw dù order rất lớn (hiện bypass)", async (ctx) => {
    if (!testCustomerId) return ctx.skip();
    const { error } = await adminClient.rpc("_check_b2b_credit_exposure", {
      p_customer_id: testCustomerId,
      p_order_type: "B2B",
      p_final_amount: 999_999_999_999,
    });
    expect(error).toBeNull();
  });
});

// Các test dưới đây cần user auth (auth.uid() NOT NULL).
// Dùng authedClient (signed-in với kame.ctb@gmail.com fixture local).
describe("create_sales_order — B2B warehouse override (cần user auth)", () => {
  it("ignore p_warehouse_id client truyền, ép về kho B2B", async (ctx) => {
    if (!authedClient || !testProductId || !testCustomerId) return ctx.skip();
    const { data: resp, error } = await authedClient.rpc("create_sales_order", {
      p_items: [
        {
          product_id: testProductId,
          quantity: 1,
          unit_price: 1000,
          uom: "Hộp",
          discount: 0,
        },
      ],
      p_customer_b2b_id: testCustomerId,
      p_order_type: "B2B",
      p_warehouse_id: 999, // warehouse không tồn tại → backend phải override
      p_status: "DRAFT",
      p_payment_method: "credit",
    });
    expect(error).toBeNull();
    const result = resp as { order_id: string; code: string };
    expect(result.order_id).toBeTruthy();
    createdOrderIds.push(result.order_id);

    const { data: order } = await adminClient
      .from("orders")
      .select("warehouse_id, order_type, status")
      .eq("id", result.order_id)
      .single();

    expect(order!.order_type).toBe("B2B");
    expect(order!.warehouse_id).toBe(b2bWarehouseId);
    expect(order!.status).toBe("DRAFT");
  });
});

describe("Trigger orders_deduct_on_confirm (cần order test)", () => {
  it("đơn B2B DRAFT chuyển CONFIRMED → txn sale được tạo tự động", async (ctx) => {
    const orderId = createdOrderIds[createdOrderIds.length - 1];
    if (!orderId) return ctx.skip();

    // Trước: không có txn
    const { data: txBefore } = await adminClient
      .from("inventory_transactions")
      .select("id")
      .eq(
        "ref_id",
        (
          await adminClient
            .from("orders")
            .select("code")
            .eq("id", orderId)
            .single()
        ).data!.code
      );
    expect(txBefore!.length).toBe(0);

    // UPDATE status → CONFIRMED
    const { error } = await adminClient
      .from("orders")
      .update({ status: "CONFIRMED" })
      .eq("id", orderId);
    expect(error).toBeNull();

    // Sau: có txn sale với action_group='sale' (từ _deduct_stock_fefo)
    const { data: order } = await adminClient
      .from("orders")
      .select("code")
      .eq("id", orderId)
      .single();
    const { data: txAfter } = await adminClient
      .from("inventory_transactions")
      .select("action_group, quantity")
      .eq("ref_id", order!.code);
    expect(txAfter!.length).toBeGreaterThan(0);
    expect(txAfter![0].action_group).toBe("sale");
    expect(txAfter![0].quantity).toBeLessThan(0);
  });
});

describe("confirm_outbound_packing — idempotent (cần order test)", () => {
  it("đơn đã trừ qua trigger (action_group='sale') → không trừ lần 2", async (ctx) => {
    const orderId = createdOrderIds[createdOrderIds.length - 1];
    if (!orderId || !authedClient) return ctx.skip();

    const { data: order } = await adminClient
      .from("orders")
      .select("code")
      .eq("id", orderId)
      .single();

    // Snapshot txn count trước
    const { data: txBefore } = await adminClient
      .from("inventory_transactions")
      .select("id")
      .eq("ref_id", order!.code);
    const countBefore = txBefore!.length;

    // Call confirm_outbound_packing (cần auth.uid)
    const { data: resp, error } = await authedClient.rpc(
      "confirm_outbound_packing",
      {
        p_order_id: orderId,
      }
    );
    expect(error).toBeNull();
    const result = resp as {
      success: boolean;
      already_deducted: boolean;
      message: string;
    };
    expect(result.success).toBe(true);
    expect(result.already_deducted).toBe(true); // ← KEY: phát hiện 'sale' txn

    // Txn không được thêm mới
    const { data: txAfter } = await adminClient
      .from("inventory_transactions")
      .select("id")
      .eq("ref_id", order!.code);
    expect(txAfter!.length).toBe(countBefore);

    // Status → PACKED
    const { data: afterOrder } = await adminClient
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();
    expect(afterOrder!.status).toBe("PACKED");
  });

  it("gọi lại lần 2 → throw vì không còn CONFIRMED", async (ctx) => {
    const orderId = createdOrderIds[createdOrderIds.length - 1];
    if (!orderId || !authedClient) return ctx.skip();
    const { error } = await authedClient.rpc("confirm_outbound_packing", {
      p_order_id: orderId,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/CONFIRMED|chờ đóng gói/);
  });
});

describe("Trigger orders_restock_on_cancel (cần order test)", () => {
  it("đơn đã trừ kho chuyển CANCELLED → txn RETURN hoàn kho", async (ctx) => {
    const orderId = createdOrderIds[createdOrderIds.length - 1];
    if (!orderId) return ctx.skip();

    // Reset về CONFIRMED để được cancel (hoặc skip check nếu cancel_order RPC cho phép mọi status)
    // Thực tế: từ PACKED → CANCELLED cũng cần hoàn kho
    const { error } = await adminClient
      .from("orders")
      .update({ status: "CANCELLED" })
      .eq("id", orderId);
    expect(error).toBeNull();

    const { data: order } = await adminClient
      .from("orders")
      .select("code, status")
      .eq("id", orderId)
      .single();
    expect(order!.status).toBe("CANCELLED");

    // Có txn RETURN hoàn
    const { data: returnTx } = await adminClient
      .from("inventory_transactions")
      .select("action_group, quantity")
      .eq("ref_id", order!.code)
      .eq("action_group", "RETURN");
    expect(returnTx!.length).toBeGreaterThan(0);
    expect(returnTx![0].quantity).toBeGreaterThan(0); // positive = hoàn kho
  });
});

describe("Portal stock RPCs — filter kho B2B", () => {
  it("get_products_stock_status (không truyền warehouse) default kho B2B", async (ctx) => {
    if (!testProductId || !b2bWarehouseId) return ctx.skip();
    const { data, error } = await adminClient.rpc("get_products_stock_status", {
      p_product_ids: [testProductId],
    });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    // Verify total_quantity khớp với SUM từ kho B2B
    const { data: expected } = await adminClient
      .from("inventory_batches")
      .select("quantity")
      .eq("product_id", testProductId)
      .eq("warehouse_id", b2bWarehouseId);
    const expectedTotal = (expected ?? []).reduce(
      (s, r) => s + (r.quantity ?? 0),
      0
    );
    const row = (
      data as Array<{ product_id: number; total_quantity: number }>
    )[0];
    expect(row.total_quantity).toBe(expectedTotal);
  });

  it("get_product_batch_info chỉ trả lô ở kho B2B", async (ctx) => {
    if (!testProductId || !b2bWarehouseId) return ctx.skip();
    const { data, error } = await adminClient.rpc("get_product_batch_info", {
      p_product_id: testProductId,
    });
    expect(error).toBeNull();
    const rows = data as Array<{ warehouse_id: number }>;
    for (const r of rows) {
      expect(r.warehouse_id).toBe(b2bWarehouseId);
    }
  });
});
