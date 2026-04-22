import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// ─── Windows drive-letter casing fix ─────────────────────────────────────
// See vitest.config.ts for details. Keep both configs in sync.
if (process.platform === "win32") {
  try {
    const normalized = fs.realpathSync.native(process.cwd());
    if (normalized !== process.cwd()) {
      process.chdir(normalized);
    }
  } catch {
    // ignore
  }
}

const ROOT = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  root: ROOT,
  test: {
    include: ["tests/rpc/**/*.test.ts", "tests/integration/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: "forks",
    forks: { singleFork: true },
  },
  resolve: {
    alias: { "@": path.resolve(ROOT, "src") },
  },
});
