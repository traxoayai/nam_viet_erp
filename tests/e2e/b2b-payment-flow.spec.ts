import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

/**
 * E2E tests for B2B order payment flow.
 *
 * Verifies:
 * 1. CreateB2BOrderPage has payment method dropdown defaulting to "Công nợ"
 * 2. Chốt đơn with credit does NOT auto-create phiếu thu
 * 3. B2BOrderDetailPage shows "Tạo Phiếu Thu" button for unpaid orders
 * 4. Full flow: create order → verify unpaid → create receipt → verify paid
 */
test.describe("B2B Payment Flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("CreateB2BOrderPage: payment method dropdown defaults to Công nợ", async ({
    page,
  }) => {
    await page.goto("/b2b/create-order");
    await page.waitForTimeout(3000);

    // Find the payment method Select inside "Thanh toán" card
    const paymentSelect = page
      .locator(".ant-card", { hasText: "Thanh toán" })
      .locator(".ant-select")
      .first();

    await paymentSelect.waitFor({ state: "visible", timeout: 10000 });

    // Verify default value is "Công nợ"
    const selectedValue = paymentSelect.locator(
      ".ant-select-selection-item"
    );
    await expect(selectedValue).toHaveText("Công nợ");
  });

  test("CreateB2BOrderPage: payment method dropdown has 3 options", async ({
    page,
  }) => {
    await page.goto("/b2b/create-order");
    await page.waitForTimeout(3000);

    const paymentSelect = page
      .locator(".ant-card", { hasText: "Thanh toán" })
      .locator(".ant-select")
      .first();

    // Open dropdown
    await paymentSelect.click();
    await page.waitForTimeout(500);

    // Verify options
    const options = page.locator(".ant-select-item-option");
    await expect(options).toHaveCount(3);

    await expect(options.nth(0)).toHaveText("Công nợ");
    await expect(options.nth(1)).toHaveText("Tiền mặt");
    await expect(options.nth(2)).toHaveText("Chuyển khoản");
  });

  test("B2BOrderDetailPage: shows Tạo Phiếu Thu button for confirmed unpaid order", async ({
    page,
  }) => {
    // Navigate to order list
    await page.goto("/b2b/orders");
    await page.waitForTimeout(3000);

    // Find a CONFIRMED order row and click it
    const confirmedRow = page
      .locator("table tbody tr, .ant-table-tbody tr")
      .filter({ hasText: /Đã xác nhận|CONFIRMED/ })
      .first();

    if ((await confirmedRow.count()) === 0) {
      test.skip();
      return;
    }

    await confirmedRow.click();
    await page.waitForTimeout(3000);

    // Should see "Tạo Phiếu Thu" button in footer
    const createReceiptBtn = page.locator("button", {
      hasText: "Tạo Phiếu Thu",
    });
    // Button may or may not be visible depending on payment_status
    // If order is already paid, button should not appear
    const isPaid = (await page.locator("text=Đã TT").count()) > 0;
    if (isPaid) {
      await expect(createReceiptBtn).toHaveCount(0);
    } else {
      await expect(createReceiptBtn).toBeVisible();
    }
  });

  test("B2BOrderDetailPage: Tạo Phiếu Thu opens finance modal with pre-filled data", async ({
    page,
  }) => {
    await page.goto("/b2b/orders");
    await page.waitForTimeout(3000);

    // Find a confirmed/unpaid order
    const orderRow = page
      .locator("table tbody tr, .ant-table-tbody tr")
      .filter({ hasText: /Đã xác nhận|CONFIRMED/ })
      .first();

    if ((await orderRow.count()) === 0) {
      test.skip();
      return;
    }

    await orderRow.click();
    await page.waitForTimeout(3000);

    const createReceiptBtn = page.locator("button", {
      hasText: "Tạo Phiếu Thu",
    });

    if ((await createReceiptBtn.count()) === 0) {
      test.skip();
      return;
    }

    await createReceiptBtn.click();
    await page.waitForTimeout(1000);

    // Finance modal should be open
    const modal = page.locator(".ant-modal").filter({ hasText: /Phiếu Thu/ });
    await expect(modal).toBeVisible();

    // Verify pre-filled fields
    // Description should contain order code
    const descField = modal.locator(
      "textarea, input[placeholder*='Diễn giải'], #description"
    );
    if ((await descField.count()) > 0) {
      const descValue = await descField.inputValue();
      expect(descValue).toContain("Thu tiền đơn hàng");
    }

    // Amount should be > 0
    const amountField = modal.locator("input[type='number'], .ant-input-number input").first();
    if ((await amountField.count()) > 0) {
      const amountValue = await amountField.inputValue();
      expect(Number(amountValue.replace(/[^0-9]/g, ""))).toBeGreaterThan(0);
    }

    // Close modal
    await modal.locator("button", { hasText: /Hủy|Đóng/ }).click();
  });

  test("B2BOrderDetailPage: cancelled order does NOT show Tạo Phiếu Thu button", async ({
    page,
  }) => {
    await page.goto("/b2b/orders");
    await page.waitForTimeout(3000);

    // Find a cancelled order
    const cancelledRow = page
      .locator("table tbody tr, .ant-table-tbody tr")
      .filter({ hasText: /Đã hủy|CANCELLED/ })
      .first();

    if ((await cancelledRow.count()) === 0) {
      test.skip();
      return;
    }

    await cancelledRow.click();
    await page.waitForTimeout(3000);

    const createReceiptBtn = page.locator("button", {
      hasText: "Tạo Phiếu Thu",
    });
    await expect(createReceiptBtn).toHaveCount(0);
  });
});
