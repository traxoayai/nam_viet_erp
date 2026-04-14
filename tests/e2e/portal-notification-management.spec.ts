import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Portal Notification Management", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("notification management page loads", async ({ page }) => {
    await page.goto("/portal/notifications");
    await page.waitForTimeout(3000);

    // Should navigate to the correct URL
    expect(page.url()).toContain("/portal/notifications");

    // Should not have error toasts
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);

    // Page title should be visible
    const heading = page.locator("h2").filter({ hasText: "Quản lý thông báo Portal" });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('"Gửi thông báo" tab loads with compose form', async ({ page }) => {
    await page.goto("/portal/notifications");
    await page.waitForTimeout(3000);

    // "Gửi thông báo" tab should be active by default (first tab)
    const composeTab = page.locator(".ant-tabs-tab").filter({ hasText: "Gửi thông báo" });
    await expect(composeTab).toBeVisible({ timeout: 10000 });

    // The form should be visible inside the tab content
    const form = page.locator("form, .ant-form");
    await expect(form.first()).toBeVisible({ timeout: 10000 });

    // Verify key form fields exist
    const typeLabel = page.getByText("Loại thông báo");
    await expect(typeLabel).toBeVisible();

    const targetLabel = page.getByText("Đối tượng");
    await expect(targetLabel).toBeVisible();

    const titleLabel = page.getByText("Tiêu đề");
    await expect(titleLabel).toBeVisible();

    const bodyLabel = page.getByText("Nội dung");
    await expect(bodyLabel).toBeVisible();
  });

  test("compose form has correct radio options", async ({ page }) => {
    await page.goto("/portal/notifications");
    await page.waitForTimeout(3000);

    // Notification type radio buttons
    const promoRadio = page.locator(".ant-radio-button-wrapper").filter({ hasText: "Khuyến mãi" });
    await expect(promoRadio).toBeVisible({ timeout: 10000 });

    const systemRadio = page.locator(".ant-radio-button-wrapper").filter({ hasText: "Hệ thống" });
    await expect(systemRadio).toBeVisible();

    // Target radio buttons
    const allRadio = page.locator(".ant-radio-wrapper").filter({ hasText: "Tất cả khách hàng" });
    await expect(allRadio).toBeVisible();

    const specificRadio = page.locator(".ant-radio-wrapper").filter({ hasText: "Chọn khách cụ thể" });
    await expect(specificRadio).toBeVisible();
  });

  test("fill compose form and submit shows confirm dialog", async ({ page }) => {
    await page.goto("/portal/notifications");
    await page.waitForTimeout(3000);

    // Select type = Khuyến mãi (should be default but click to be sure)
    const promoRadio = page.locator(".ant-radio-button-wrapper").filter({ hasText: "Khuyến mãi" });
    await promoRadio.click();

    // Target = Tất cả (should be default)
    const allRadio = page.locator(".ant-radio-wrapper").filter({ hasText: "Tất cả khách hàng" });
    await allRadio.click();

    // Fill title
    const titleInput = page.locator("input").filter({ has: page.locator("[id]") })
      .or(page.locator("input[placeholder*='VD']"))
      .first();
    await titleInput.fill("E2E Test — Giảm 10% toàn bộ");

    // Fill body (textarea)
    const bodyTextarea = page.locator("textarea").first();
    await bodyTextarea.fill("Đây là nội dung test từ Playwright E2E.");

    // Submit the form
    const submitBtn = page.locator("button").filter({ hasText: "Gửi thông báo" });
    await submitBtn.click();

    // Confirm dialog should appear
    const confirmDialog = page.locator(".ant-modal-confirm, .ant-modal").filter({
      hasText: "Xác nhận gửi thông báo",
    });
    await expect(confirmDialog).toBeVisible({ timeout: 10000 });

    // Dialog should mention the title
    const dialogContent = page.locator(".ant-modal-confirm-content, .ant-modal-body");
    await expect(dialogContent.first()).toContainText("E2E Test");

    // Cancel to avoid actually sending in E2E
    const cancelBtn = page.locator(".ant-modal-confirm-btns button, .ant-modal-footer button")
      .filter({ hasText: "Hủy" });
    await cancelBtn.click();

    // Dialog should close
    await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });
  });

  test('"Lịch sử gửi" tab shows history table', async ({ page }) => {
    await page.goto("/portal/notifications");
    await page.waitForTimeout(3000);

    // Click on "Lịch sử gửi" tab
    const historyTab = page.locator(".ant-tabs-tab").filter({ hasText: "Lịch sử gửi" });
    await historyTab.click();
    await page.waitForTimeout(2000);

    // Should show a table (SmartTable wraps AntD Table)
    const table = page.locator("table, .ant-table");
    await expect(table.first()).toBeVisible({ timeout: 10000 });

    // Verify table has expected column headers
    const headerRow = page.locator(
      ".ant-table-thead th, thead th"
    );
    const headerTexts = await headerRow.allTextContents();
    const joined = headerTexts.join(" ");

    expect(joined).toContain("Tiêu đề");
    expect(joined).toContain("Loại");
    expect(joined).toContain("Đối tượng");
    expect(joined).toContain("Ngày gửi");
  });

  test("no console errors on notification page", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/portal/notifications");
    await page.waitForTimeout(5000);

    // Filter out known non-critical errors (e.g., network, websocket)
    const criticalErrors = consoleErrors.filter(
      (e) =>
        !e.includes("WebSocket") &&
        !e.includes("net::ERR") &&
        !e.includes("favicon") &&
        !e.includes("Failed to load resource")
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
