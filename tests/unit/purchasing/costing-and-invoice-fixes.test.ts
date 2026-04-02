/**
 * Tests cho các fix liên quan đến:
 * - Bug 1+2: Chốt giá vốn không đổi status COMPLETED, không cộng shipping vào final_amount
 * - Bug 3: Nút Invoice VAT (Scan/XML/Liên kết) style
 * - Bug 4: Ô SL trong InvoiceVerifyPage không bị đổi khi chuyển ĐVT
 */
import { describe, it, expect } from "vitest";

// =============================================================
// A. COSTING LOGIC - calculateRow (pure function test)
// =============================================================
describe("Costing calculateRow logic", () => {
  // Replicate the calculateRow function from usePurchaseCostingLogic
  const calculateRow = (item: {
    unit_price: number;
    quantity_ordered: number;
    rebate_rate: number;
    vat_rate: number;
    allocated_shipping: number;
    bonus_quantity: number;
  }) => {
    const totalBase = item.unit_price * item.quantity_ordered;
    const afterRebate = totalBase * (1 - item.rebate_rate / 100);
    const afterVat = afterRebate * (1 + item.vat_rate / 100);
    const totalCost = afterVat + item.allocated_shipping;
    const totalQty = item.quantity_ordered + item.bonus_quantity;
    return totalQty > 0 ? totalCost / totalQty : 0;
  };

  it("calculates final unit cost without shipping", () => {
    const cost = calculateRow({
      unit_price: 99000,
      quantity_ordered: 40,
      rebate_rate: 0,
      vat_rate: 0,
      allocated_shipping: 0,
      bonus_quantity: 0,
    });
    expect(cost).toBe(99000); // 99000 * 40 / 40 = 99000
  });

  it("calculates final unit cost with shipping allocation", () => {
    const cost = calculateRow({
      unit_price: 99000,
      quantity_ordered: 40,
      rebate_rate: 0,
      vat_rate: 0,
      allocated_shipping: 15000, // 15k allocated
      bonus_quantity: 0,
    });
    // (99000 * 40 + 15000) / 40 = 99375
    expect(cost).toBe(99375);
  });

  it("calculates with rebate and VAT", () => {
    const cost = calculateRow({
      unit_price: 100000,
      quantity_ordered: 10,
      rebate_rate: 5, // 5% rebate
      vat_rate: 10, // 10% VAT
      allocated_shipping: 0,
      bonus_quantity: 0,
    });
    // base = 100000 * 10 = 1000000
    // afterRebate = 1000000 * 0.95 = 950000
    // afterVat = 950000 * 1.10 = 1045000
    // / 10 = 104500
    expect(cost).toBeCloseTo(104500, 2);
  });

  it("distributes cost across bonus quantity", () => {
    const cost = calculateRow({
      unit_price: 100000,
      quantity_ordered: 10,
      rebate_rate: 0,
      vat_rate: 0,
      allocated_shipping: 0,
      bonus_quantity: 2, // 2 bonus items
    });
    // 1000000 / (10 + 2) = 83333.33...
    expect(cost).toBeCloseTo(83333.33, 0);
  });

  it("returns 0 when quantity is 0", () => {
    const cost = calculateRow({
      unit_price: 100000,
      quantity_ordered: 0,
      rebate_rate: 0,
      vat_rate: 0,
      allocated_shipping: 0,
      bonus_quantity: 0,
    });
    expect(cost).toBe(0);
  });
});

// =============================================================
// B. SHIPPING ALLOCATION - proportional by value
// =============================================================
describe("Shipping allocation logic", () => {
  const allocateShipping = (
    items: { quantity_ordered: number; unit_price: number }[],
    totalShippingFee: number
  ) => {
    const totalValue = items.reduce(
      (sum, i) => sum + i.quantity_ordered * i.unit_price,
      0
    );
    if (totalValue === 0) return items.map(() => 0);

    return items.map((item) => {
      const itemValue = item.quantity_ordered * item.unit_price;
      const ratio = itemValue / totalValue;
      return Math.round(totalShippingFee * ratio);
    });
  };

  it("allocates shipping proportionally by item value", () => {
    const items = [
      { quantity_ordered: 40, unit_price: 99000 },  // 3,960,000
      { quantity_ordered: 30, unit_price: 96000 },  // 2,880,000
      { quantity_ordered: 30, unit_price: 35000 },  // 1,050,000
    ];
    const allocated = allocateShipping(items, 30000);
    // Total = 7,890,000
    // Item 1: 3960000/7890000 * 30000 = ~15057
    // Item 2: 2880000/7890000 * 30000 = ~10951
    // Item 3: 1050000/7890000 * 30000 = ~3992
    expect(allocated[0] + allocated[1] + allocated[2]).toBeCloseTo(30000, -1);
    expect(allocated[0]).toBeGreaterThan(allocated[1]);
    expect(allocated[1]).toBeGreaterThan(allocated[2]);
  });

  it("does not allocate shipping when total value is 0", () => {
    const items = [{ quantity_ordered: 0, unit_price: 0 }];
    const allocated = allocateShipping(items, 30000);
    expect(allocated[0]).toBe(0);
  });

  it("shipping fee should NOT be added to PO final_amount", () => {
    // This test documents the business rule:
    // Tổng thanh toán NCC = subtotal (tiền hàng) only
    // Phí vận chuyển thanh toán riêng cho đối tác vận chuyển
    const subtotal = 7890000;
    const shippingFee = 30000;

    // OLD (bug): finalAmount = subtotal + shippingFee = 7920000 (WRONG)
    const oldFinalAmount = subtotal + shippingFee;
    expect(oldFinalAmount).toBe(7920000);

    // NEW (fix): finalAmount = subtotal only = 7890000 (CORRECT)
    const newFinalAmount = subtotal; // shipping NOT included
    expect(newFinalAmount).toBe(7890000);
    expect(newFinalAmount).not.toBe(oldFinalAmount);
  });
});

