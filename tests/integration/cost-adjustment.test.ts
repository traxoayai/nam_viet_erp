// Integration test: bulk_update_batch_costs
// Happy path + edge cases, seed fake product/batch/inventory_batch/vat_ledger,
// gọi RPC, assert 3 bảng đồng bộ, cleanup.
//
// Yêu cầu: local Supabase đang chạy (127.0.0.1:54321) với migration mới nhất.

import { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe as _describe, expect, it } from "vitest";

import {
  adminClient,
  createUserClient,
  isProduction,
} from "../helpers/supabase";

// Không seed data trên production
const describe = isProduction ? _describe.skip : _describe;

interface SeedRefs {
  productId: number;
  batchId: number;
  warehouseId: number;
  inventoryBatchId: number;
  ledger8Id: number;
  ledger10Id: number;
}

const UNIQUE = `COST-ADJ-${Date.now()}`;
const INBOUND_PRICE_INIT = 20000;
const QTY_IN_BATCH = 10;
const VAT_QTY_8 = 4;
const VAT_VALUE_8 = VAT_QTY_8 * INBOUND_PRICE_INIT;
const VAT_QTY_10 = 6;
const VAT_VALUE_10 = VAT_QTY_10 * INBOUND_PRICE_INIT;

const seed: Partial<SeedRefs> = {};
let userClient: SupabaseClient;

