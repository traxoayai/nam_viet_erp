import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Marketing Flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("service packages page loads", async ({ page }) => {
    await page.goto("/services");
    await page.waitForTimeout(5000);
    expect(page.url()).toContain("/services");
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("promotions page loads", async ({ page }) => {
    await page.goto("/marketing/tools/promo");
    await page.waitForTimeout(5000);
    expect(page.url()).toContain("/marketing");
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("vaccination templates page loads", async ({ page }) => {
    await page.goto("/quick/vaccination-template");
    await page.waitForTimeout(5000);
    expect(page.url()).toContain("/quick/vaccination-template");
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("prescription templates page loads", async ({ page }) => {
    await page.goto("/quick/prescription-template");
    await page.waitForTimeout(5000);
    expect(page.url()).toContain("/quick/prescription-template");
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });
});
