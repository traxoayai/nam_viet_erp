// Regression test: get_inbound_detail — fallback uom_ordered → product_units
//
// Migration 20260423130000 sửa COALESCE cho field `item.unit` trong response:
//   uom_ordered  →  product_units(wholesale)  →  product_units(base)
//                →  product_units(first by id) →  poi.unit  →  'Hộp'
//
// Test này đảm bảo mọi nhánh fallback trả đúng giá trị và RPC không bao giờ
// return NULL cho `unit` (do final fallback là literal 'Hộp').

import { afterAll, beforeAll, describe as _describe, expect, it } from "vitest";
import { adminClient, isProduction } from "../helpers/supabase";

const describe = isProduction ? _describe.skip : _describe;

const UNIQUE = `INBOUND-FB-${Date.now()}`;

type Scenario = {
  key: string;
  sku: string;
  name: string;
  productId?: number;
  /** Giá trị điền vào purchase_order_items.uom_ordered */
  uomOrdered: string | null;
  /** Giá trị điền vào purchase_order_items.unit (legacy field) */
  poiUnit: string | null;
  /** product_units seed cho SP này. [] = không seed → fallback xuống poi.unit/'Hộp' */
  units: Array<{
    unit_name: string;
    unit_type: "base" | "retail" | "wholesale" | "logistics";
    is_base?: boolean;
  }>;
  /** Giá trị `unit` mong đợi RPC trả về */
  expected: string;
};

const scenarios: Scenario[] = [
  {
    key: "uom_ordered_wins",
    sku: `${UNIQUE}-S1`,
    name: `${UNIQUE} scenario 1 — uom_ordered set`,
    uomOrdered: "Tuýp",
    poiUnit: "Hộp",
    units: [
      { unit_name: "Viên", unit_type: "base", is_base: true },
      { unit_name: "Tuýp", unit_type: "wholesale" },
    ],
    expected: "Tuýp",
  },
  {
    key: "fallback_wholesale",
    sku: `${UNIQUE}-S2`,
    name: `${UNIQUE} scenario 2 — uom null → wholesale`,
    uomOrdered: null,
    poiUnit: "Hộp",
    units: [
      { unit_name: "Viên", unit_type: "base", is_base: true },
      { unit_name: "Thùng", unit_type: "wholesale" },
    ],
    expected: "Thùng",
  },
  {
    key: "fallback_wholesale_empty_string",
    sku: `${UNIQUE}-S3`,
    name: `${UNIQUE} scenario 3 — uom '' (empty) → wholesale (NULLIF TRIM)`,
    uomOrdered: "   ",
    poiUnit: "Hộp",
    units: [
      { unit_name: "Viên", unit_type: "base", is_base: true },
      { unit_name: "Lốc", unit_type: "wholesale" },
    ],
    expected: "Lốc",
  },
  {
    key: "fallback_base",
    sku: `${UNIQUE}-S4`,
    name: `${UNIQUE} scenario 4 — uom null, no wholesale → base`,
    uomOrdered: null,
    poiUnit: "Hộp",
    units: [{ unit_name: "Chai", unit_type: "base", is_base: true }],
    expected: "Chai",
  },
  {
    key: "fallback_first_unit",
    sku: `${UNIQUE}-S5`,
    name: `${UNIQUE} scenario 5 — uom null, no wholesale/base → first by id`,
    uomOrdered: null,
    poiUnit: "Hộp",
    units: [
      { unit_name: "Gói", unit_type: "retail" },
      { unit_name: "Thùng nhỏ", unit_type: "logistics" },
    ],
    expected: "Gói",
  },
  {
    key: "fallback_poi_unit",
    sku: `${UNIQUE}-S6`,
    name: `${UNIQUE} scenario 6 — no product_units → poi.unit`,
    uomOrdered: null,
    poiUnit: "Cái",
    units: [],
    expected: "Cái",
  },
  {
    key: "fallback_hardcoded_hop",
    sku: `${UNIQUE}-S7`,
    name: `${UNIQUE} scenario 7 — no units + no poi.unit → 'Hộp'`,
    uomOrdered: null,
    poiUnit: null,
    units: [],
    expected: "Hộp",
  },
];

let supplierId: number;
let poId: number;

