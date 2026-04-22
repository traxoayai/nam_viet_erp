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
 * Regression test cho migration `20260422160000_fix_warehouse_outbound_exclude_pending.sql`.
 *
 * Fix: `get_warehouse_outbound_tasks` chuyển từ blacklist (NOT IN 'DRAFT','QUOTE')
 * sang whitelist (IN 'CONFIRMED','PACKED','SHIPPING','DELIVERED','COMPLETED','CANCELLED').
 *
 * Mục tiêu: đơn Portal PENDING (chưa thanh toán) KHÔNG lọt vào danh sách kho xuất.
 *
 * SAFETY: chỉ chạy local (TEST_TARGET != 'prod').
 */
describe("get_warehouse_outbound_tasks: whitelist status filter", () => {
  const skipOnProd = isProduction;

  it.skipIf(skipOnProd)(
    "ẩn đơn PENDING, DRAFT khỏi warehouse tasks; hiển thị CONFIRMED",
    async () => {
      const marker = `WHFILTER-${Date.now()}`;
      try {
        // Setup fixtures
        const warehouseId = await createTestWarehouse(adminClient, {
          name: marker,
        });
        const { productId } = await createTestProduct(adminClient, {
          name: marker,
        });
        const customerB2bId = await createTestB2BCustomer(adminClient, {
          name: marker,
        });

        const pendingOrder = await createTestOrder(adminClient, {
          customerB2bId,
          warehouseId,
          status: "PENDING",
          orderType: "B2B",
          code: `TEST-INTEGRATION-ORD-PENDING-${marker}`,
          items: [{ productId, quantity: 1, unitPrice: 10000 }],
        });

        const draftOrder = await createTestOrder(adminClient, {
          customerB2bId,
          warehouseId,
          status: "DRAFT",
          orderType: "B2B",
          code: `TEST-INTEGRATION-ORD-DRAFT-${marker}`,
          items: [{ productId, quantity: 1, unitPrice: 10000 }],
        });

        const confirmedOrder = await createTestOrder(adminClient, {
          customerB2bId,
          warehouseId,
          status: "CONFIRMED",
          orderType: "B2B",
          code: `TEST-INTEGRATION-ORD-CONFIRMED-${marker}`,
          items: [{ productId, quantity: 1, unitPrice: 10000 }],
        });

        // Gọi RPC với search = marker để locate đơn test. `get_warehouse_outbound_tasks`
        // search ILIKE code/customer name → marker nằm trong customer_name nên hit hết.
        const { data, error } = await adminClient.rpc(
          "get_warehouse_outbound_tasks",
          {
            p_page: 1,
            p_page_size: 100,
            p_search: marker,
          }
        );

        expect(error).toBeNull();
        expect(Array.isArray(data)).toBe(true);

        const rows = (data ?? []) as Array<{ code: string; status: string }>;
        const codes = new Set(rows.map((r) => r.code));

        // PENDING, DRAFT PHẢI bị ẩn
        expect(codes.has(pendingOrder.orderCode)).toBe(false);
        expect(codes.has(draftOrder.orderCode)).toBe(false);

        // CONFIRMED PHẢI hiện
        expect(codes.has(confirmedOrder.orderCode)).toBe(true);
        const confirmedRow = rows.find(
          (r) => r.code === confirmedOrder.orderCode
        );
        expect(confirmedRow?.status).toBe("CONFIRMED");
      } finally {
        await cleanupTestData(adminClient, [marker]);
      }
    },
    60000
  );

  it.skipIf(skipOnProd)(
    "hiển thị CANCELLED (tab Đã hủy), PACKED, SHIPPING",
    async () => {
      const marker = `WHFILTER2-${Date.now()}`;
      try {
        const warehouseId = await createTestWarehouse(adminClient, {
          name: marker,
        });
        const { productId } = await createTestProduct(adminClient, {
          name: marker,
        });
        const customerB2bId = await createTestB2BCustomer(adminClient, {
          name: marker,
        });

        const cancelledOrder = await createTestOrder(adminClient, {
          customerB2bId,
          warehouseId,
          status: "CANCELLED",
          orderType: "B2B",
          code: `TEST-INTEGRATION-ORD-CANCELLED-${marker}`,
          items: [{ productId, quantity: 1, unitPrice: 10000 }],
        });

        const { data, error } = await adminClient.rpc(
          "get_warehouse_outbound_tasks",
          {
            p_page: 1,
            p_page_size: 100,
            p_search: marker,
          }
        );

        expect(error).toBeNull();
        const rows = (data ?? []) as Array<{
          code: string;
          status: string;
          status_label: string;
        }>;
        const row = rows.find((r) => r.code === cancelledOrder.orderCode);
        expect(row).toBeDefined();
        expect(row?.status).toBe("CANCELLED");
        expect(row?.status_label).toBe("Đã hủy");
      } finally {
        await cleanupTestData(adminClient, [marker]);
      }
    },
    60000
  );
});
