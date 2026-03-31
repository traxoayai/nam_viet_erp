import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
    headless: true, 
    screenshot: "only-on-failure",
    trace: "on",
    video: "on",
    viewport: { width: 1280, height: 720 },
    permissions: ["notifications"], // Grant notifications permission to bypass onboarding modals
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    port: 5173,
    reuseExistingServer: true,
  },
});
