import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Inventory Flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("inbound tasks page loads", async ({ page }) => {
    await page.goto("/inventory/inbound");
    await page.waitForTimeout(5000);
    expect(page.url()).toContain("/inventory");
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("outbound tasks page loads", async ({ page }) => {
    await page.goto("/inventory/outbound");
    await page.waitForTimeout(5000);
    expect(page.url()).toContain("/inventory");
  });

  test("stocktake list loads", async ({ page }) => {
    await page.goto("/inventory/stocktake");
    await page.waitForTimeout(5000);
    expect(page.url()).toContain("/inventory");
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("transfer list loads", async ({ page }) => {
    await page.goto("/inventory/transfer");
    await page.waitForTimeout(5000);
    expect(page.url()).toContain("/inventory");
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("products page loads with data", async ({ page }) => {
    await page.goto("/inventory/products");
    await page.waitForTimeout(5000);
    const rows = page.locator("table tbody tr, .ant-table-tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
  });
});
