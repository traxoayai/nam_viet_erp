import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Medical Flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("reception queue page loads", async ({ page }) => {
    await page.goto("/medical/reception");
    await page.waitForTimeout(5000);
    expect(page.url()).toContain("/medical");
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("doctor examination page loads", async ({ page }) => {
    await page.goto("/medical/examination");
    await page.waitForTimeout(5000);
    expect(page.url()).toContain("/medical");
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("nurse execution page loads", async ({ page }) => {
    await page.goto("/medical/nurse");
    await page.waitForTimeout(5000);
    expect(page.url()).toContain("/medical");
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("paraclinical page loads", async ({ page }) => {
    await page.goto("/medical/paraclinical");
    await page.waitForTimeout(5000);
    expect(page.url()).toContain("/medical");
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });
});
