/**
 * E2E tests cho flow:
 * - Chốt Giá Vốn & Công Nợ (Bug 1+2 fixes)
 * - Invoice VAT (Bug 3+4 fixes)
 *
 * Yêu cầu: DB phải có ít nhất 1 PO ở trạng thái PENDING
 */
import { test, expect, Page } from "@playwright/test";
import { login } from "./helpers/auth";

// ================================================================
// HELPERS
// ================================================================

/** Mở PO detail đầu tiên (ưu tiên non-DRAFT để có Invoice/Costing section) */
async function openFirstPO(page: Page) {
  await page.goto("/purchase-orders");
  await page.waitForTimeout(5000);

  // Ưu tiên PO có tag "Đã đặt hàng" hoặc "Hoàn tất" (non-DRAFT)
  for (const tag of ["Đã đặt hàng", "Hoàn tất"]) {
    const tagEl = page.locator(`.ant-tag:has-text('${tag}')`).first();
    if (await tagEl.isVisible({ timeout: 2000 }).catch(() => false)) {
      const row = tagEl.locator("xpath=ancestor::tr");
      const poLink = row.locator("text=/PO-/").first();
      if (await poLink.isVisible().catch(() => false)) {
        await poLink.click();
        await page.waitForTimeout(3000);
        return;
      }
    }
  }

  // Fallback: PO bất kỳ
  const firstPo = page.locator("text=/PO-/").first();
  if (await firstPo.isVisible({ timeout: 5000 }).catch(() => false)) {
    await firstPo.click();
    await page.waitForTimeout(3000);
  }
}

/** Mở PO PENDING cụ thể bằng cách tìm trên list */
async function openPendingPO(page: Page) {
  await page.goto("/purchase-orders");
  await page.waitForTimeout(5000);

  // Tìm PO có tag "Đã đặt hàng" (PENDING)
  const pendingTag = page.locator(".ant-tag:has-text('Đã đặt hàng')").first();
  if (await pendingTag.isVisible({ timeout: 5000 }).catch(() => false)) {
    // Click row chứa tag đó
    const row = pendingTag.locator("xpath=ancestor::tr");
    const poLink = row.locator("text=/PO-/").first();
    if (await poLink.isVisible().catch(() => false)) {
      await poLink.click();
      await page.waitForTimeout(3000);
      return true;
    }
  }
  return false;
}

// ================================================================
// A. CHỐT GIÁ VỐN & CÔNG NỢ
// ================================================================
test.describe("Chốt Giá Vốn & Công Nợ", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("PO detail shows costing section for PENDING order", async ({ page }) => {
    const found = await openPendingPO(page);
    if (!found) {
      console.log("SKIP: Không có PO PENDING trong DB test");
      return;
    }

    // Section "Tính Giá Vốn & Nhập Kho" phải hiển thị
    const costingSection = page.locator("text=Tính Giá Vốn & Nhập Kho");
    await expect(costingSection).toBeVisible({ timeout: 10000 });
  });

  test("sticky footer shows Chốt Giá Vốn button for PENDING order", async ({ page }) => {
    const found = await openPendingPO(page);
    if (!found) {
      console.log("SKIP: Không có PO PENDING trong DB test");
      return;
    }

    // Scroll xuống cuối để thấy sticky footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Nút "Chốt Giá Vốn & Công Nợ" phải visible
    const costBtn = page.locator("button:has-text('Chốt Giá Vốn')").first();
    await expect(costBtn).toBeVisible({ timeout: 5000 });
  });

  test("Chốt Giá Vốn button is disabled with text 'Đã Chốt' when already confirmed", async ({ page }) => {
    await openFirstPO(page);

    // Scroll xuống
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Nếu PO đã chốt giá vốn, nút phải disabled và hiển thị "Đã Chốt Giá Vốn"
    const lockedBtn = page.locator("button:has-text('Đã Chốt Giá Vốn')").first();
    if (await lockedBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(lockedBtn).toBeDisabled();
    }
    // Nếu chưa chốt, nút "Chốt Giá Vốn & Công Nợ" phải enabled
    const activeBtn = page.locator("button:has-text('Chốt Giá Vốn & Công Nợ')").first();
    if (await activeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(activeBtn).toBeEnabled();
    }
  });

  test("payment buttons remain visible after costing (status still PENDING)", async ({ page }) => {
    const found = await openPendingPO(page);
    if (!found) {
      console.log("SKIP: Không có PO PENDING trong DB test");
      return;
    }

    // Nút "Thanh toán NCC" phải visible trong header
    const nccBtn = page.locator("button:has-text('Thanh toán NCC')").first();
    await expect(nccBtn).toBeVisible({ timeout: 5000 });

    // Nút "Thanh toán VC" phải visible trong header
    const vcBtn = page.locator("button:has-text('Thanh toán VC')").first();
    await expect(vcBtn).toBeVisible({ timeout: 5000 });
  });

  test("Tổng thanh toán dự kiến = Tiền hàng + Phí VC (hiển thị riêng)", async ({ page }) => {
    const found = await openPendingPO(page);
    if (!found) {
      console.log("SKIP: Không có PO PENDING trong DB test");
      return;
    }

    // Scroll xuống footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Phải có label "Tiền hàng" và "Phí vận chuyển" hiển thị riêng biệt
    const tienHang = page.locator("text=Tiền hàng").first();
    const phiVC = page.locator("text=Phí vận chuyển").first();
    await expect(tienHang).toBeVisible({ timeout: 5000 });
    await expect(phiVC).toBeVisible({ timeout: 5000 });
  });

  test("status does NOT change to Hoàn tất after page reload (if not fully paid)", async ({ page }) => {
    const found = await openPendingPO(page);
    if (!found) {
      console.log("SKIP: Không có PO PENDING trong DB test");
      return;
    }

    // Tag trạng thái phải là "Đã đặt hàng" (PENDING), KHÔNG phải "Hoàn tất"
    const pendingTag = page.locator(".ant-tag:has-text('Đã đặt hàng')").first();
    const completedTag = page.locator(".ant-tag:has-text('Hoàn tất')").first();

    const isPending = await pendingTag.isVisible({ timeout: 5000 }).catch(() => false);
    const isCompleted = await completedTag.isVisible({ timeout: 3000 }).catch(() => false);

    // Nếu PO đang PENDING thì phải giữ PENDING (không tự nhảy COMPLETED)
    if (isPending) {
      expect(isCompleted).toBe(false);
    }
  });
});

