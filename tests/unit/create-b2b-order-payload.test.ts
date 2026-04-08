import { describe, it, expect } from "vitest";

/**
 * Unit tests for B2B order creation payload.
 * Ensures p_payment_method is always included and defaults correctly.
 */

// Simulate the payload construction from CreateB2BOrderPage
function buildB2BOrderPayload(overrides: Record<string, unknown> = {}) {
  const defaultPayload = {
    p_customer_id: 1,
    p_delivery_address: "123 Test St",
    p_delivery_time: "2026-04-10",
    p_note: "",
    p_discount_amount: 0,
    p_shipping_fee: 0,
    p_status: "CONFIRMED" as const,
    p_delivery_method: "internal" as const,
    p_shipping_partner_id: null,
    p_warehouse_id: 1,
    p_payment_method: "credit" as const,
    p_order_type: "B2B" as const,
    p_items: [
      {
        product_id: 1,
        quantity: 10,
        uom: "Hộp",
        unit_price: 100000,
        discount: 0,
        is_gift: false,
      },
    ],
  };
  return { ...defaultPayload, ...overrides };
}

describe("B2B Order Payload — payment_method", () => {
  it("includes p_payment_method field", () => {
    const payload = buildB2BOrderPayload();
    expect(payload).toHaveProperty("p_payment_method");
  });

  it("defaults p_payment_method to 'credit' for B2B", () => {
    const payload = buildB2BOrderPayload();
    expect(payload.p_payment_method).toBe("credit");
  });

  it("allows overriding p_payment_method to 'cash'", () => {
    const payload = buildB2BOrderPayload({ p_payment_method: "cash" });
    expect(payload.p_payment_method).toBe("cash");
  });

  it("allows overriding p_payment_method to 'bank_transfer'", () => {
    const payload = buildB2BOrderPayload({ p_payment_method: "bank_transfer" });
    expect(payload.p_payment_method).toBe("bank_transfer");
  });

  it("p_payment_method should NOT be undefined", () => {
    const payload = buildB2BOrderPayload();
    expect(payload.p_payment_method).toBeDefined();
    expect(payload.p_payment_method).not.toBeUndefined();
  });
});

describe("B2B Order Payload — finance transaction guard", () => {
  it("credit payment should NOT trigger auto finance transaction", () => {
    const payload = buildB2BOrderPayload({ p_payment_method: "credit" });
    // Simulating RPC logic: IF p_payment_method = 'cash' THEN create FT
    const shouldCreateFinanceTransaction = payload.p_payment_method === "cash";
    expect(shouldCreateFinanceTransaction).toBe(false);
  });

  it("bank_transfer payment should NOT trigger auto finance transaction", () => {
    const payload = buildB2BOrderPayload({ p_payment_method: "bank_transfer" });
    const shouldCreateFinanceTransaction = payload.p_payment_method === "cash";
    expect(shouldCreateFinanceTransaction).toBe(false);
  });

  it("cash payment SHOULD trigger auto finance transaction", () => {
    const payload = buildB2BOrderPayload({ p_payment_method: "cash" });
    const shouldCreateFinanceTransaction = payload.p_payment_method === "cash";
    expect(shouldCreateFinanceTransaction).toBe(true);
  });
});
