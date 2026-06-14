import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { defineConfig } from "vitest/config";

// ─── Windows drive-letter casing fix ─────────────────────────────────────
// Vitest 4.x crashes with "Cannot read properties of undefined (reading 'config')"
// when process.cwd() returns a lower-case Windows drive letter (e.g. d:\...).
// https://github.com/vitest-dev/vitest/issues/5251
//
// fs.realpathSync.native normalizes the drive letter to its canonical casing.
if (process.platform === "win32") {
  try {
    const normalized = fs.realpathSync.native(process.cwd());
    if (normalized !== process.cwd()) {
      process.chdir(normalized);
    }
  } catch {
    // ignore — worst case we fall through with whatever cwd we had
  }
}

const ROOT = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  root: ROOT,
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "jsdom",
    testTimeout: 10000,
  },
  resolve: {
    alias: { "@": path.resolve(ROOT, "src") },
  },
});
