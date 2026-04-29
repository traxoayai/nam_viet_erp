import { describe, it, expect } from "vitest";

import { adminClient, isProduction } from "../helpers/supabase";

import {
  createTestWarehouse,
  createTestProduct,
  createTestB2BCustomer,
  createTestOrder,
  cleanupTestData,
} from "./helpers/fixtures";

/**
 * Regression: `get_outbound_order_detail` PHẢI sort items theo
 * `shelf_location` ASC để phiếu nhặt + UI đóng hàng đi đúng đường kệ.
 *
 * Ngoài ra mỗi item lấy đúng shelf_location của KHO XUẤT (warehouse_id của
 * order), không lẫn sang kho khác.
 *
 * SAFETY: chỉ chạy local.
 */
describe("get_outbound_order_detail: ORDER BY shelf_location", () => {
  const skipOnProd = isProduction;

  it.skipIf(skipOnProd)(
    "items trả về sort theo shelf_location ASC + lấy đúng kho xuất",
    async () => {
      const marker = `OBSORT-${Date.now()}`;
      try {
        const warehouseId = await createTestWarehouse(adminClient, {
          name: marker,
        });
        const otherWarehouseId = await createTestWarehouse(adminClient, {
          name: `${marker}-OTHER`,
        });
        const customerB2bId = await createTestB2BCustomer(adminClient, {
          name: marker,
        });

        // 3 products, shelf_location ngẫu nhiên thứ tự để test sort
        const { productId: pZ } = await createTestProduct(adminClient, {
          name: `${marker}-Z`,
        });
        const { productId: pA } = await createTestProduct(adminClient, {
          name: `${marker}-A`,
        });
        const { productId: pM } = await createTestProduct(adminClient, {
          name: `${marker}-M`,
        });

        // Đặt shelf_location cho từng product trong KHO XUẤT
        const { error: invErr } = await adminClient
          .from("product_inventory")
          .insert([
            {
              product_id: pZ,
              warehouse_id: warehouseId,
              shelf_location: "Z-99-99",
              stock_quantity: 100,
            },
            {
              product_id: pA,
              warehouse_id: warehouseId,
              shelf_location: "A-01-01",
              stock_quantity: 100,
            },
            {
              product_id: pM,
              warehouse_id: warehouseId,
              shelf_location: "M-50-50",
              stock_quantity: 100,
            },
            // Kho KHÁC: shelf khác — RPC PHẢI bỏ qua
            {
              product_id: pA,
              warehouse_id: otherWarehouseId,
              shelf_location: "OTHER-01",
              stock_quantity: 100,
            },
          ]);
        if (invErr)
          throw new Error(`seed product_inventory: ${invErr.message}`);

        const order = await createTestOrder(adminClient, {
          customerB2bId,
          warehouseId,
          status: "CONFIRMED",
          orderType: "B2B",
          code: `TEST-INTEGRATION-ORD-OBSORT-${marker}`,
          items: [
            { productId: pZ, quantity: 1, unitPrice: 10000 },
            { productId: pA, quantity: 1, unitPrice: 10000 },
            { productId: pM, quantity: 1, unitPrice: 10000 },
          ],
        });

        const { data, error } = await adminClient.rpc(
          "get_outbound_order_detail",
          { p_order_id: order.orderId }
        );
        expect(error).toBeNull();
        expect(data).toBeTruthy();

        const payload = data as unknown as {
          items: Array<{ product_id: number; shelf_location: string }>;
        };

        // Filter chỉ items của test (RPC trả tất cả items của order)
        const items = payload.items.filter((it) =>
          [pA, pM, pZ].includes(it.product_id)
        );
        expect(items.length).toBe(3);

        const locations = items.map((it) => it.shelf_location);
        expect(locations).toEqual(["A-01-01", "M-50-50", "Z-99-99"]);
        // Không lẫn shelf của kho khác
        expect(locations).not.toContain("OTHER-01");
      } finally {
        // Cleanup product_inventory rows trước khi xóa products/warehouses
        const { data: prodRows } = await adminClient
          .from("products")
          .select("id")
          .like("name", `%${marker}%`);
        const prodIds = (prodRows ?? []).map((p) => p.id);
        if (prodIds.length > 0) {
          await adminClient
            .from("product_inventory")
            .delete()
            .in("product_id", prodIds);
        }
        await cleanupTestData(adminClient, [marker]);
      }
    },
    60000
  );
});
