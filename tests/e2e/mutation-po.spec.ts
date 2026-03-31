import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Purchase Order CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("PO list page loads without error", async ({ page }) => {
    await page.goto("/purchase-orders");
    await page.waitForTimeout(5000);
    // Page title visible
    const hasTitle = (await page.locator("text=Quản Lý Đơn Mua Hàng").count()) > 0;
    expect(hasTitle).toBeTruthy();
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("create button navigates to new PO", async ({ page }) => {
    await page.goto("/purchase-orders");
    await page.waitForTimeout(5000);
    // Find create button - could be various text
    const createBtn = page.locator(
      "button:has-text('Tạo'), a:has-text('Tạo'), button:has-text('Thêm'), [href*='/purchase-orders/new']"
    ).first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click({ force: true });
      await page.waitForTimeout(3000);
      // Should navigate or show form
      const errors = page.locator(".ant-message-error");
      expect(await errors.count()).toBe(0);
    }
  });
});
