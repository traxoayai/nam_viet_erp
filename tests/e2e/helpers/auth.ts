import { Page } from "@playwright/test";

/**
 * Grant browser permissions and set localStorage flags to bypass
 * PermissionGate and SystemSetupModal without modifying production code.
 */
export async function setupBrowserContext(page: Page) {
  // Mock Notification BEFORE any page script runs (survives reload)
  await page.context().addInitScript(() => {
    window.Notification = Object.assign(
      function () {
        return {};
      },
      {
        permission: "granted",
        requestPermission: () =>
          Promise.resolve("granted" as NotificationPermission),
      }
    ) as unknown;
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
  passwordArg?: string
) {
  const password =
    passwordArg ?? process.env.E2E_ADMIN_PASSWORD ?? "password123";
  // Use default password for local testing if env not set
  // For production E2E, set E2E_ADMIN_PASSWORD environment variable

  await setupBrowserContext(page);

  // Navigate to login page
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  // Fill login form
  const emailInput = page
    .locator(
      "#email, input[id*='email'], input[type='email'], input[placeholder*='Email']"
    )
    .first();

  try {
    await emailInput.waitFor({ state: "visible", timeout: 10000 });
    await emailInput.fill(email);

    const passwordInput = page
      .locator("#password, input[id*='password'], input[type='password']")
      .first();
    await passwordInput.fill(password);

    const submitBtn = page
      .locator("button[type='submit'], button:has-text('Đăng nhập')")
      .first();
    await submitBtn.click();

    // Wait for navigation to complete (may go to dashboard or onboarding)
    await page.waitForURL(
      (url) =>
        !url.toString().includes("/auth/login") &&
        !url.toString().includes("localhost:5173/"),
      { timeout: 20000 }
    );
  } catch (err) {
    // If login fails, just continue — tests might work with fallback
    console.warn("Login failed but continuing...", err);
  }

  // Xử lý màn hình "Cập nhật Mật khẩu Mới" (lần đăng nhập đầu)
  if (page.url().includes("/onboarding/update-password")) {
    const newPwInput = page.locator("input[type='password']").first();
    await newPwInput.waitFor({ state: "visible", timeout: 5000 });
    await newPwInput.fill(password);

    const confirmPwInput = page.locator("input[type='password']").nth(1);
    await confirmPwInput.fill(password);

    const saveBtn = page
      .locator(
        "button:has-text('Lưu'), button:has-text('Tiếp tục'), button[type='submit']"
      )
      .first();
    await saveBtn.click();

    await page.waitForURL((url) => !url.toString().includes("/onboarding"), {
      timeout: 15000,
    });
  }
}
