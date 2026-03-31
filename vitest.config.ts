import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "jsdom",
    testTimeout: 10000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
