import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Sales B2B Flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("B2B order list loads", async ({ page }) => {
    await page.goto("/b2b/orders");
    await page.waitForTimeout(5000);
    expect(page.url()).toContain("/b2b");
    // Should not have error toasts
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("sales order list loads", async ({ page }) => {
    await page.goto("/store/b2c-orders");
    await page.waitForTimeout(5000);
    expect(page.url()).toContain("/store");
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("customer B2B list loads", async ({ page }) => {
    await page.goto("/crm/b2b");
    await page.waitForTimeout(5000);
    const rows = page.locator("table tbody tr, .ant-table-tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("customer B2C list loads", async ({ page }) => {
    await page.goto("/crm/retail");
    await page.waitForTimeout(5000);
    const rows = page.locator("table tbody tr, .ant-table-tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
  });
});
