import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Customer CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("B2B customer list loads and has action buttons", async ({ page }) => {
    await page.goto("/crm/b2b");
    await page.waitForTimeout(5000);

    // Wait for table rows to appear
    const rows = page.locator("table tbody tr, .ant-table-tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);

    // Verify create button is visible ("Thêm" or similar)
    const createBtn = page.locator(
      "button:has-text('Thêm'), button:has-text('Tạo'), button:has-text('Thêm mới'), a:has-text('Thêm')"
    ).first();
    const btnVisible = await createBtn.isVisible().catch(() => false);
    expect(btnVisible).toBeTruthy();

    // No error toasts
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("B2C customer list loads", async ({ page }) => {
    await page.goto("/crm/retail");
    await page.waitForTimeout(5000);

    // Wait for table rows
    const rows = page.locator("table tbody tr, .ant-table-tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);

    // No error toasts
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("navigate to create B2B customer form", async ({ page }) => {
    await page.goto("/crm/b2b");
    await page.waitForTimeout(5000);

    // Click create button
    const createBtn = page.locator(
      "button:has-text('Thêm'), button:has-text('Tạo'), button:has-text('Thêm mới'), a:has-text('Thêm')"
    ).first();
    await createBtn.waitFor({ state: "visible", timeout: 10000 });
    await createBtn.click({ force: true });
    await page.waitForTimeout(3000);

    // Verify: either form/modal appears OR page navigated (e.g. /crm/b2b/new)
    const formVisible = (await page.locator("form, .ant-modal, .ant-drawer").count()) > 0;
    const modalBody = (await page.locator(".ant-modal-body, .ant-drawer-body").count()) > 0;
    const urlChanged = !page.url().endsWith("/crm/b2b");
    expect(formVisible || modalBody || urlChanged).toBeTruthy();

    // No error toasts
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });
});
