import { Page } from "@playwright/test";

/**
 * Grant browser permissions and set localStorage flags to bypass
 * PermissionGate and SystemSetupModal without modifying production code.
 */
export async function setupBrowserContext(page: Page) {
  // Mock Notification BEFORE any page script runs (survives reload)
  await page.context().addInitScript(() => {
    window.Notification = Object.assign(
      function () { return {}; },
      { permission: "granted", requestPermission: () => Promise.resolve("granted" as NotificationPermission) }
    ) as any;
  });

  // Grant at browser level too
  await page.context().grantPermissions(["notifications"]);

  // Navigate to set localStorage domain
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });

  // Set PermissionGate flag
  await page.evaluate(() => {
    localStorage.setItem("app_permissions_granted", "true");
  });
}

export async function login(
  page: Page,
  email = "admin@test.com",
  password = "Admin@938!"
) {
  await setupBrowserContext(page);

  // Reload to apply all mocks/flags
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // Fill login form
  const emailInput = page.locator(
    "#email, input[id*='email'], input[type='email'], input[placeholder*='Email']"
  ).first();

  await emailInput.waitFor({ state: "visible", timeout: 15000 });
  await emailInput.fill(email);

  const passwordInput = page.locator(
    "#password, input[id*='password'], input[type='password']"
  ).first();
  await passwordInput.fill(password);

  const submitBtn = page.locator(
    "button[type='submit'], button:has-text('Đăng nhập')"
  ).first();
  await submitBtn.click();

  await page.waitForURL(
    (url) => !url.toString().includes("/auth/login"),
    { timeout: 15000 }
  );

  // Xử lý màn hình "Cập nhật Mật khẩu Mới" (lần đăng nhập đầu)
  if (page.url().includes("/onboarding/update-password")) {
    const newPwInput = page.locator("input[type='password']").first();
    await newPwInput.waitFor({ state: "visible", timeout: 5000 });
    await newPwInput.fill(password);

    const confirmPwInput = page.locator("input[type='password']").nth(1);
    await confirmPwInput.fill(password);

    const saveBtn = page.locator(
      "button:has-text('Lưu'), button:has-text('Tiếp tục'), button[type='submit']"
    ).first();
    await saveBtn.click();

    await page.waitForURL(
      (url) => !url.toString().includes("/onboarding"),
      { timeout: 15000 }
    );
  }
}
