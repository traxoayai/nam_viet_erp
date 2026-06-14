import { describe, it, expect } from "vitest";

import {
  transformViettelProvinceData,
  getMockViettelProvinces,
  ViettelProvinceSyncError,
} from "@/features/shipping/api/viettelProvinceSync";

describe("ViettelProvinceSync — Unit Tests", () => {
  describe("transformViettelProvinceData", () => {
    it("should transform camelCase API response", () => {
      const apiData = [
        { code: "100", name: "Hà Nội", delivery_time: 1 },
        { code: "101", name: "Hải Phòng", delivery_time: 2 },
      ];

      const result = transformViettelProvinceData(apiData);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        code: "100",
        name: "Hà Nội",
        delivery_time: 1,
      });
    });

    it("should transform snake_case API response", () => {
      const apiData = [
        {
          province_code: "200",
          province_name: "TP. Hồ Chí Minh",
          delivery_time_std: 1,
        },
      ];

      const result = transformViettelProvinceData(apiData);

      expect(result[0]).toEqual({
        code: "200",
        name: "TP. Hồ Chí Minh",
        delivery_time: 1,
      });
    });

    it("should handle mixed case field names", () => {
      const apiData = [
        { code: "100", province_name: "Hà Nội", delivery_time: 1 },
        { province_code: "200", name: "TP. Hồ Chí Minh", delivery_time_std: 2 },
      ];

      const result = transformViettelProvinceData(apiData);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Hà Nội");
      expect(result[1].code).toBe("200");
    });

    it("should trim whitespace from code and name", () => {
      const apiData = [
        { code: "  100  ", name: "  Hà Nội  ", delivery_time: 1 },
      ];

      const result = transformViettelProvinceData(apiData);

      expect(result[0].code).toBe("100");
      expect(result[0].name).toBe("Hà Nội");
    });

    it("should parse delivery_time as integer", () => {
      const apiData = [
        { code: "100", name: "Hà Nội", delivery_time: "1" },
        { code: "101", name: "Hải Phòng", delivery_time: 2.7 },
      ];

      const result = transformViettelProvinceData(apiData);

      expect(result[0].delivery_time).toBe(1);
      expect(result[1].delivery_time).toBe(2);
      expect(typeof result[0].delivery_time).toBe("number");
    });

    it("should default missing delivery_time to 1", () => {
      const apiData = [
        { code: "100", name: "Hà Nội" },
        { code: "101", name: "Hải Phòng", delivery_time: undefined },
      ];

      const result = transformViettelProvinceData(apiData);

      expect(result[0].delivery_time).toBe(1);
      expect(result[1].delivery_time).toBe(1);
    });

    it("should default empty string code to empty", () => {
      const apiData = [{ code: "", name: "Test" }];

      const result = transformViettelProvinceData(apiData);

      expect(result[0].code).toBe("");
    });
  });

  describe("getMockViettelProvinces", () => {
    it("should return array of provinces", () => {
      const result = getMockViettelProvinces();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should have required fields in each province", () => {
      const result = getMockViettelProvinces();

      for (const province of result) {
        expect(province).toHaveProperty("code");
        expect(province).toHaveProperty("name");
        expect(province).toHaveProperty("delivery_time");

        expect(typeof province.code).toBe("string");
        expect(typeof province.name).toBe("string");
        expect(typeof province.delivery_time).toBe("number");
      }
    });

    it("should include major Vietnamese provinces", () => {
      const result = getMockViettelProvinces();
      const codes = result.map((p) => p.code);

      // Check for major provinces: Hà Nội (100), TP. Hồ Chí Minh (200)
      expect(codes).toContain("100");
      expect(codes).toContain("200");
    });

    it("should have delivery_time in valid range", () => {
      const result = getMockViettelProvinces();

      for (const province of result) {
        expect(province.delivery_time).toBeGreaterThan(0);
        expect(province.delivery_time).toBeLessThanOrEqual(7); // Max 7 days delivery
      }
    });

    it("should have consistent mock data across calls", () => {
      const call1 = getMockViettelProvinces();
      const call2 = getMockViettelProvinces();

      expect(call1.length).toBe(call2.length);
      expect(call1[0]).toEqual(call2[0]);
    });
  });

  describe("ViettelProvinceSyncError", () => {
    it("should create error with message", () => {
      const error = new ViettelProvinceSyncError("Test error");

      expect(error.message).toBe("Test error");
      expect(error.name).toBe("ViettelProvinceSyncError");
    });

    it("should store original error", () => {
      const originalError = new Error("Original error");
      const error = new ViettelProvinceSyncError(
        "Wrapped error",
        originalError
      );

      expect(error.originalError).toBe(originalError);
      expect(error.message).toBe("Wrapped error");
    });

    it("should be instanceof Error", () => {
      const error = new ViettelProvinceSyncError("Test");

      expect(error instanceof Error).toBe(true);
      expect(error instanceof ViettelProvinceSyncError).toBe(true);
    });

    it("should work with try/catch", () => {
      const throwError = () => {
        throw new ViettelProvinceSyncError("Thrown error");
      };

      expect(() => throwError()).toThrow(ViettelProvinceSyncError);
    });
  });

  describe("Integration with JSON transformation", () => {
    it("should work with mock data transformed to JSON and back", () => {
      const mockData = getMockViettelProvinces();

      // Simulate API response cycle
      const json = JSON.stringify(mockData);
      const parsed = JSON.parse(json);
      const transformed = transformViettelProvinceData(parsed);

      expect(transformed).toHaveLength(mockData.length);
      expect(transformed[0].code).toBe(mockData[0].code);
    });

    it("should handle numeric delivery_time from JSON parse", () => {
      const jsonString = `[
        {"code":"100","name":"Hà Nội","delivery_time":1},
        {"code":"200","name":"TP. Hồ Chí Minh","delivery_time":1}
      ]`;

      const parsed = JSON.parse(jsonString);
      const result = transformViettelProvinceData(parsed);

      expect(result[0].delivery_time).toBe(1);
      expect(result[1].delivery_time).toBe(1);
    });
  });
});
