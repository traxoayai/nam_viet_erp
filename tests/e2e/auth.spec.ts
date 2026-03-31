import { test, expect } from "@playwright/test";
import { login, setupBrowserContext } from "./helpers/auth";

test.describe("Auth Flow", () => {
  test("login success -> navigates away from login", async ({ page }) => {
    await login(page);
    expect(page.url()).not.toContain("/auth/login");
  });

  test("login fail -> stays on login or shows error", async ({ page }) => {
    await setupBrowserContext(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const emailInput = page.locator("#email, input[id*='email'], input[type='email']").first();
    await emailInput.waitFor({ state: "visible", timeout: 15000 });
    await emailInput.fill("admin@test.com");

    const passwordInput = page.locator("#password, input[id*='password'], input[type='password']").first();
    await passwordInput.fill("wrongpassword123");

    const submitBtn = page.locator("button[type='submit'], button:has-text('Đăng nhập')").first();
    await submitBtn.click();
    await page.waitForTimeout(3000);

    const stillOnAuth = page.url().includes("/auth");
    const hasError = (await page.locator(".ant-message-error, .ant-alert-error").count()) > 0;
    expect(stillOnAuth || hasError).toBeTruthy();
  });

  test("unauthenticated -> blocked by permission gate or login", async ({ page }) => {
    await page.goto("/purchase-orders");
    await page.waitForTimeout(5000);
    const gateVisible = (await page.locator("text=Yêu cầu Truy cập").count()) > 0;
    const loginVisible = (await page.locator("text=Đăng nhập").count()) > 0;
    const onAuth = page.url().includes("/auth");
    expect(gateVisible || loginVisible || onAuth).toBeTruthy();
  });
});