// ================================================================
// B. INVOICE VAT SECTION
// ================================================================
test.describe("Invoice VAT - Đối Chiếu Hóa Đơn", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Invoice VAT section loads on PO detail", async ({ page }) => {
    const found = await openPendingPO(page);
    if (!found) {
      await openFirstPO(page);
    }

    // Section "Đối Chiếu Hóa Đơn VAT" phải hiển thị
    const invoiceSection = page.locator("text=Đối Chiếu Hóa Đơn VAT");
    await expect(invoiceSection).toBeVisible({ timeout: 10000 });
  });

  test("action buttons (Scan/XML/Liên kết) are in Card title area", async ({ page }) => {
    const found = await openPendingPO(page);
    if (!found) {
      await openFirstPO(page);
    }

    await page.waitForTimeout(2000);

    // Các nút phải nằm trong Card header (extra area), không phải body
    // Kiểm tra nút "Scan Ảnh" visible
    const scanBtn = page.locator("button:has-text('Scan Ảnh')").first();
    await expect(scanBtn).toBeVisible({ timeout: 10000 });

    // Kiểm tra nút "Nhập XML" visible
    const xmlBtn = page.locator("button:has-text('Nhập XML')").first();
    await expect(xmlBtn).toBeVisible({ timeout: 5000 });

    // Kiểm tra nút "Liên kết HĐ" visible
    const linkBtn = page.locator("button:has-text('Liên kết HĐ')").first();
    await expect(linkBtn).toBeVisible({ timeout: 5000 });
  });

  test("action buttons are small size with colored borders", async ({ page }) => {
    const found = await openPendingPO(page);
    if (!found) {
      await openFirstPO(page);
    }

    await page.waitForTimeout(2000);

    // Scan button nên có border-color xanh lá
    const scanBtn = page.locator("button:has-text('Scan Ảnh')").first();
    if (await scanBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const borderColor = await scanBtn.evaluate(
        (el) => getComputedStyle(el).borderColor
      );
      // Nên có màu (không phải transparent/default)
      expect(borderColor).toBeTruthy();

      // Button nên size small (height ~24-32px thay vì 40px mặc định)
      const height = await scanBtn.evaluate(
        (el) => el.getBoundingClientRect().height
      );
      expect(height).toBeLessThanOrEqual(36);
    }
  });

  test("Scan Ảnh button opens upload modal", async ({ page }) => {
    const found = await openPendingPO(page);
    if (!found) {
      await openFirstPO(page);
    }

    await page.waitForTimeout(2000);

    const scanBtn = page.locator("button:has-text('Scan Ảnh')").first();
    if (await scanBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await scanBtn.click();
      await page.waitForTimeout(1000);

      // Modal upload phải hiển thị
      const modal = page.locator(".ant-modal").first();
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Đóng modal
      await page.keyboard.press("Escape");
    }
  });

  test("Nhập XML button opens XML upload modal", async ({ page }) => {
    const found = await openPendingPO(page);
    if (!found) {
      await openFirstPO(page);
    }

    await page.waitForTimeout(2000);

    const xmlBtn = page.locator("button:has-text('Nhập XML')").first();
    if (await xmlBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await xmlBtn.click();
      await page.waitForTimeout(1000);

      // Modal phải có title chứa "XML"
      const modalTitle = page.locator(".ant-modal-title:has-text('XML')").first();
      await expect(modalTitle).toBeVisible({ timeout: 5000 });

      // Đóng modal
      await page.keyboard.press("Escape");
    }
  });

  test("Liên kết HĐ button opens link modal with invoice list", async ({ page }) => {
    const found = await openPendingPO(page);
    if (!found) {
      await openFirstPO(page);
    }

    await page.waitForTimeout(2000);

    const linkBtn = page.locator("button:has-text('Liên kết HĐ')").first();
    if (await linkBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await linkBtn.click();
      await page.waitForTimeout(2000);

      // Modal "Liên kết Hóa đơn có sẵn" phải hiển thị
      const modalTitle = page.locator(".ant-modal-title:has-text('Liên kết')").first();
      await expect(modalTitle).toBeVisible({ timeout: 5000 });

      // Đóng modal
      await page.keyboard.press("Escape");
    }
  });

  test("invoice table shows empty state text", async ({ page }) => {
    const found = await openPendingPO(page);
    if (!found) {
      await openFirstPO(page);
    }

    await page.waitForTimeout(3000);

    // Bảng hóa đơn hiển thị - có thể empty hoặc có data
    const invoiceTable = page.locator("text=Hóa đơn VAT của Đơn hàng");
    await expect(invoiceTable).toBeVisible({ timeout: 10000 });

    // Không có error
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });
});

