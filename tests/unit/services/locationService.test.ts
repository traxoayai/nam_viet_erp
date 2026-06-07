import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock chuỗi builder supabase.from().select().eq().order()
const mockOrder = vi.fn();
const mockEq = vi.fn(() => ({ order: mockOrder }));
const mockSelect = vi.fn(() => ({ order: mockOrder, eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { locationService } from "@/features/location/api/locationService";

describe("locationService", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockEq.mockClear();
    mockOrder.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getProvinces", () => {
    it("query bảng provinces, sắp theo tên, trả data", async () => {
      const rows = [
        { code: "01", name: "Hà Nội", full_name: "Thành phố Hà Nội" },
      ];
      mockOrder.mockResolvedValue({ data: rows, error: null });
      const result = await locationService.getProvinces();
      expect(mockFrom).toHaveBeenCalledWith("provinces");
      expect(mockSelect).toHaveBeenCalledWith("code, name, full_name");
      expect(mockOrder).toHaveBeenCalledWith("name", { ascending: true });
      expect(result).toEqual(rows);
    });

    it("trả [] khi có lỗi", async () => {
      mockOrder.mockResolvedValue({ data: null, error: { message: "boom" } });
      expect(await locationService.getProvinces()).toEqual([]);
    });

    it("trả [] khi data null không lỗi", async () => {
      mockOrder.mockResolvedValue({ data: null, error: null });
      expect(await locationService.getProvinces()).toEqual([]);
    });
  });

  describe("getWardsByProvince", () => {
    it("lọc theo province_code, sắp theo tên, trả data", async () => {
      const rows = [
        {
          code: "00001",
          name: "Phúc Xá",
          full_name: "Phường Phúc Xá",
          province_code: "01",
        },
      ];
      mockOrder.mockResolvedValue({ data: rows, error: null });
      const result = await locationService.getWardsByProvince("01");
      expect(mockFrom).toHaveBeenCalledWith("wards");
      expect(mockSelect).toHaveBeenCalledWith(
        "code, name, full_name, province_code"
      );
      expect(mockEq).toHaveBeenCalledWith("province_code", "01");
      expect(mockOrder).toHaveBeenCalledWith("name", { ascending: true });
      expect(result).toEqual(rows);
    });

    it("provinceCode rỗng -> [] và KHÔNG query DB", async () => {
      const result = await locationService.getWardsByProvince("");
      expect(mockFrom).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("trả [] khi có lỗi", async () => {
      mockOrder.mockResolvedValue({ data: null, error: { message: "boom" } });
      expect(await locationService.getWardsByProvince("01")).toEqual([]);
    });
  });
});
