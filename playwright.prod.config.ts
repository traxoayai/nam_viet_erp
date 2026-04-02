import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: "https://nam-viet-erp-eight.vercel.app",
    headless: true,
    screenshot: "only-on-failure",
    trace: "off",
    video: "off",
    viewport: { width: 1280, height: 720 },
    permissions: ["notifications"],
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Không cần webServer vì test trên production
});
