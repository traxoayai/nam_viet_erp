/**
 * Integration test: search_products_for_purchase — trả về total_stock + avg_monthly_sold
 */
import { describe, it, expect } from "vitest";
import { adminClient } from "../helpers/supabase";

describe("search_products_for_purchase", () => {
  it("function tồn tại và trả về data", async () => {
    const { data, error } = await adminClient.rpc(
      "search_products_for_purchase",
      { p_keyword: "" }
    );
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it("trả về cột total_stock và avg_monthly_sold", async () => {
    const { data, error } = await adminClient.rpc(
      "search_products_for_purchase",
      { p_keyword: "" }
    );
    expect(error).toBeNull();

    if (data && (data as unknown[]).length > 0) {
      const row = (data as Record<string, unknown>[])[0];
      expect(row).toHaveProperty("total_stock");
      expect(row).toHaveProperty("avg_monthly_sold");
      // total_stock phải là số
      expect(typeof row.total_stock).toBe("number");
      expect(typeof row.avg_monthly_sold).toBe("number");
    }
  });

  it("total_stock >= 0 cho mọi sản phẩm", async () => {
    const { data } = await adminClient.rpc("search_products_for_purchase", {
      p_keyword: "",
    });

    if (data && (data as unknown[]).length > 0) {
      for (const row of data as Record<string, unknown>[]) {
        expect(Number(row.total_stock)).toBeGreaterThanOrEqual(0);
        expect(Number(row.avg_monthly_sold)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("tìm kiếm theo keyword vẫn trả về stock info", async () => {
    // Lấy 1 sản phẩm bất kỳ để test keyword search
    const { data: products } = await adminClient
      .from("products")
      .select("name")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!products) return; // skip nếu không có data

    const keyword = products.name.substring(0, 3);
    const { data, error } = await adminClient.rpc(
      "search_products_for_purchase",
      { p_keyword: keyword }
    );
    expect(error).toBeNull();

    if (data && (data as unknown[]).length > 0) {
      const row = (data as Record<string, unknown>[])[0];
      expect(row).toHaveProperty("total_stock");
      expect(row).toHaveProperty("avg_monthly_sold");
    }
  });
});
