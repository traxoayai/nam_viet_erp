/**
 * Integration test: create_sales_order — p_delivery_time phải nhận TEXT
 *
 * Bug: p_delivery_time đổi từ TEXT → TIMESTAMPTZ trong migration trước,
 * nhưng frontend gửi text như "Giao trong giờ hành chính" → lỗi 22007.
 * Fix: Đổi lại về TEXT.
 */
import { describe, it, expect } from "vitest";
import { adminClient } from "../helpers/supabase";

describe("create_sales_order — delivery_time accepts text", () => {
  it("không lỗi 22007 khi gửi text 'Giao trong giờ hành chính'", async () => {
    const { error } = await adminClient.rpc("create_sales_order", {
      p_items: JSON.stringify([
        { product_id: 1, quantity: 1, unit_price: 100000, uom: "Hộp", discount: 0, is_gift: false },
      ]),
      p_customer_id: 1,
      p_delivery_time: "Giao trong giờ hành chính",
      p_delivery_address: "123 Test",
      p_warehouse_id: 1,
      p_order_type: "B2B",
      p_status: "DRAFT",
    });

    // Có thể fail vì permission/business logic, nhưng KHÔNG phải lỗi type cast 22007
    if (error) {
      expect(error.code).not.toBe("22007");
      // Cũng không phải ambiguous overload
      expect(error.code).not.toBe("PGRST203");
    }
  });

  it("không lỗi 22007 khi gửi text 'Dự kiến giao: 12/04/2026'", async () => {
    const { error } = await adminClient.rpc("create_sales_order", {
      p_items: JSON.stringify([
        { product_id: 1, quantity: 1, unit_price: 50000, uom: "Hộp", discount: 0, is_gift: false },
      ]),
      p_customer_id: 1,
      p_delivery_time: "Dự kiến giao: 12/04/2026 (khoảng 2 ngày)",
      p_delivery_address: "456 Test",
      p_warehouse_id: 1,
      p_order_type: "B2B",
      p_status: "DRAFT",
    });

    if (error) {
      expect(error.code).not.toBe("22007");
      expect(error.code).not.toBe("PGRST203");
    }
  });

  it("chấp nhận null cho p_delivery_time", async () => {
    const { error } = await adminClient.rpc("create_sales_order", {
      p_items: JSON.stringify([
        { product_id: 1, quantity: 1, unit_price: 50000, uom: "Hộp", discount: 0, is_gift: false },
      ]),
      p_customer_id: 1,
      p_delivery_time: null,
      p_warehouse_id: 1,
      p_order_type: "B2B",
      p_status: "DRAFT",
    });

    if (error) {
      expect(error.code).not.toBe("22007");
      expect(error.code).not.toBe("PGRST203");
    }
  });
});
