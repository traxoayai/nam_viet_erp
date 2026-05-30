// Integration test: heuristic detector public.detect_medical_advice()
// Plan 2 Task 16 — verify 3 case keyword detect:
//  1. Câu vi phạm 2 keyword → matched=true, severity='medium', matches.length=2.
//  2. Câu vô hại "Cho mình 100 hộp xarelto" → matched=false.
//  3. Câu nặng (>=3 keyword) → severity='high'.
//
// detect_medical_advice là IMMUTABLE pure function, không gate quyền → chỉ
// cần adminClient (service_role) gọi RPC, không seed user/session.

import { describe as _describe, expect, it } from "vitest";

import { adminClient, isProduction } from "../helpers/supabase";

const describe = isProduction ? _describe.skip : _describe;

interface DetectResult {
  matched: boolean;
  severity?: "low" | "medium" | "high";
  matches?: string[];
}

async function detect(content: string): Promise<DetectResult> {
  const { data, error } = await adminClient.rpc("detect_medical_advice", {
    p_content: content,
  });
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  return data as DetectResult;
}

describe("detect_medical_advice() — R-04 heuristic", () => {
  it("Câu vi phạm 2 keyword ('liều dùng' + 'tác dụng phụ') → matched=true, severity='medium'", async () => {
    const result = await detect(
      "Bạn cần biết liều dùng thuốc này và xem có tác dụng phụ không."
    );

    expect(result.matched).toBe(true);
    expect(result.severity).toBe("medium");
    expect(Array.isArray(result.matches)).toBe(true);
    expect(result.matches).toEqual(
      expect.arrayContaining(["liều dùng", "tác dụng phụ"])
    );
    // Chỉ có 2 keyword match, không vô tình match thêm
    expect(result.matches).toHaveLength(2);
  });

  it("Câu vô hại 'Cho mình 100 hộp xarelto' → matched=false", async () => {
    const result = await detect("Cho mình 100 hộp xarelto");

    expect(result.matched).toBe(false);
    // Khi matched=false, severity + matches có thể được bỏ qua trong jsonb
    // (hàm chỉ return {matched: false} ở nhánh empty content). Để chắc chắn,
    // assert chỉ trên matched.
  });

  it("Câu nặng (>=3 keyword) → severity='high'", async () => {
    const result = await detect(
      "Liều dùng cho bà bầu, có tác dụng phụ chống chỉ định không?"
    );

    expect(result.matched).toBe(true);
    expect(result.severity).toBe("high");
    expect(Array.isArray(result.matches)).toBe(true);
    // Ít nhất 3 keyword: 'liều dùng', 'bà bầu', 'tác dụng phụ', 'chống chỉ định'
    expect((result.matches ?? []).length).toBeGreaterThanOrEqual(3);
    expect(result.matches).toEqual(
      expect.arrayContaining([
        "liều dùng",
        "bà bầu",
        "tác dụng phụ",
        "chống chỉ định",
      ])
    );
  });
});