describe("get_inbound_detail — fallback uom_ordered → product_units (integration)", () => {
  beforeAll(async () => {
    const { data: staleProducts } = await adminClient
      .from("products")
      .select("id")
      .like("sku", "INBOUND-FB-%");
    if (staleProducts && staleProducts.length > 0) {
      const ids = staleProducts.map((p) => p.id);
      await adminClient.from("purchase_order_items").delete().in("product_id", ids);
      await adminClient.from("product_units").delete().in("product_id", ids);
      await adminClient.from("products").delete().in("id", ids);
    }
    await adminClient
      .from("purchase_orders")
      .delete()
      .like("code", "INBOUND-FB-%");

    const { data: sup } = await adminClient
      .from("suppliers")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!sup) throw new Error("Cần ít nhất 1 supplier để chạy test fallback");
    supplierId = sup.id;

    const { data: maxProd } = await adminClient
      .from("products")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    let nextProductId = (maxProd?.id ?? 0) + 1000;

    for (const sc of scenarios) {
      const { data: prod, error: prodErr } = await adminClient
        .from("products")
        .insert({
          id: nextProductId++,
          name: sc.name,
          sku: sc.sku,
          actual_cost: 10_000,
          status: "inactive",
        })
        .select("id")
        .single();
      if (prodErr || !prod) throw prodErr || new Error(`seed product ${sc.key} failed`);
      sc.productId = prod.id;

      if (sc.units.length > 0) {
        const rows = sc.units.map((u) => ({
          product_id: prod.id,
          unit_name: u.unit_name,
          unit_type: u.unit_type,
          is_base: u.is_base ?? false,
          conversion_rate: 1,
        }));
        const { error: puErr } = await adminClient.from("product_units").insert(rows);
        if (puErr) throw puErr;
      }
    }

    const { data: po, error: poErr } = await adminClient
      .from("purchase_orders")
      .insert({
        code: `${UNIQUE}-PO`,
        supplier_id: supplierId,
        total_amount: 0,
        final_amount: 0,
        status: "DRAFT",
      })
      .select("id")
      .single();
    if (poErr || !po) throw poErr || new Error("seed PO failed");
    poId = po.id;

    const poItems = scenarios.map((sc) => ({
      po_id: poId,
      product_id: sc.productId!,
      quantity_ordered: 10,
      quantity_received: 0,
      unit_price: 10_000,
      uom_ordered: sc.uomOrdered,
      unit: sc.poiUnit,
    }));
    const { error: itemErr } = await adminClient
      .from("purchase_order_items")
      .insert(poItems);
    if (itemErr) throw itemErr;
  });

  afterAll(async () => {
    if (poId) {
      await adminClient.from("purchase_order_items").delete().eq("po_id", poId);
      await adminClient.from("purchase_orders").delete().eq("id", poId);
    }
    const productIds = scenarios
      .map((s) => s.productId)
      .filter((id): id is number => typeof id === "number");
    if (productIds.length > 0) {
      await adminClient.from("product_units").delete().in("product_id", productIds);
      await adminClient.from("products").delete().in("id", productIds);
    }
  });

  it("trả non-null cho mọi item (fallback cuối cùng = 'Hộp')", async () => {
    const { data, error } = await adminClient.rpc("get_inbound_detail", {
      p_po_id: poId,
    });
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const items = (data as any).items as Array<{ unit: string | null }>;
    expect(items).toHaveLength(scenarios.length);
    for (const it of items) {
      expect(it.unit).not.toBeNull();
      expect(String(it.unit).trim()).not.toBe("");
    }
  });

  for (const sc of scenarios) {
    it(`scenario ${sc.key}: expected "${sc.expected}"`, async () => {
      const { data } = await adminClient.rpc("get_inbound_detail", {
        p_po_id: poId,
      });
      const items = (data as any).items as Array<{
        product_id: number;
        unit: string;
        available_units: unknown[];
      }>;
      const item = items.find((i) => i.product_id === sc.productId);
      expect(item, `item cho ${sc.key} không tìm thấy`).toBeDefined();
      expect(item!.unit).toBe(sc.expected);
      expect(Array.isArray(item!.available_units)).toBe(true);
      expect(item!.available_units.length).toBe(sc.units.length);
    });
  }

  it("available_units sort: is_base DESC, conversion_rate ASC", async () => {
    const multiUnit = scenarios.find((s) => s.key === "uom_ordered_wins")!;
    const { data } = await adminClient.rpc("get_inbound_detail", {
      p_po_id: poId,
    });
    const items = (data as any).items as Array<{
      product_id: number;
      available_units: Array<{ unit_name: string; is_base: boolean }>;
    }>;
    const item = items.find((i) => i.product_id === multiUnit.productId);
    expect(item).toBeDefined();
    expect(item!.available_units[0].is_base).toBe(true);
  });

  it("PO không tồn tại → NULL", async () => {
    const { data, error } = await adminClient.rpc("get_inbound_detail", {
      p_po_id: 999_999_999,
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});
