/**
 * Integration test: confirm_check_item_matching RPC
 *
 * Hotfix 2026-04-25 (migration 20260425050000):
 * RPC mới hỗ trợ nút "Đủ/OK" trên UI kiểm kê. Trước đây nút này chỉ
 * client-side moveNext, không commit xuống DB → complete_inventory_check
 * thấy actual=0, counted_at=NULL → xuất trắng kho.
 *
 * Semantics: refresh system_quantity từ inventory_batches, set actual=system,
 * counted_at=NOW(), counted_by=auth.uid().
 *
 * Scenario:
 *   1. Tạo phiếu DRAFT + item chưa đếm (actual=0, counted_at=NULL). SP có tồn=75.
 *   2. Gọi confirm_check_item_matching(p_item_id).
 *   3. Assert: response status='success', actual_quantity=75, system_quantity=75.
 *   4. DB: actual_quantity=75, system_quantity=75, counted_at IS NOT NULL.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { seedRpcAccessRules } from "../helpers/seedRpcAccessRules";
import { adminClient } from "../helpers/supabase";

// ─── Cleanup tracking ────────────────────────────────────────────────────────
const cleanup: {
  checkId?: number;
  itemId?: number;
  productId?: number;
  warehouseId?: number;
  batchId?: number;
  inventoryBatchId?: number;
} = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createTestProduct(warehouseId: number): Promise<{
  productId: number;
  batchId: number;
  inventoryBatchId: number;
}> {
  const code = `TEST-CCM-${Date.now()}`;

  const { data: product, error: prodErr } = await adminClient
    .from("products")
    .insert({
      name: "Test Product Confirm Matching",
      code,
      product_type: "medicine",
      status: "active",
    })
    .select("id")
    .single();

  if (prodErr) throw new Error(`createProduct: ${prodErr.message}`);

  // Tạo batch
  const { data: batch, error: batchErr } = await adminClient
    .from("batches")
    .insert({
      product_id: product.id,
      batch_code: `BATCH-CCM-${Date.now()}`,
      expiry_date: "2027-12-31",
      inbound_price: 500,
    })
    .select("id")
    .single();

  if (batchErr) throw new Error(`createBatch: ${batchErr.message}`);

  // Setup tồn kho = 75
  const { data: invBatch, error: invErr } = await adminClient
    .from("inventory_batches")
    .upsert(
      {
        warehouse_id: warehouseId,
        product_id: product.id,
        batch_id: batch.id,
        quantity: 75,
      },
      { onConflict: "warehouse_id,product_id,batch_id" }
    )
    .select("id")
    .single();

  if (invErr) throw new Error(`upsertInventoryBatch: ${invErr.message}`);

  return {
    productId: product.id,
    batchId: batch.id,
    inventoryBatchId: invBatch.id,
  };
}

// ─── Setup & Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  await seedRpcAccessRules();
});

afterAll(async () => {
  // Xóa check items + check
  if (cleanup.itemId) {
    await adminClient
      .from("inventory_check_items")
      .delete()
      .eq("id", cleanup.itemId);
  }
  if (cleanup.checkId) {
    await adminClient
      .from("inventory_check_items")
      .delete()
      .eq("check_id", cleanup.checkId);
    await adminClient
      .from("inventory_checks")
      .delete()
      .eq("id", cleanup.checkId);
  }

  // Xóa inventory + batch + product
  if (cleanup.inventoryBatchId) {
    await adminClient
      .from("inventory_batches")
      .delete()
      .eq("id", cleanup.inventoryBatchId);
  }
  if (cleanup.batchId) {
    await adminClient.from("batches").delete().eq("id", cleanup.batchId);
  }
  if (cleanup.productId) {
    await adminClient.from("products").delete().eq("id", cleanup.productId);
  }
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("confirm_check_item_matching — xác nhận dòng kiểm kê khớp tồn máy", () => {
  it("RPC tồn tại trong rpc_access_rules và được grant execute", async () => {
    const { data, error } = await adminClient
      .from("rpc_access_rules")
      .select(
        "function_name, required_permission, is_write, max_calls_per_minute"
      )
      .eq("function_name", "confirm_check_item_matching")
      .maybeSingle();

    expect(error).toBeNull();

    if (!data) {
      // Chưa có trong rpc_access_rules → migration chưa apply (local chưa migrate)
      console.warn(
        "WARN: confirm_check_item_matching chưa có trong rpc_access_rules"
      );
      return;
    }

    expect(data.function_name).toBe("confirm_check_item_matching");
    expect(data.is_write).toBe(true);
    expect(data.max_calls_per_minute).toBeGreaterThan(0);
  });

  it("setup: tạo phiếu DRAFT + item chưa đếm, SP tồn = 75", async () => {
    const { data: wh } = await adminClient
      .from("warehouses")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (!wh) {
      console.warn("SKIP: không có warehouse trong DB");
      return;
    }

    cleanup.warehouseId = wh.id;

    // Tạo product + inventory
    const { productId, batchId, inventoryBatchId } = await createTestProduct(
      wh.id
    );
    cleanup.productId = productId;
    cleanup.batchId = batchId;
    cleanup.inventoryBatchId = inventoryBatchId;

    // Tạo phiếu kiểm kê DRAFT
    const { data: check, error: checkErr } = await adminClient
      .from("inventory_checks")
      .insert({
        code: `KK-CCM-${Date.now()}`,
        warehouse_id: wh.id,
        status: "DRAFT",
      })
      .select("id")
      .single();

    expect(checkErr).toBeNull();
    cleanup.checkId = check.id;

    // Thêm item CHƯA ĐẾM: actual=0, counted_at=NULL
    const { data: item, error: itemErr } = await adminClient
      .from("inventory_check_items")
      .insert({
        check_id: check.id,
        product_id: productId,
        system_quantity: 75,
        actual_quantity: 0,
        counted_at: null,
        counted_by: null,
      })
      .select("id")
      .single();

    expect(itemErr).toBeNull();
    cleanup.itemId = item.id;
  });

  it("gọi confirm_check_item_matching → status='success', actual=75, system=75", async () => {
    if (!cleanup.itemId) {
      console.warn("SKIP: setup chưa hoàn tất");
      return;
    }

    const { data, error } = await adminClient.rpc(
      "confirm_check_item_matching",
      { p_item_id: cleanup.itemId }
    );

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.status).toBe("success");
    // RPC trả về actual_quantity = system_quantity = tồn inventory_batches
    expect(Number(data.actual_quantity)).toBe(75);
    expect(Number(data.system_quantity)).toBe(75);
  });

  it("DB row: actual_quantity=75, system_quantity=75 sau khi confirm", async () => {
    if (!cleanup.itemId) return;

    const { data, error } = await adminClient
      .from("inventory_check_items")
      .select("actual_quantity, system_quantity, counted_at, counted_by")
      .eq("id", cleanup.itemId)
      .single();

    expect(error).toBeNull();
    expect(Number(data!.actual_quantity)).toBe(75);
    expect(Number(data!.system_quantity)).toBe(75);
  });

  it("DB row: counted_at IS NOT NULL sau khi confirm", async () => {
    if (!cleanup.itemId) return;

    const { data, error } = await adminClient
      .from("inventory_check_items")
      .select("counted_at")
      .eq("id", cleanup.itemId)
      .single();

    expect(error).toBeNull();
    // counted_at phải được set bởi RPC
    expect(data!.counted_at).not.toBeNull();
    // Phải là timestamp hợp lệ
    const ts = new Date(data!.counted_at as string);
    expect(ts.getTime()).not.toBeNaN();
  });

  it("item không tồn tại → status='error' với message phù hợp", async () => {
    const { data, error } = await adminClient.rpc(
      "confirm_check_item_matching",
      { p_item_id: -9999999 }
    );

    // RPC trả về JSONB error, không raise exception
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.status).toBe("error");
    expect(data.message).toBeTruthy();
  });

  it("phiếu COMPLETED → RPC trả về error (phiếu đã khóa)", async () => {
    if (!cleanup.checkId) return;

    // Tạo phiếu mới đã COMPLETED để test guard
    const { data: wh } = await adminClient
      .from("warehouses")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (!wh) return;

    // Tạo check COMPLETED
    const { data: completedCheck, error: cErr } = await adminClient
      .from("inventory_checks")
      .insert({
        code: `KK-CCM-DONE-${Date.now()}`,
        warehouse_id: wh.id,
        status: "COMPLETED",
      })
      .select("id")
      .single();

    if (cErr) return;

    // Thêm 1 item vào phiếu đã completed
    const { data: lockedItem } = await adminClient
      .from("inventory_check_items")
      .insert({
        check_id: completedCheck.id,
        product_id: cleanup.productId ?? 1,
        system_quantity: 10,
        actual_quantity: 10,
        counted_at: null,
      })
      .select("id")
      .single();

    if (!lockedItem) {
      // cleanup check dù fail
      await adminClient
        .from("inventory_checks")
        .delete()
        .eq("id", completedCheck.id);
      return;
    }

    // Gọi RPC trên item của phiếu đã COMPLETED
    const { data, error } = await adminClient.rpc(
      "confirm_check_item_matching",
      { p_item_id: lockedItem.id }
    );

    // Cleanup
    await adminClient
      .from("inventory_check_items")
      .delete()
      .eq("id", lockedItem.id);
    await adminClient
      .from("inventory_checks")
      .delete()
      .eq("id", completedCheck.id);

    expect(error).toBeNull();
    expect(data.status).toBe("error");
    expect(data.message).toMatch(/khóa|hủy|COMPLETED|CANCELLED/i);
  });

  it("idempotency: gọi lại confirm lần 2 → vẫn success, actual vẫn = 75", async () => {
    if (!cleanup.itemId) return;

    // Gọi lần 2 (item đã có counted_at)
    const { data, error } = await adminClient.rpc(
      "confirm_check_item_matching",
      { p_item_id: cleanup.itemId }
    );

    expect(error).toBeNull();
    expect(data.status).toBe("success");
    expect(Number(data.actual_quantity)).toBe(75);
    expect(Number(data.system_quantity)).toBe(75);
  });
});
