// Unit test cho parseSynonymCsv (Gap 1 P2.5).
// Inline parser trong ImportCSVDialog — test riêng để cover edge case.

import { describe, expect, it } from "vitest";

import { parseSynonymCsv } from "@/features/chatbot/components/synonyms/ImportCSVDialog";

describe("parseSynonymCsv", () => {
  it("parse CSV chuẩn với header sku,synonym,weight", () => {
    const csv = `sku,synonym,weight
SP01,alpha,1.5
SP02,beta,2`;
    const rows = parseSynonymCsv(csv);
    expect(rows).toEqual([
      { sku: "SP01", synonym: "alpha", weight: 1.5 },
      { sku: "SP02", synonym: "beta", weight: 2 },
    ]);
  });

  it("weight optional — bỏ qua khi cột thiếu", () => {
    const csv = `sku,synonym
SP01,alpha
SP02,beta`;
    const rows = parseSynonymCsv(csv);
    expect(rows).toEqual([
      { sku: "SP01", synonym: "alpha" },
      { sku: "SP02", synonym: "beta" },
    ]);
  });

  it("skip dòng thiếu sku hoặc synonym", () => {
    const csv = `sku,synonym
SP01,alpha
,beta
SP03,
SP04,gamma`;
    const rows = parseSynonymCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].sku).toBe("SP01");
    expect(rows[1].sku).toBe("SP04");
  });

  it("trả [] khi không có header sku/synonym", () => {
    const csv = `foo,bar
1,2`;
    expect(parseSynonymCsv(csv)).toEqual([]);
  });

  it("trả [] với chuỗi rỗng", () => {
    expect(parseSynonymCsv("")).toEqual([]);
    expect(parseSynonymCsv("\n\n")).toEqual([]);
  });

  it("xử lý CRLF (Windows line endings)", () => {
    const csv = "sku,synonym\r\nSP01,alpha\r\nSP02,beta\r\n";
    const rows = parseSynonymCsv(csv);
    expect(rows).toHaveLength(2);
  });

  it("bỏ qua weight không phải số", () => {
    const csv = `sku,synonym,weight
SP01,alpha,abc`;
    const rows = parseSynonymCsv(csv);
    expect(rows[0].weight).toBeUndefined();
  });
});
