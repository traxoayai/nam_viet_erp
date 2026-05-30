// Integration test: 5 RPC synonyms (Gap 1 Chatbot P2.5).
// Pattern seed giống inbox_rpcs.test.ts.

import { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe as _describe, expect, it } from "vitest";

import {
  adminClient,
  createUserClient,
  isProduction,
} from "../helpers/supabase";

const describe = isProduction ? _describe.skip : _describe;

const STAFF_EMAIL = "admin@test.com";
const STAFF_PASSWORD = "Admin@938!";
const CUSTOMER_EMAIL = "kame.ctb@gmail.com";
const CUSTOMER_PASSWORD = "Test@123!";

interface SeedRefs {
  staffUserId: string;
  customerUserId: string;
  roleId: string;
  warehouseId: number;
  userRoleId: number | null;
  productId: number;
  productSku: string;
  insertedSynonymIds: number[];
}

const seed: Partial<SeedRefs> = {};
let staffClient: SupabaseClient;
let customerClient: SupabaseClient;

describe("Synonym RPCs (list/add/delete/search/bulk_import)", () => {
  beforeAll(async () => {
    // 1. Auth clients trước — signInWithPassword work khi listUsers bị bug
    // (GoTrue listUsers đôi khi trả "Database error finding users" trên local).
    staffClient = await createUserClient(STAFF_EMAIL, STAFF_PASSWORD);
    customerClient = await createUserClient(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    const { data: staffSession } = await staffClient.auth.getUser();
    const { data: customerSession } = await customerClient.auth.getUser();
    if (!staffSession.user?.id)
      throw new Error(`Staff fixture ${STAFF_EMAIL} not found`);
    if (!customerSession.user?.id)
      throw new Error(`Customer fixture ${CUSTOMER_EMAIL} not found`);
    seed.staffUserId = staffSession.user.id;
    seed.customerUserId = customerSession.user.id;

    // 2. Tạo role test có permission crm.chatbot.admin
    const roleName = `__test_synonym_rpc_${Date.now()}`;
    const { data: roleRow, error: roleErr } = await adminClient
      .from("roles")
      .insert({ name: roleName, description: "test synonym rpc staff" })
      .select("id")
      .single();
    if (roleErr || !roleRow) throw roleErr || new Error("seed role failed");
    seed.roleId = roleRow.id;

    const { error: rpErr } = await adminClient.from("role_permissions").insert({
      role_id: seed.roleId,
      permission_key: "crm.chatbot.admin",
    });
    if (rpErr) throw rpErr;

    // 3. Warehouse cho user_roles.branch_id
    const { data: wh, error: whErr } = await adminClient
      .from("warehouses")
      .select("id")
      .order("id")
      .limit(1)
      .single();
    if (whErr || !wh) throw whErr || new Error("no warehouse");
    seed.warehouseId = wh.id;

    // 4. Gán role test cho staff user (idempotent)
    const { data: existingUR } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", seed.staffUserId)
      .eq("role_id", seed.roleId)
      .eq("branch_id", seed.warehouseId)
      .maybeSingle();
    if (existingUR?.id) {
      seed.userRoleId = existingUR.id;
    } else {
      const { data: urRow, error: urErr } = await adminClient
        .from("user_roles")
        .insert({
          user_id: seed.staffUserId,
          role_id: seed.roleId,
          branch_id: seed.warehouseId,
        })
        .select("id")
        .single();
      if (urErr || !urRow) throw urErr || new Error("seed user_roles failed");
      seed.userRoleId = urRow.id;
    }

    // 5. Lấy 1 SP active có sẵn để test
    const { data: prod, error: prodErr } = await adminClient
      .from("products")
      .select("id, sku")
      .eq("status", "active")
      .limit(1)
      .single();
    if (prodErr || !prod) throw prodErr || new Error("no active product");
    seed.productId = prod.id;
    seed.productSku = prod.sku;
    seed.insertedSynonymIds = [];
  });

  afterAll(async () => {
    // Xóa synonym đã insert trong test (cả case 1 + case 4)
    if (seed.productId) {
      await adminClient
        .from("product_synonyms")
        .delete()
        .eq("product_id", seed.productId)
        .like("synonym", "__test_syn_%");
    }
    if (seed.userRoleId)
      await adminClient.from("user_roles").delete().eq("id", seed.userRoleId);
    if (seed.roleId) {
      await adminClient
        .from("role_permissions")
        .delete()
        .eq("role_id", seed.roleId);
      await adminClient.from("roles").delete().eq("id", seed.roleId);
    }
  });

  it("1. Staff gọi add_product_synonym → row insert + list_product_synonyms trả về", async () => {
    const syn = `__test_syn_${Date.now()}`;
    const { data: addData, error: addErr } = await staffClient.rpc(
      "add_product_synonym",
      {
        p_product_id: seed.productId!,
        p_synonym: syn,
        p_weight: 1.5,
      }
    );
    expect(addErr).toBeNull();
    expect(typeof addData).toBe("number");

    const { data: listData, error: listErr } = await staffClient.rpc(
      "list_product_synonyms",
      { p_product_id: seed.productId! }
    );
    expect(listErr).toBeNull();
    const rows = listData as Array<{
      id: number;
      synonym: string;
      weight: number;
    }>;
    const found = rows.find((r) => r.synonym === syn);
    expect(found).toBeDefined();
    expect(found!.weight).toBeCloseTo(1.5, 5);
  });

  it("2. Customer gọi add_product_synonym → error 42501", async () => {
    const { data, error } = await customerClient.rpc("add_product_synonym", {
      p_product_id: seed.productId!,
      p_synonym: "__test_syn_unauthorized",
      p_weight: 1.0,
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  it("3. bulk_import_synonyms với SKU không tồn tại → skipped=1 + errors", async () => {
    const { data, error } = await staffClient.rpc("bulk_import_synonyms", {
      p_rows: [
        {
          sku: "__NOT_EXIST_SKU_xyz123",
          synonym: "__test_syn_bulk_bad",
        },
      ],
    });
    expect(error).toBeNull();
    const res = data as {
      inserted: number;
      skipped: number;
      errors: Array<{ sku?: string; reason: string }>;
    };
    expect(res.inserted).toBe(0);
    expect(res.skipped).toBe(1);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].reason).toMatch(/SKU/);
  });

  it("4. bulk_import_synonyms với SKU hợp lệ → inserted=1", async () => {
    const syn = `__test_syn_bulk_${Date.now()}`;
    const { data, error } = await staffClient.rpc("bulk_import_synonyms", {
      p_rows: [
        {
          sku: seed.productSku!,
          synonym: syn,
          weight: 2.0,
        },
      ],
    });
    expect(error).toBeNull();
    const res = data as { inserted: number; skipped: number };
    expect(res.inserted).toBe(1);
    expect(res.skipped).toBe(0);

    // Verify row trong DB
    const { data: row } = await adminClient
      .from("product_synonyms")
      .select("weight")
      .eq("product_id", seed.productId!)
      .eq("synonym", syn)
      .maybeSingle();
    expect(row).not.toBeNull();
    expect(row!.weight).toBeCloseTo(2.0, 5);
  });
});
