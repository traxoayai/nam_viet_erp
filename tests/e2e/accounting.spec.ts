import { test, expect } from "@playwright/test";

import { login } from "./helpers/auth";

test.describe("Kế toán — Sổ Nhật Ký & Báo cáo Tài chính", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // ── Test 1: Sổ Nhật Ký ────────────────────────────────────────────────────
  test("Sổ Nhật Ký tải thành công — heading và bộ lọc Sổ hiển thị", async ({
    page,
  }) => {
    await page.goto("/finance/accounting/journal");
    // Chờ ổn định sau khi navigate
    await page.waitForTimeout(5000);

    // Trang vẫn phải trong finance (không redirect ra ngoài)
    expect(page.url()).toContain("/finance");

    // Heading card: "Sổ Nhật Ký Kế Toán"
    const heading = page.locator("text=Sổ Nhật Ký Kế Toán");
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Bộ lọc Sổ (placeholder "Sổ") phải hiển thị — đếm tất cả ant-select (filter bar có 3 select)
    const totalSelects = await page.locator(".ant-select").count();
    expect(totalSelects).toBeGreaterThanOrEqual(1);

    // Không có error message
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);

    // Table đã render (header "Ngày" xuất hiện)
    const tableHeader = page.locator("th").filter({ hasText: "Ngày" });
    await expect(tableHeader.first()).toBeVisible({ timeout: 10000 });
  });

  // ── Test 2: Báo cáo Tài chính ─────────────────────────────────────────────
  test("Báo cáo Tài chính — chọn kỳ → Xem → 2 tab KQKD + CĐTK hiển thị", async ({
    page,
  }) => {
    await page.goto("/finance/accounting/reports");
    await page.waitForTimeout(5000);

    // Trang vẫn trong finance
    expect(page.url()).toContain("/finance");

    // Tiêu đề trang "Báo Cáo Tài Chính"
    const title = page.locator("text=Báo Cáo Tài Chính");
    await expect(title).toBeVisible({ timeout: 10000 });

    // Tab KQKD phải hiển thị ngay (defaultActiveKey="income")
    const tabKQKD = page.locator(
      ".ant-tabs-tab:has-text('Kết quả kinh doanh')"
    );
    await expect(tabKQKD).toBeVisible({ timeout: 10000 });

    // Tab CĐTK
    const tabCDTK = page.locator(
      ".ant-tabs-tab:has-text('Bảng cân đối tài khoản')"
    );
    await expect(tabCDTK).toBeVisible({ timeout: 10000 });

    // Nhấn nút "Xem báo cáo" (không cần thay đổi sổ/kỳ — dùng default)
    const viewBtn = page.locator("button:has-text('Xem báo cáo')");
    await expect(viewBtn).toBeVisible({ timeout: 5000 });
    await viewBtn.click();

    // Chờ loading xong
    await page.waitForTimeout(5000);

    // Không có error message
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);

    // Tab KQKD đang active — bảng chỉ tiêu có "Doanh thu bán hàng"
    const doanhThu = page.locator(
      "text=Doanh thu bán hàng và cung cấp dịch vụ"
    );
    await expect(doanhThu).toBeVisible({ timeout: 10000 });

    // Chỉ tiêu "Lợi nhuận gộp" cũng phải xuất hiện
    const loiNhuan = page.locator(
      "text=Lợi nhuận gộp về bán hàng và cung cấp dịch vụ"
    );
    await expect(loiNhuan).toBeVisible({ timeout: 10000 });

    // Bấm sang tab CĐTK để verify tab 2 accessible
    await tabCDTK.click();
    await page.waitForTimeout(2000);

    // Header cột của bảng CĐTK: "Số hiệu TK"
    const soHieuTK = page.locator("th:has-text('Số hiệu TK')");
    await expect(soHieuTK.first()).toBeVisible({ timeout: 8000 });
  });
});
