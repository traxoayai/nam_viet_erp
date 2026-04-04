import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["tests/rpc/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: "forks",
    forks: { singleFork: true },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
