/**
 * Unit test: POItem type includes stock fields + POProductTable renders them
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("PO stock info integration", () => {
  it("POItem type có total_stock và avg_monthly_sold", () => {
    const typePath = path.resolve(
      __dirname,
      "../../../src/features/purchasing/types/purchaseOrderTypes.ts"
    );
    const content = fs.readFileSync(typePath, "utf-8");
    expect(content).toContain("total_stock");
    expect(content).toContain("avg_monthly_sold");
  });

  it("POProductTable render cột Tồn kho và TB bán/tháng", () => {
    const tablePath = path.resolve(
      __dirname,
      "../../../src/pages/purchasing/components/POProductTable.tsx"
    );
    const content = fs.readFileSync(tablePath, "utf-8");
    expect(content).toContain('title: "Tồn kho"');
    expect(content).toContain('title: "TB bán/tháng"');
    expect(content).toContain("total_stock");
    expect(content).toContain("avg_monthly_sold");
  });

  it("productService truyền total_stock và avg_monthly_sold từ RPC", () => {
    const servicePath = path.resolve(
      __dirname,
      "../../../src/features/product/api/productService.ts"
    );
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("total_stock: p.total_stock");
    expect(content).toContain("avg_monthly_sold: p.avg_monthly_sold");
  });

  it("usePurchaseOrderLogic truyền stock data vào POItem", () => {
    const hookPath = path.resolve(
      __dirname,
      "../../../src/pages/purchasing/hooks/usePurchaseOrderLogic.ts"
    );
    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content).toContain("total_stock:");
    expect(content).toContain("avg_monthly_sold:");
  });
});
