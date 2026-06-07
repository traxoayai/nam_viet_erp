import { describe, it, expect } from "vitest";

import { filterLocationOption } from "@/features/location/utils/locationFilter";

describe("filterLocationOption", () => {
  it("khớp không phân biệt dấu tiếng Việt", () => {
    expect(filterLocationOption("ha noi", "Thành phố Hà Nội")).toBe(true);
    expect(filterLocationOption("HÀ NỘI", "Thành phố Hà Nội")).toBe(true);
  });

  it("khớp đ/Đ và không phân biệt hoa thường", () => {
    expect(filterLocationOption("da nang", "Đà Nẵng")).toBe(true);
  });

  it("trả false khi không khớp", () => {
    expect(filterLocationOption("sai gon", "Hà Nội")).toBe(false);
  });

  it("input rỗng/toàn khoảng trắng -> hiện tất cả (true)", () => {
    expect(filterLocationOption("", "Bất kỳ")).toBe(true);
    expect(filterLocationOption("   ", "Bất kỳ")).toBe(true);
  });

  it("label rỗng/undefined + có keyword -> false", () => {
    expect(filterLocationOption("ha", undefined)).toBe(false);
    expect(filterLocationOption("ha", "")).toBe(false);
  });
});
