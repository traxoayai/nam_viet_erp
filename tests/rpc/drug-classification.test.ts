import { describe, it, expect, afterAll } from "vitest";

import {
  adminClient,
  createTestAuthedClient,
  isProduction,
} from "../helpers/supabase";

// Prefix để dọn dữ liệu test, chạy lặp được
const P = "__dctest__";

afterAll(async () => {
  // products xóa TRƯỚC (cascade product_active_ingredients + product_regulatory),
  // rồi active_ingredients (FK active_ingredient_id là ON DELETE RESTRICT)
  await adminClient.from("products").delete().like("name", `${P}%`);
  await adminClient.from("active_ingredients").delete().like("slug", `${P}%`);
});

async function tempProduct(label: string): Promise<number> {
  const { data, error } = await adminClient
    .from("products")
    .insert({ name: `${P}${label}`, actual_cost: 0, status: "active" })
    .select("id")
    .single();
  if (error) throw new Error(`tempProduct(${label}): ${error.message}`);
  return data!.id as number;
}

async function setReg(
  productId: number,
  fields: Record<string, unknown>
): Promise<void> {
  const { error } = await adminClient
    .from("product_regulatory")
    .update(fields)
    .eq("product_id", productId);
  if (error) throw new Error(`setReg(${productId}): ${error.message}`);
}

async function ruleKey(productId: number): Promise<string> {
  const { data, error } = await adminClient.rpc("resolve_selling_rule_key", {
    p_product_id: productId,
  });
  expect(error).toBeNull();
  return data as unknown as string;
}

type SellRow = {
  allowed: boolean | null;
  requires_prescription: boolean;
  requires_special_license: boolean;
  rule_key: string | null;
  reason: string | null;
};
async function canSell(
  outlet: string | null,
  productId: number
): Promise<SellRow> {
  const { data, error } = await adminClient.rpc("can_outlet_sell", {
    p_outlet_type: outlet as unknown as string,
    p_product_id: productId,
  });
  expect(error).toBeNull();
  return (data as unknown as SellRow[])[0];
}

describe("active_ingredients", () => {
  it("insert + select (admin bypass RLS)", async () => {
    const { data, error } = await adminClient
      .from("active_ingredients")
      .insert({ name: "Cefixim", slug: `${P}cefixim`, atc_code: "J01DD08" })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.name).toBe("Cefixim");
    expect(data?.status).toBe("active");
  });

  it("CHECK chặn name rỗng", async () => {
    const { error } = await adminClient
      .from("active_ingredients")
      .insert({ name: "   ", slug: `${P}blank` });
    expect(error).not.toBeNull();
  });
});

describe("product_active_ingredients", () => {
  it("gán nhiều hoạt chất, tối đa 1 is_primary", async () => {
    const productId = await tempProduct("combo");
    const { data: ing } = await adminClient
      .from("active_ingredients")
      .insert([
        { name: "Amoxicillin", slug: `${P}amox` },
        { name: "Clavulanic acid", slug: `${P}clav` },
      ])
      .select("id");
    const [a, b] = ing!;
    const { error: e1 } = await adminClient
      .from("product_active_ingredients")
      .insert([
        {
          product_id: productId,
          active_ingredient_id: a.id,
          strength_value: 875,
          strength_unit: "mg",
          is_primary: true,
        },
        {
          product_id: productId,
          active_ingredient_id: b.id,
          strength_value: 125,
          strength_unit: "mg",
          is_primary: false,
        },
      ]);
    expect(e1).toBeNull();

    const { error: e2 } = await adminClient
      .from("product_active_ingredients")
      .update({ is_primary: true })
      .eq("product_id", productId)
      .eq("active_ingredient_id", b.id);
    expect(e2).not.toBeNull(); // vi phạm partial unique uq_pai_primary
  });

  it("CHECK chặn hàm lượng <= 0", async () => {
    const productId = await tempProduct("badstrength");
    const { data: ing } = await adminClient
      .from("active_ingredients")
      .insert({ name: "Paracetamol", slug: `${P}para` })
      .select("id")
      .single();
    const { error } = await adminClient
      .from("product_active_ingredients")
      .insert({
        product_id: productId,
        active_ingredient_id: ing!.id,
        strength_value: 0,
        strength_unit: "mg",
      });
    expect(error).not.toBeNull();
  });
});

