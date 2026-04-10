/**
 * Unit test: printTemplates — verify bank account config
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("printTemplates bank config", () => {
  const filePath = path.resolve(
    __dirname,
    "../../src/shared/utils/printTemplates.ts"
  );
  const content = fs.readFileSync(filePath, "utf-8");

  it("BANK_ID = Timo", () => {
    expect(content).toMatch(/BANK_ID\s*=\s*"Timo"/);
  });

  it("BANK_ACCOUNT = 0965637788", () => {
    expect(content).toMatch(/BANK_ACCOUNT\s*=\s*"0965637788"/);
  });

  it("ACCOUNT_NAME = LE VIET HUNG", () => {
    expect(content).toMatch(/ACCOUNT_NAME\s*=\s*"LE VIET HUNG"/);
  });

  it("không còn thông tin tài khoản cũ (LÊ HỒNG NHUNG)", () => {
    expect(content).not.toContain("LÊ HỒNG NHUNG");
    expect(content).not.toContain("0385061892");
    expect(content).not.toMatch(/BANK_ID\s*=\s*"OCB"/);
  });
});
