/**
 * Integration test: get_purchase_order_detail trả available_units (2026-04-22)
 *
 * Regression guard cho fix dropdown UOM PO:
 * - RPC trả `available_units` array đầy đủ từ product_units (không chỉ wholesale/retail)
 * - Frontend dropdown sẽ render hết các unit để user chọn (Tub, Lon, Hộp, Vỉ...)
 * Bug gốc: dropdown chỉ thấy Hộp/Vỉ từ cột cũ products → user chọn Tub bị overwrite về Hộp.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { adminClient } from "../helpers/supabase";

describe("RPC get_purchase_order_detail — available_units", () => {
  let testProductId: number;
  let testPoId: number;
  let testSupplierId: number;
  const cleanup = {
    poId: 0,
    productId: 0,
    supplierIdCreated: false as boolean,
  };

  beforeAll(async () => {
    // 1. Tìm hoặc tạo supplier
    const { data: existing } = await adminClient
      .from("suppliers")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (existing) {
      testSupplierId = existing.id;
    } else {
      const { data: created, error } = await adminClient
        .from("suppliers")
        .insert({ name: `TEST_RPC_SUPPLIER_${Date.now()}`, status: "active" })
        .select("id")
        .single();
      if (error || !created)
        throw new Error(`Seed supplier failed: ${error?.message}`);
      testSupplierId = created.id;
      cleanup.supplierIdCreated = true;
    }

    // 2. Seed product có 3 units (Vỉ base, Hộp wholesale, Tub wholesale)
    const sku = `TEST-PO-UOM-${Date.now()}`;
    const { data: product, error: pErr } = await adminClient
      .from("products")
      .insert({
        name: "TEST_RPC Bocalex Sủi",
        sku,
        status: "active",
        wholesale_unit: "Hộp",
        retail_unit: "Vỉ",
        items_per_carton: 10,
      })
      .select("id")
      .single();
    if (pErr || !product)
      throw new Error(`Seed product failed: ${pErr?.message}`);
    testProductId = product.id;
    cleanup.productId = testProductId;

    const { error: uErr } = await adminClient.from("product_units").insert([
      {
        product_id: testProductId,
        unit_name: "Vỉ",
        conversion_rate: 1,
        unit_type: "retail",
        is_base: true,
        price_cost: 0,
        price_sell: 25000,
      },
      {
        product_id: testProductId,
        unit_name: "Hộp",
        conversion_rate: 10,
        unit_type: "wholesale",
        is_base: false,
        price_cost: 0,
        price_sell: 250000,
      },
      {
        product_id: testProductId,
        unit_name: "Tub",
        conversion_rate: 20,
        unit_type: "wholesale",
        is_base: false,
        price_cost: 0,
        price_sell: 500000,
      },
    ]);
    if (uErr) throw new Error(`Seed product_units failed: ${uErr.message}`);

    // 3. Seed PO + 1 item UOM = "Tub"
    const { data: po, error: poErr } = await adminClient
      .from("purchase_orders")
      .insert({
        supplier_id: testSupplierId,
        status: "PENDING",
        code: `TEST-PO-${Date.now()}`,
      })
      .select("id")
      .single();
    if (poErr || !po) throw new Error(`Seed PO failed: ${poErr?.message}`);
    testPoId = po.id;
    cleanup.poId = testPoId;

    const { error: poiErr } = await adminClient
      .from("purchase_order_items")
      .insert({
        po_id: testPoId,
        product_id: testProductId,
        quantity_ordered: 5,
        uom_ordered: "Tub",
        unit_price: 500000,
      });
    if (poiErr) throw new Error(`Seed PO item failed: ${poiErr.message}`);
  });

  afterAll(async () => {
    if (cleanup.poId) {
      await adminClient
        .from("purchase_order_items")
        .delete()
        .eq("po_id", cleanup.poId);
      await adminClient.from("purchase_orders").delete().eq("id", cleanup.poId);
    }
    if (cleanup.productId) {
      await adminClient
        .from("product_units")
        .delete()
        .eq("product_id", cleanup.productId);
      await adminClient.from("products").delete().eq("id", cleanup.productId);
    }
    // Chỉ xóa supplier nếu test này tạo ra
    if (cleanup.supplierIdCreated) {
      await adminClient.from("suppliers").delete().eq("id", testSupplierId);
    }
  });

  it("returns available_units array containing all units from product_units", async () => {
    const { data, error } = await adminClient.rpc("get_purchase_order_detail", {
      p_po_id: testPoId,
    });
    expect(error).toBeNull();
    expect(data).not.toBeNull();

    const items = (
      data as {
        items: Array<{
          uom_ordered: string;
          available_units: Array<{
            unit_name: string;
            conversion_rate: number;
            is_base: boolean;
          }>;
        }>;
      }
    ).items;

    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(1);

    const item = items[0];
    expect(item.uom_ordered).toBe("Tub");
    expect(Array.isArray(item.available_units)).toBe(true);
    expect(item.available_units.length).toBe(3);

    const names = item.available_units.map((u) => u.unit_name);
    expect(names).toContain("Tub");
    expect(names).toContain("Hộp");
    expect(names).toContain("Vỉ");
  });

  it("orders units by is_base DESC then conversion_rate ASC", async () => {
    const { data } = await adminClient.rpc("get_purchase_order_detail", {
      p_po_id: testPoId,
    });

    const items = (
      data as {
        items: Array<{
          available_units: Array<{
            unit_name: string;
            is_base: boolean;
            conversion_rate: number;
          }>;
        }>;
      }
    ).items;

    const units = items[0].available_units;
    // is_base=true (Vỉ) phải đứng đầu
    expect(units[0].unit_name).toBe("Vỉ");
    expect(units[0].is_base).toBe(true);
    // Còn lại sort tăng dần conversion_rate: Hộp(10) trước Tub(20)
    expect(units[1].unit_name).toBe("Hộp");
    expect(units[2].unit_name).toBe("Tub");
  });
});
