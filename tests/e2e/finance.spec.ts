import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Finance Flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("transactions page loads", async ({ page }) => {
    await page.goto("/finance/transactions");
    await page.waitForTimeout(5000);
    expect(page.url()).toContain("/finance");
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("assets page loads", async ({ page }) => {
    await page.goto("/finance/assets");
    await page.waitForTimeout(5000);
    expect(page.url()).toContain("/finance");
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("invoices page loads", async ({ page }) => {
    await page.goto("/finance/invoices");
    await page.waitForTimeout(5000);
    expect(page.url()).toContain("/finance");
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });
});