describe("bulk_update_batch_costs (integration)", () => {
  beforeAll(async () => {
    // Authenticated client — RPC yêu cầu auth.uid() IS NOT NULL
    const staffPassword = process.env.TEST_STAFF_PASSWORD;
    if (!staffPassword) {
      throw new Error("TEST_STAFF_PASSWORD env var required (do not hardcode)");
    }
    userClient = await createUserClient("admin@test.com", staffPassword);

    // Cleanup zombie data từ các lần chạy trước bị interrupt
    // (tránh để product/batch cũ làm nhiễu test khác hoặc crash seeding)
    const { data: staleProducts } = await adminClient
      .from("products")
      .select("id")
      .like("sku", "COST-ADJ-%");
    if (staleProducts && staleProducts.length > 0) {
      const ids = staleProducts.map((p) => p.id);
      await adminClient
        .from("batch_revaluations")
        .delete()
        .in("product_id", ids);
      await adminClient
        .from("vat_inventory_ledger")
        .delete()
        .in("product_id", ids);
      await adminClient
        .from("inventory_batches")
        .delete()
        .in("product_id", ids);
      await adminClient.from("batches").delete().in("product_id", ids);
      await adminClient.from("products").delete().in("id", ids);
    }

    // 1. Chọn 1 warehouse có sẵn (không tạo mới để tránh FK phức tạp)
    const { data: wh } = await adminClient
      .from("warehouses")
      .select("id")
      .limit(1)
      .single();
    if (!wh) throw new Error("No warehouse available for integration test");
    seed.warehouseId = wh.id;

    // 2. Seed product — resync products_id_seq để tránh va chạm với id được
    //    insert thẳng trong migrations/seed cũ
    const { data: maxRow } = await adminClient
      .from("products")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextId = (maxRow?.id ?? 0) + 1000; // cách xa để seed không đụng

    // status='inactive' để không làm nhiễu các data-quality test khác
    // (vd: medical-unit-lookup chỉ kiểm tra active products)
    const { data: prod, error: prodErr } = await adminClient
      .from("products")
      .insert({
        id: nextId,
        name: `${UNIQUE} product`,
        sku: `${UNIQUE}-SKU`,
        actual_cost: INBOUND_PRICE_INIT,
        status: "inactive",
      })
      .select("id")
      .single();
    if (prodErr || !prod) throw prodErr || new Error("seed product failed");
    seed.productId = prod.id;

    // 3. Seed batch (giá vốn ban đầu = 20000)
    const { data: batch, error: batchErr } = await adminClient
      .from("batches")
      .insert({
        product_id: seed.productId,
        batch_code: `${UNIQUE}-LOT`,
        expiry_date: "2027-12-31",
        inbound_price: INBOUND_PRICE_INIT,
      })
      .select("id")
      .single();
    if (batchErr || !batch) throw batchErr || new Error("seed batch failed");
    seed.batchId = batch.id;

    // 4. Seed inventory_batch: 10 hộp tồn
    const { data: ib, error: ibErr } = await adminClient
      .from("inventory_batches")
      .insert({
        warehouse_id: seed.warehouseId,
        product_id: seed.productId,
        batch_id: seed.batchId,
        quantity: QTY_IN_BATCH,
      })
      .select("id")
      .single();
    if (ibErr || !ib) throw ibErr || new Error("seed inventory_batch failed");
    seed.inventoryBatchId = ib.id;

    // 5. Seed vat_inventory_ledger: 2 dòng (VAT 8% qty=4, VAT 10% qty=6)
    const { data: lg8, error: l8Err } = await adminClient
      .from("vat_inventory_ledger")
      .insert({
        product_id: seed.productId,
        vat_rate: 8,
        quantity_balance: VAT_QTY_8,
        total_value_balance: VAT_VALUE_8,
      })
      .select("id")
      .single();
    if (l8Err || !lg8) throw l8Err || new Error("seed ledger 8% failed");
    seed.ledger8Id = lg8.id;

    const { data: lg10, error: l10Err } = await adminClient
      .from("vat_inventory_ledger")
      .insert({
        product_id: seed.productId,
        vat_rate: 10,
        quantity_balance: VAT_QTY_10,
        total_value_balance: VAT_VALUE_10,
      })
      .select("id")
      .single();
    if (l10Err || !lg10) throw l10Err || new Error("seed ledger 10% failed");
    seed.ledger10Id = lg10.id;
  });

  afterAll(async () => {
    if (!seed.productId) return;
    // Xóa ngược thứ tự FK
    await adminClient
      .from("batch_revaluations")
      .delete()
      .eq("product_id", seed.productId);
    if (seed.ledger8Id)
      await adminClient
        .from("vat_inventory_ledger")
        .delete()
        .eq("id", seed.ledger8Id);
    if (seed.ledger10Id)
      await adminClient
        .from("vat_inventory_ledger")
        .delete()
        .eq("id", seed.ledger10Id);
    if (seed.inventoryBatchId)
      await adminClient
        .from("inventory_batches")
        .delete()
        .eq("id", seed.inventoryBatchId);
    if (seed.batchId)
      await adminClient.from("batches").delete().eq("id", seed.batchId);
    if (seed.productId)
      await adminClient.from("products").delete().eq("id", seed.productId);
  });

  it("happy path: updates batches.inbound_price + inserts audit + syncs VAT ledger theo tỉ lệ qty", async () => {
    // Act: tăng giá từ 20.000 → 25.000, delta/unit = +5.000, total delta = 10 × 5.000 = 50.000
    const { data, error } = await userClient.rpc("bulk_update_batch_costs", {
      p_changes: [{ batch_id: seed.batchId!, new_price: 25000 }],
      p_reason: "supplier_adjust",
      p_note: "Integration test",
    });

    expect(error).toBeNull();
    expect((data as any)?.status).toBe("success");
    expect((data as any)?.updated_count).toBe(1);

    // Assert 1: batches.inbound_price updated
    const { data: batchAfter } = await adminClient
      .from("batches")
      .select("inbound_price")
      .eq("id", seed.batchId!)
      .single();
    expect(Number(batchAfter?.inbound_price)).toBe(25000);

    // Assert 2: batch_revaluations có audit row
    const { data: audits } = await adminClient
      .from("batch_revaluations")
      .select("*")
      .eq("batch_id", seed.batchId!);
    expect(audits).toHaveLength(1);
    const audit = audits![0];
    expect(Number(audit.old_price)).toBe(INBOUND_PRICE_INIT);
    expect(Number(audit.new_price)).toBe(25000);
    expect(audit.qty_at_change).toBe(QTY_IN_BATCH);
    expect(Number(audit.delta_value)).toBe(50000);
    expect(audit.reason_code).toBe("supplier_adjust");
    expect(audit.vat_synced).toBe(true);

    // Assert 3: vat_inventory_ledger total_value_balance sync theo tỉ lệ qty
    // Total ledger qty = 4 + 6 = 10. Delta total = 50.000
    //   VAT 8%:  share = 4/10 = 0.4 → +20.000 → 80.000 + 20.000 = 100.000
    //   VAT 10%: share = 6/10 = 0.6 → +30.000 → 120.000 + 30.000 = 150.000
    const { data: lg8After } = await adminClient
      .from("vat_inventory_ledger")
      .select("total_value_balance")
      .eq("id", seed.ledger8Id!)
      .single();
    const { data: lg10After } = await adminClient
      .from("vat_inventory_ledger")
      .select("total_value_balance")
      .eq("id", seed.ledger10Id!)
      .single();

    expect(Number(lg8After?.total_value_balance)).toBeCloseTo(100000, 0);
    expect(Number(lg10After?.total_value_balance)).toBeCloseTo(150000, 0);
  });

  it("idempotency: gọi lại cùng giá không tạo audit mới", async () => {
    const { data, error } = await userClient.rpc("bulk_update_batch_costs", {
      p_changes: [{ batch_id: seed.batchId!, new_price: 25000 }],
      p_reason: "data_fix",
    });

    expect(error).toBeNull();
    expect((data as any)?.status).toBe("success");
    expect((data as any)?.updated_count).toBe(0);
    expect((data as any)?.skipped_count).toBeGreaterThanOrEqual(1);

    const { data: audits } = await adminClient
      .from("batch_revaluations")
      .select("id")
      .eq("batch_id", seed.batchId!);
    // Vẫn chỉ có 1 audit từ happy path test trước
    expect(audits?.length).toBeLessThanOrEqual(1);
  });

  it("invalid reason_code → status=error, không đổi DB", async () => {
    const priceBefore = 25000;

    const { data } = await userClient.rpc("bulk_update_batch_costs", {
      p_changes: [{ batch_id: seed.batchId!, new_price: 99000 }],
      p_reason: "bad_reason",
    });

    expect((data as any)?.status).toBe("error");

    const { data: batchAfter } = await adminClient
      .from("batches")
      .select("inbound_price")
      .eq("id", seed.batchId!)
      .single();
    expect(Number(batchAfter?.inbound_price)).toBe(priceBefore);
  });

  it("batch không tồn tại → skipped", async () => {
    const { data, error } = await userClient.rpc("bulk_update_batch_costs", {
      p_changes: [{ batch_id: 999999999, new_price: 1 }],
      p_reason: "data_fix",
    });

    expect(error).toBeNull();
    expect((data as any)?.status).toBe("success");
    expect((data as any)?.updated_count).toBe(0);
    expect((data as any)?.skipped_count).toBe(1);
  });
});
