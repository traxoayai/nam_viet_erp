/**
 * Unit test cho CSV util (Plan 2 Task 14.1).
 * - Verify quoting đúng với ký tự đặc biệt (`,`, `"`, `\n`).
 * - Verify edge case row rỗng trả về chuỗi rỗng.
 */
import { describe, expect, it } from "vitest";

import { toCSV } from "@/features/chatbot/utils/csv";

describe("toCSV", () => {
  it("quote ký tự đặc biệt", () => {
    const csv = toCSV(
      [{ q: 'Hỏi, có "xarelto"?', n: 3 }],
      [
        { key: "q", label: "Câu" },
        { key: "n", label: "Số lần" },
      ]
    );
    expect(csv).toContain('"Hỏi, có ""xarelto""?"');
  });

  it("row rỗng trả chuỗi rỗng", () => {
    expect(toCSV([], [])).toBe("");
  });
});