describe("lookup dosage_forms / routes", () => {
  it("seed dạng bào chế + cờ is_complex (tiêm/hít)", async () => {
    const { data, error } = await adminClient
      .from("dosage_forms")
      .select("slug,is_complex");
    expect(error).toBeNull();
    const m = Object.fromEntries(
      (data ?? []).map((r) => [r.slug, r.is_complex])
    );
    expect(m["vien-nen"]).toBe(false);
    expect(m["dung-dich-tiem"]).toBe(true);
    expect(m["thuoc-hit"]).toBe(true);
  });
  it("seed routes (Tiêm/Hít = complex)", async () => {
    const { data } = await adminClient
      .from("routes_of_administration")
      .select("slug,is_complex");
    const m = Object.fromEntries(
      (data ?? []).map((r) => [r.slug, r.is_complex])
    );
    expect(m["uong"]).toBe(false);
    expect(m["tiem"]).toBe(true);
    expect(m["hit"]).toBe(true);
  });
});

describe("product_regulatory", () => {
  it("trigger tự tạo row regulatory khi tạo product mới", async () => {
    const productId = await tempProduct("autoreg");
    const { data, error } = await adminClient
      .from("product_regulatory")
      .select("item_type,prescription_class")
      .eq("product_id", productId)
      .single();
    expect(error).toBeNull();
    expect(data?.item_type).toBe("drug");
    expect(data?.prescription_class).toBeNull();
  });

  it("CHECK chặn cờ kiểm soát khi item_type != 'drug'", async () => {
    const productId = await tempProduct("badtpcn");
    const { error } = await adminClient
      .from("product_regulatory")
      .update({ item_type: "supplement", is_vaccine: true })
      .eq("product_id", productId);
    expect(error).not.toBeNull();
  });
});

describe("selling_rules seed", () => {
  it("nhà thuốc bán rx; quầy KHÔNG bán rx (chỉ allowed_if_essential)", async () => {
    const { data: pharm } = await adminClient
      .from("selling_rules")
      .select("is_allowed")
      .eq("outlet_type", "pharmacy")
      .eq("rule_key", "rx")
      .single();
    expect(pharm?.is_allowed).toBe(true);

    const { data: counter } = await adminClient
      .from("selling_rules")
      .select("is_allowed,allowed_if_essential")
      .eq("outlet_type", "drug_counter")
      .eq("rule_key", "rx")
      .single();
    expect(counter?.is_allowed).toBe(false);
    expect(counter?.allowed_if_essential).toBe(true);
  });
  it("không seed vaccine/sc_radioactive (=> cấm mặc định)", async () => {
    const { data } = await adminClient
      .from("selling_rules")
      .select("id")
      .in("rule_key", ["vaccine", "sc_radioactive"]);
    expect((data ?? []).length).toBe(0);
  });
});

