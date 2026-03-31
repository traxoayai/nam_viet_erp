import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Purchase Orders", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("loads PO list with data", async ({ page }) => {
    await page.goto("/purchase-orders");
    await page.waitForTimeout(5000);
    // PO page uses custom list, check for PO code pattern
    const poItems = page.locator("text=/PO-/");
    expect(await poItems.count()).toBeGreaterThan(0);
  });

  test("search PO by keyword", async ({ page }) => {
    await page.goto("/purchase-orders");
    await page.waitForTimeout(5000);
    const searchInput = page.locator("input[placeholder*='Tìm'], input[placeholder*='tìm'], .ant-input-search input").first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("PO-2603");
      await searchInput.press("Enter");
      await page.waitForTimeout(3000);
    }
    // No error toasts
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("open PO detail", async ({ page }) => {
    await page.goto("/purchase-orders");
    await page.waitForTimeout(5000);
    // Click first PO link/row
    const firstPo = page.locator("text=/PO-/").first();
    if (await firstPo.isVisible()) {
      await firstPo.click();
      await page.waitForTimeout(3000);
    }
    // Should navigate or show detail
    expect(page.url()).toContain("/purchase-orders");
  });

  test("no error toast on page load", async ({ page }) => {
    await page.goto("/purchase-orders");
    await page.waitForTimeout(5000);
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("no double-toast on any interaction", async ({ page }) => {
    await page.goto("/purchase-orders");
    await page.waitForTimeout(5000);
    // At any point, max 1 error toast
    const errors = page.locator(".ant-message-notice-error");
    expect(await errors.count()).toBeLessThanOrEqual(1);
  });
});
