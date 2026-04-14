/**
 * Integration test: create_sales_order — p_delivery_time là TIMESTAMPTZ
 *
 * Regression bug: p_delivery_time là `timestamp with time zone DEFAULT NULL`,
 * nhưng frontend từng truyền text strings ("Giao trong giờ hành chính")
 * → lỗi `invalid input syntax for type timestamp with time zone` (22007).
 *
 * Bug đã regress nhiều lần → test này PHẢI bắt được.
 */
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { adminClient } from "../helpers/supabase";
import { seedRpcAccessRules } from "../helpers/seedRpcAccessRules";

// ─── Shared params ──────────────────────────────────────────────────────────

/** IDs của orders tạo thành công — cleanup sau test */
const createdOrderIds: number[] = [];

/** Lấy customer_b2b + product + warehouse thực từ DB */
let customerId: number;
let productId: number;
let warehouseId: number;
let unitPrice: number;

function makeItems() {
  return JSON.stringify([
    {
      product_id: productId,
      quantity: 1,
      unit_price: unitPrice,
      uom: "Hộp",
      discount: 0,
      is_gift: false,
    },
  ]);
}

function baseParams() {
  return {
    p_items: makeItems(),
    p_customer_b2b_id: customerId,
    p_warehouse_id: warehouseId,
    p_order_type: "B2B",
    p_status: "DRAFT",
    p_payment_method: "credit",
  };
}

// ─── Setup & Teardown ───────────────────────────────────────────────────────

beforeAll(async () => {
  await seedRpcAccessRules();

  // Lấy 1 customer_b2b thực
  const { data: customers } = await adminClient
    .from("customers_b2b")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (!customers) throw new Error("Cần ít nhất 1 customer_b2b trong DB để chạy test");
  customerId = customers.id;

  // Lấy 1 product thực
  const { data: product } = await adminClient
    .from("products")
    .select("id, retail_price")
    .limit(1)
    .maybeSingle();

  if (!product) throw new Error("Cần ít nhất 1 product trong DB để chạy test");
  productId = product.id;
  unitPrice = Number(product.retail_price) || 100000;

  // Lấy 1 warehouse thực
  const { data: warehouse } = await adminClient
    .from("warehouses")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (!warehouse) throw new Error("Cần ít nhất 1 warehouse trong DB để chạy test");
  warehouseId = warehouse.id;
});

afterAll(async () => {
  // Cleanup: xóa orders đã tạo trong test (nếu có)
  if (createdOrderIds.length > 0) {
    // Xóa order_items trước (FK constraint)
    await adminClient
      .from("order_items")
      .delete()
      .in("order_id", createdOrderIds);

    await adminClient
      .from("orders")
      .delete()
      .in("id", createdOrderIds);
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Nếu RPC thành công, lưu order ID để cleanup.
 * Return { data, error } nguyên bản.
 */
async function callCreateSalesOrder(
  overrides: Record<string, unknown> = {},
) {
  const params = { ...baseParams(), ...overrides };
  const result = await adminClient.rpc("create_sales_order", params);

  // Nếu thành công và trả về order ID → track để cleanup
  if (!result.error && result.data) {
    const orderId =
      typeof result.data === "number"
        ? result.data
        : typeof result.data === "object" && result.data !== null && "id" in result.data
          ? (result.data as { id: number }).id
          : null;

    if (orderId) createdOrderIds.push(orderId);
  }

  return result;
}

/**
 * Kiểm tra lỗi KHÔNG phải lỗi type-cast timestamp (22007).
 * Nếu RPC fail vì auth/business logic, đó là OK — miễn không phải 22007.
 */
function expectNotTimestampError(error: { code: string; message: string } | null) {
  if (error) {
    expect(error.code).not.toBe("22007");
    expect(error.message).not.toMatch(/invalid input syntax for type timestamp/i);
  }
}

/**
 * Kiểm tra lỗi LÀ lỗi type-cast timestamp (22007).
 */
function expectTimestampError(error: { code: string; message: string } | null) {
  expect(error).not.toBeNull();
  // PostgREST trả 22007 cho invalid datetime, hoặc 22P02 cho invalid text representation
  expect(["22007", "22P02"]).toContain(error!.code);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("create_sales_order — p_delivery_time (timestamptz)", () => {
  it("1. tạo order KHÔNG truyền p_delivery_time (dùng DEFAULT NULL) — không lỗi type", async () => {
    // Không truyền p_delivery_time → dùng DEFAULT NULL trong PG
    const { error } = await callCreateSalesOrder();

    // Có thể fail vì auth guard hoặc business logic, nhưng KHÔNG được fail vì type cast
    expectNotTimestampError(error);
  });

  it("2. tạo order với p_delivery_time = null — không lỗi type", async () => {
    const { error } = await callCreateSalesOrder({
      p_delivery_time: null,
    });

    expectNotTimestampError(error);
  });

  it("3. tạo order với valid ISO timestamp — không lỗi type", async () => {
    const { error } = await callCreateSalesOrder({
      p_delivery_time: new Date().toISOString(),
    });

    expectNotTimestampError(error);
  });

  it("4. REGRESSION: text 'Giao trong giờ hành chính' PHẢI fail với lỗi timestamp parse", async () => {
    const { error } = await callCreateSalesOrder({
      p_delivery_time: "Giao trong giờ hành chính",
    });

    // ĐÂY LÀ TEST QUAN TRỌNG NHẤT.
    // Nếu ai đó đổi p_delivery_time về TEXT, test này sẽ PASS sai → phát hiện regression.
    expectTimestampError(error);
  });

  it("5. empty string '' PHẢI fail — không phải timestamptz hợp lệ", async () => {
    const { error } = await callCreateSalesOrder({
      p_delivery_time: "",
    });

    // Empty string không phải valid timestamptz → PostgREST phải reject
    expectTimestampError(error);
  });
});