describe("resolve_selling_rule_key (bảng quyết định)", () => {
  async function reg(
    label: string,
    fields: Record<string, unknown>
  ): Promise<number> {
    const id = await tempProduct(label);
    if (Object.keys(fields).length) await setReg(id, fields);
    return id;
  }
  it("vắc xin > mọi cờ", async () =>
    expect(
      await ruleKey(
        await reg("vax", { is_vaccine: true, prescription_class: "rx" })
      )
    ).toBe("vaccine"));
  it("phóng xạ -> sc_radioactive", async () =>
    expect(
      await ruleKey(await reg("rad", { special_control_type: "radioactive" }))
    ).toBe("sc_radioactive"));
  it("gây nghiện -> sc_restricted", async () =>
    expect(
      await ruleKey(await reg("narc", { special_control_type: "narcotic" }))
    ).toBe("sc_restricted"));
  it("phối hợp -> sc_combination", async () =>
    expect(
      await ruleKey(await reg("comb", { special_control_type: "combination" }))
    ).toBe("sc_combination"));
  it("hạn chế bán lẻ -> restricted_retail", async () =>
    expect(
      await ruleKey(await reg("restr", { is_restricted_retail: true }))
    ).toBe("restricted_retail"));
  it("TPCN -> supplement", async () =>
    expect(await ruleKey(await reg("supp", { item_type: "supplement" }))).toBe(
      "supplement"
    ));
  it("thiết bị -> medical_device", async () =>
    expect(
      await ruleKey(await reg("dev", { item_type: "medical_device" }))
    ).toBe("medical_device"));
  it("thuốc Rx -> rx", async () =>
    expect(await ruleKey(await reg("rx1", { prescription_class: "rx" }))).toBe(
      "rx"
    ));
  it("thuốc OTC -> otc", async () =>
    expect(
      await ruleKey(await reg("otc1", { prescription_class: "otc" }))
    ).toBe("otc"));
  it("chưa phân loại (NULL) -> unclassified", async () =>
    expect(await ruleKey(await reg("unclass", {}))).toBe("unclassified"));
});

describe("can_outlet_sell (ma trận)", () => {
  async function reg(
    label: string,
    fields: Record<string, unknown>
  ): Promise<number> {
    const id = await tempProduct(label);
    if (Object.keys(fields).length) await setReg(id, fields);
    return id;
  }
  it("nhà thuốc bán Rx (cần đơn)", async () => {
    const res = await canSell(
      "pharmacy",
      await reg("rxsell", { prescription_class: "rx" })
    );
    expect(res.allowed).toBe(true);
    expect(res.requires_prescription).toBe(true);
  });
  it("quầy KHÔNG bán Rx thường", async () => {
    const res = await canSell(
      "drug_counter",
      await reg("rxc", { prescription_class: "rx", is_essential: false })
    );
    expect(res.allowed).toBe(false);
  });
  it("quầy bán Rx nếu thuộc DM thiết yếu", async () => {
    const res = await canSell(
      "drug_counter",
      await reg("rxess", { prescription_class: "rx", is_essential: true })
    );
    expect(res.allowed).toBe(true);
    expect(res.requires_prescription).toBe(true);
  });
  it("vắc xin cấm bán lẻ mọi cơ sở", async () => {
    const id = await reg("vaxsell", { is_vaccine: true });
    expect((await canSell("pharmacy", id)).allowed).toBe(false);
    expect((await canSell("drug_counter", id)).allowed).toBe(false);
  });
  it("quầy không bán thuốc gây nghiện; nhà thuốc thì được", async () => {
    const id = await reg("narcc", { special_control_type: "narcotic" });
    expect((await canSell("drug_counter", id)).allowed).toBe(false);
    expect((await canSell("pharmacy", id)).allowed).toBe(true);
  });
  it("chưa xác định cơ sở -> CHUA_XAC_DINH_CO_SO", async () => {
    const res = await canSell(null, await tempProduct("nooutlet"));
    expect(res.allowed).toBeNull();
    expect(res.reason).toBe("CHUA_XAC_DINH_CO_SO");
  });
  it("chưa phân loại -> CHUA_PHAN_LOAI + cấm", async () => {
    const res = await canSell("pharmacy", await tempProduct("unclass2"));
    expect(res.rule_key).toBe("unclassified");
    expect(res.reason).toBe("CHUA_PHAN_LOAI");
    expect(res.allowed).toBe(false);
  });
});

describe("RLS selling_rules", () => {
  it("user đăng nhập đọc được; KHÔNG ghi được (thiếu catalog.classification.manage)", async () => {
    if (isProduction) return;
    let authed;
    try {
      authed = await createTestAuthedClient();
    } catch {
      return; // không có fixture user trong DB clone -> bỏ qua
    }
    const { data, error } = await authed
      .from("selling_rules")
      .select("id")
      .limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    const { error: insErr } = await authed
      .from("selling_rules")
      .insert({ outlet_type: "pharmacy", rule_key: "otc", is_allowed: true });
    expect(insErr).not.toBeNull();
  });
});
