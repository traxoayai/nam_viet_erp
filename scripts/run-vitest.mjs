#!/usr/bin/env node
// Wrapper that normalizes Windows drive-letter casing before spawning vitest.
// Fixes: https://github.com/vitest-dev/vitest/issues/5251
//
// Usage: node scripts/run-vitest.mjs [vitest args...]

import fs from "fs";
import { spawn } from "child_process";
import path from "path";

if (process.platform === "win32") {
  try {
    const normalized = fs.realpathSync.native(process.cwd());
    if (normalized !== process.cwd()) {
      process.chdir(normalized);
    }
  } catch {
    // best-effort
  }
}

const vitestBin = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vitest.cmd" : "vitest"
);

const child = spawn(vitestBin, process.argv.slice(2), {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => process.exit(code ?? 0));