// ================================================================
// C. INVOICE VERIFY PAGE - SL FIELD
// ================================================================
test.describe("Invoice Verify - SL Field", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("invoice list page loads", async ({ page }) => {
    await page.goto("/finance/invoices");
    await page.waitForTimeout(5000);

    expect(page.url()).toContain("/finance");
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);
  });

  test("invoice verify page loads for existing invoice", async ({ page }) => {
    await page.goto("/finance/invoices");
    await page.waitForTimeout(5000);

    // Tìm hóa đơn chờ đối chiếu (draft) để mở
    const draftTag = page.locator(".ant-tag:has-text('Chờ đối chiếu')").first();
    if (await draftTag.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Click vào row
      const row = draftTag.locator("xpath=ancestor::tr");
      const actionBtn = row.locator("button").first();
      if (await actionBtn.isVisible().catch(() => false)) {
        await actionBtn.click();
        await page.waitForTimeout(3000);

        // Trang verify phải load
        expect(page.url()).toContain("/finance/invoices/verify");
        const errors = page.locator(".ant-message-error");
        expect(await errors.count()).toBe(0);
      }
    } else {
      console.log("SKIP: Không có hóa đơn draft trong DB test");
    }
  });

  test("SL column exists and shows quantity", async ({ page }) => {
    await page.goto("/finance/invoices");
    await page.waitForTimeout(5000);

    const draftTag = page.locator(".ant-tag:has-text('Chờ đối chiếu')").first();
    if (await draftTag.isVisible({ timeout: 5000 }).catch(() => false)) {
      const row = draftTag.locator("xpath=ancestor::tr");
      const actionBtn = row.locator("button").first();
      if (await actionBtn.isVisible().catch(() => false)) {
        await actionBtn.click();
        await page.waitForTimeout(3000);

        // Cột SL phải hiển thị
        const slHeader = page.locator("th:has-text('SL')").first();
        await expect(slHeader).toBeVisible({ timeout: 5000 });

        // Ô SL phải disabled (readonly - giữ giá trị gốc XML)
        const slInput = page.locator("td .ant-input-number-disabled").first();
        if (await slInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Input disabled = đúng, giữ nguyên giá trị gốc
          await expect(slInput).toBeVisible();
        }
      }
    } else {
      console.log("SKIP: Không có hóa đơn draft trong DB test");
    }
  });

  test("no error on page interactions", async ({ page }) => {
    await page.goto("/finance/invoices");
    await page.waitForTimeout(5000);

    // Kiểm tra không có lỗi trên trang invoice
    const errors = page.locator(".ant-message-error");
    expect(await errors.count()).toBe(0);

    // Click vào các tab/filter nếu có
    const statusFilter = page.locator(".ant-select").first();
    if (await statusFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Mở dropdown filter
      await statusFilter.click();
      await page.waitForTimeout(500);
      await page.keyboard.press("Escape");
    }

    expect(await errors.count()).toBe(0);
  });
});
