import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";

/**
 * Test responsive layout cho warehouse pages
 * 3 breakpoints: 375px (mobile), 768px (tablet), 1920px (desktop)
 *
 * Pattern Ant Design responsive:
 * - xs: 0px (mobile)
 * - sm: 576px (tablet)
 * - md: 768px (small desktop) ← Threshold for Table vs List
 * - lg: 992px (desktop)
 * - xl: 1200px (large desktop)
 * - xxl: 1600px (extra large)
 */

const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 },
};

test.describe("Warehouse Responsive - Mobile (375px)", () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test("inbound list page loads on mobile", async ({ page }) => {
    await login(page);
    await page.goto("/inventory/inbound");
    await page.waitForTimeout(2000);

    // Page should load without errors
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
    expect(page.url()).toContain("/inventory/inbound");
  });

  test("outbound list page loads on mobile", async ({ page }) => {
    await login(page);
    await page.goto("/inventory/outbound");
    await page.waitForTimeout(2000);

    // Page should load without errors
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
    expect(page.url()).toContain("/inventory/outbound");
  });
});

test.describe("Warehouse Responsive - Tablet (768px)", () => {
  test.use({ viewport: VIEWPORTS.tablet });

  test("inbound list page renders on tablet", async ({ page }) => {
    await login(page);
    await page.goto("/inventory/inbound");
    await page.waitForTimeout(2000);

    // No errors
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("outbound list page renders on tablet", async ({ page }) => {
    await login(page);
    await page.goto("/inventory/outbound");
    await page.waitForTimeout(2000);

    // No errors
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });
});

test.describe("Warehouse Responsive - Desktop (1920px)", () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test("inbound list page renders on desktop", async ({ page }) => {
    await login(page);
    await page.goto("/inventory/inbound");
    await page.waitForTimeout(2000);

    // No errors
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("outbound list page renders on desktop", async ({ page }) => {
    await login(page);
    await page.goto("/inventory/outbound");
    await page.waitForTimeout(2000);

    // No errors
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });
});
