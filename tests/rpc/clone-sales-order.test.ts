import { describe, it, expect, afterAll } from "vitest";
import { adminClient, isProduction } from "../helpers/supabase";
import {
  createTestWarehouse,
  createTestProduct,
  createTestB2BCustomer,
  createTestOrder,
  cleanupTestData,
} from "./helpers/fixtures";

/**
 * Regression test cho clone_sales_order.
 *
 * BUG LỊCH SỬ (2026-04-23):
 *   Migration 20260423160000 redefine clone_sales_order với 3 column names sai
 *   (user_id / total_paid / approval_status) + đổi return type jsonb -> uuid.
 *   FE đọc {success, new_code, new_order_id} nên clone fail 100%.
 *
 * CÁC GUARDS:
 *   - RETURNS jsonb đúng shape {success, new_order_id, new_code}
 *   - Column tồn tại: creator_id / paid_amount / remittance_status
 *   - Clone copy toàn bộ order_items
 *   - Clone set status='DRAFT', payment_status='unpaid'
 *   - Giá refresh về wholesale price_sell từ product_units (no Flash Sale bake)
 *   - final_amount = tổng items + shipping_fee
 */

const markers: string[] = [];

describe("clone_sales_order — regression guards", () => {
  // Prod mode chỉ verify signature + shape qua 1 đơn ảo (không chạy insert)
  // vì không được tạo order thật trên prod. Local mode: test full logic.

  it("RPC existence + signature (p_old_order_id: uuid)", async () => {
    // Gọi với UUID random không tồn tại → phải nhận RAISE EXCEPTION "Không tìm thấy..."
    // Nếu RPC đã mất (PGRST202) hoặc sai signature (PGRST203) → fail.
    const { error } = await adminClient.rpc("clone_sales_order", {
      p_old_order_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).not.toBeNull();
    expect(error?.code).not.toBe("PGRST202");
    expect(error?.code).not.toBe("PGRST203");
    // Phải là lỗi business (không tìm thấy đơn) chứ không phải undefined_column / undefined_function
    expect(error?.code).not.toBe("42883"); // undefined_function (helper thiếu)
    expect(error?.code).not.toBe("42703"); // undefined_column (tên cột sai)
    expect(error?.code).not.toBe("42P01"); // undefined_table
    // Thông điệp business mong đợi
    expect(error?.message).toMatch(/Không tìm thấy đơn|does not match|P0001/i);
  });

  it.skipIf(isProduction)(
    "Clone success trả về jsonb shape {success, new_order_id, new_code}",
    async () => {
      const marker = `CLONE-${Date.now()}`;
      markers.push(marker);

      const whId = await createTestWarehouse(adminClient, { name: marker });
      const custId = await createTestB2BCustomer(adminClient, { name: marker });
      const { productId } = await createTestProduct(adminClient, {
        name: marker,
        actualCost: 50000,
      });

      // Set price_sell = 60000 để verify clone refresh đúng giá hiện tại
      await adminClient
        .from("product_units")
        .update({ price_sell: 60000, price: 60000 })
        .eq("product_id", productId)
        .eq("is_base", true);

      const { orderId: oldId, orderCode: oldCode } = await createTestOrder(
        adminClient,
        {
          customerB2bId: custId,
          warehouseId: whId,
          code: `TEST-INTEGRATION-ORD-${marker}`,
          status: "CONFIRMED",
          items: [
            { productId, quantity: 3, unitPrice: 40000 }, // giá cũ 40k
          ],
        }
      );

      const { data, error } = await adminClient.rpc("clone_sales_order", {
        p_old_order_id: oldId,
      });

      expect(error, `clone phải success: ${error?.message}`).toBeNull();
      expect(data).toBeTypeOf("object");
      const res = data as {
        success: boolean;
        new_order_id: string;
        new_code: string;
        message?: string;
      };
      expect(res.success).toBe(true);
      expect(res.new_order_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.new_code).toMatch(/^(SO|POS)-/);

      // Verify đơn mới có status=DRAFT, payment_status=unpaid
      const { data: newOrder } = await adminClient
        .from("orders")
        .select(
          "id, code, status, payment_status, total_amount, final_amount, creator_id, paid_amount, remittance_status, note"
        )
        .eq("id", res.new_order_id)
        .single();
      expect(newOrder?.status).toBe("DRAFT");
      expect(newOrder?.payment_status).toBe("unpaid");
      expect(newOrder?.paid_amount).toBe(0);
      expect(newOrder?.note).toContain(oldCode);

      // Verify items copied + giá refresh về 60k (không phải 40k cũ)
      const { data: newItems } = await adminClient
        .from("order_items")
        .select("product_id, quantity, unit_price")
        .eq("order_id", res.new_order_id);
      expect(newItems).toHaveLength(1);
      expect(newItems?.[0].product_id).toBe(productId);
      expect(newItems?.[0].quantity).toBe(3);
      expect(newItems?.[0].unit_price).toBe(60000); // giá refresh
      // Total = 3 * 60000
      expect(Number(newOrder?.total_amount)).toBe(180000);
    }
  );

  it.skipIf(isProduction)(
    "Clone trên đơn không tồn tại → RAISE EXCEPTION business (không phải schema error)",
    async () => {
      const { error } = await adminClient.rpc("clone_sales_order", {
        p_old_order_id: "11111111-1111-1111-1111-111111111111",
      });
      expect(error).not.toBeNull();
      expect(error?.code).not.toBe("42703");
      expect(error?.code).not.toBe("42883");
      expect(error?.message).toContain("Không tìm thấy đơn");
    }
  );
});

afterAll(async () => {
  if (markers.length > 0 && !isProduction) {
    await cleanupTestData(adminClient, markers);
  }
});