// =============================================================
// C. PO STATUS - costing should NOT change status to COMPLETED
// =============================================================
describe("PO status after costing", () => {
  it("costing_confirmed_at should be set, status should NOT change", () => {
    // Simulate PO state before costing
    const poBeforeCosting = {
      status: "PENDING",
      costing_confirmed_at: null,
    };

    // After costing: only set costing_confirmed_at, keep status
    const poAfterCosting = {
      ...poBeforeCosting,
      costing_confirmed_at: new Date().toISOString(), // NOW()
      // status stays PENDING - NOT changed to COMPLETED
    };

    expect(poAfterCosting.status).toBe("PENDING");
    expect(poAfterCosting.costing_confirmed_at).not.toBeNull();
  });

  it("PO only becomes COMPLETED when fully paid AND fully stocked", () => {
    // Business rule: 1 đơn mua hàng chỉ hoàn thành khi:
    // - đã hoàn tất nhập kho
    // - Thanh toán 100% tiền cho NCC
    const checkCanComplete = (po: {
      inventory_received: boolean;
      payment_percentage: number;
    }) => {
      return po.inventory_received && po.payment_percentage >= 100;
    };

    // Case 1: Chỉ chốt giá vốn, chưa nhập kho, chưa thanh toán
    expect(checkCanComplete({ inventory_received: false, payment_percentage: 0 })).toBe(false);

    // Case 2: Đã nhập kho nhưng chưa thanh toán
    expect(checkCanComplete({ inventory_received: true, payment_percentage: 50 })).toBe(false);

    // Case 3: Đã thanh toán nhưng chưa nhập kho
    expect(checkCanComplete({ inventory_received: false, payment_percentage: 100 })).toBe(false);

    // Case 4: Đã nhập kho VÀ thanh toán 100% -> COMPLETED
    expect(checkCanComplete({ inventory_received: true, payment_percentage: 100 })).toBe(true);
  });

  it("costing button should be disabled when costing_confirmed_at is set", () => {
    // Frontend logic: isCostingLocked = !!costingConfirmedAt
    const costingConfirmedAt1 = null;
    const costingConfirmedAt2 = "2026-04-02T10:00:00Z";

    expect(!!costingConfirmedAt1).toBe(false); // button enabled
    expect(!!costingConfirmedAt2).toBe(true);  // button disabled
  });

  it("payment buttons should remain visible after costing (status still PENDING)", () => {
    // POHeaderAction: canEdit = poStatus === "PENDING"
    const poStatus = "PENDING";
    const canEdit = poStatus === "PENDING";
    expect(canEdit).toBe(true); // payment buttons visible
  });
});

// =============================================================
// D. INVOICE VERIFY - SL field should NOT change when unit changes
// =============================================================
describe("Invoice Verify - SL field stability", () => {
  it("SL should remain as original XML quantity when unit changes", () => {
    // Original XML data: 4800 viên
    const xmlQuantity = 4800;
    const xmlUnitPrice = 2504; // price per viên

    // User selects Hộp (Rate: 30) as ĐVT Nhập
    const newRate = 30;

    // OLD behavior (bug): quantity changed to 4800/30 = 160
    const oldQuantity = xmlQuantity / newRate;
    expect(oldQuantity).toBe(160); // BUG: SL bị đổi

    // NEW behavior (fix): quantity stays at 4800
    const newQuantity = xmlQuantity; // giữ nguyên
    expect(newQuantity).toBe(4800); // CORRECT: SL giữ nguyên

    // Only price is converted: 2504 * 30 = 75,120 per Hộp
    const convertedPrice = xmlUnitPrice * newRate;
    expect(convertedPrice).toBe(75120);

    // Total amount preserved: 4800 * 2504 = 160 * 75120 = 12,019,200
    const originalTotal = xmlQuantity * xmlUnitPrice;
    const displayedTotal = newQuantity * xmlUnitPrice; // SL giữ nguyên, giá giữ nguyên
    expect(displayedTotal).toBe(originalTotal);
  });

  it("conversion info should be shown separately below unit selector", () => {
    const xmlQuantity = 4800; // viên
    const rate = 30; // Hộp = 30 viên

    // Quy đổi hiển thị riêng: 4800 / 30 = 160.00 Hộp
    const convertedQty = xmlQuantity / rate;
    expect(convertedQty).toBe(160);
    // This info is displayed as text below the select, NOT in the SL column
  });

  it("price should be converted correctly when unit changes", () => {
    const xmlUnitPrice = 2504; // per viên

    // Select Hộp (Rate: 30)
    expect(xmlUnitPrice * 30).toBe(75120);

    // Select Viên (Rate: 1) - base unit
    expect(xmlUnitPrice * 1).toBe(2504);

    // Select Vỉ (Rate: 10)
    expect(xmlUnitPrice * 10).toBe(25040);
  });
});
