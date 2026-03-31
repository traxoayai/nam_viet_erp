import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("POS Flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("POS page loads without crash", async ({ page }) => {
    await page.goto("/blank/pos");
    await page.waitForTimeout(5000);
    expect(page.url()).toContain("/pos");
  });

  test("no error toast on POS load", async ({ page }) => {
    await page.goto("/blank/pos");
    await page.waitForTimeout(5000);
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("search product does not crash", async ({ page }) => {
    await page.goto("/blank/pos");
    await page.waitForTimeout(3000);
    // POS search is the large input near top, use F2 shortcut or click area
    await page.keyboard.press("F2");
    await page.waitForTimeout(500);
    await page.keyboard.type("men", { delay: 100 });
    await page.waitForTimeout(2000);
    // No error toasts after search
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("no double-toast on POS", async ({ page }) => {
    await page.goto("/blank/pos");
    await page.waitForTimeout(5000);
    const toasts = page.locator(".ant-message-notice-error");
    expect(await toasts.count()).toBeLessThanOrEqual(1);
  });
});
