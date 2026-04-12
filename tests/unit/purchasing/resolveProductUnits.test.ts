import { describe, it, expect } from "vitest";
import { resolveProductUnits } from "@/pages/purchasing/utils/resolveProductUnits";

// === Fixtures dựa trên data PROD thực tế ===

/** Exforge: 3 đơn vị khác nhau, nhưng wholesale_unit === retail_unit === "Hộp" */
const exforgeUnits = [
  { id: 38427, unit_name: "Viên", unit_type: "base", is_base: true, conversion_rate: 1 },
  { id: 38428, unit_name: "Vỉ", unit_type: "retail", is_base: false, conversion_rate: 14 },
  { id: 38429, unit_name: "Hộp", unit_type: "wholesale", is_base: false, conversion_rate: 28 },
];

/** Coversyl Plus: tất cả đều "Hộp" rate 1, nhưng có unit_type khác nhau */
const coversylUnits = [
  { id: 38010, unit_name: "Hộp", unit_type: "base", is_base: true, conversion_rate: 1 },
  { id: 38011, unit_name: "Hộp", unit_type: "retail", is_base: false, conversion_rate: 1 },
  { id: 38012, unit_name: "Hộp", unit_type: "wholesale", is_base: false, conversion_rate: 1 },
];

/** Trileptal: 3 đơn vị rõ ràng, retail_unit !== wholesale_unit */
const trileptalUnits = [
  { id: 40521, unit_name: "Viên", unit_type: "base", is_base: true, conversion_rate: 1 },
  { id: 40522, unit_name: "Vỉ", unit_type: "retail", is_base: false, conversion_rate: 10 },
  { id: 40523, unit_name: "Hộp", unit_type: "wholesale", is_base: false, conversion_rate: 50 },
];

/** Sản phẩm chỉ có 1 đơn vị base, không có wholesale/retail type */
const singleUnitProduct = [
  { id: 100, unit_name: "Chai", unit_type: "base", is_base: true, conversion_rate: 1 },
];

/** Sản phẩm không có unit_type nhưng có name matching */
const legacyUnits = [
  { id: 200, unit_name: "Viên", unit_type: "base", is_base: true, conversion_rate: 1 },
  { id: 201, unit_name: "Vỉ", unit_type: "base", is_base: false, conversion_rate: 10 },
  { id: 202, unit_name: "Hộp", unit_type: "base", is_base: false, conversion_rate: 30 },
];

describe("resolveProductUnits", () => {
  describe("BUG FIX: wholesale_unit === retail_unit (cùng tên)", () => {
    it("Exforge: wholesale_unit=retail_unit='Hộp' nhưng unit_type phân biệt → hasWholesale=true", () => {
      const result = resolveProductUnits({
        wholesale_unit: "Hộp",
        retail_unit: "Hộp",
        product_units: exforgeUnits,
      });

      expect(result.hasWholesale).toBe(true);
      expect(result.wholesaleUnitObj?.id).toBe(38429);
      expect(result.retailUnitObj?.id).toBe(38428);
      expect(result.wholesaleRate).toBe(28);
      expect(result.retailRate).toBe(14);
    });

    it("Coversyl Plus: tất cả 'Hộp' rate 1 nhưng unit_type khác → hasWholesale=true", () => {
      const result = resolveProductUnits({
        wholesale_unit: "Hộp",
        retail_unit: "Hộp",
        product_units: coversylUnits,
      });

      expect(result.hasWholesale).toBe(true);
      expect(result.wholesaleUnitObj?.id).toBe(38012);
      expect(result.retailUnitObj?.id).toBe(38011);
    });
  });

  describe("Trường hợp bình thường (wholesale_unit !== retail_unit)", () => {
    it("Trileptal: retail='Vỉ', wholesale='Hộp' → hasWholesale=true", () => {
      const result = resolveProductUnits({
        wholesale_unit: "Hộp",
        retail_unit: "Vỉ",
        product_units: trileptalUnits,
      });

      expect(result.hasWholesale).toBe(true);
      expect(result.wholesaleUnitObj?.unit_name).toBe("Hộp");
      expect(result.retailUnitObj?.unit_name).toBe("Vỉ");
      expect(result.wholesaleRate).toBe(50);
      expect(result.retailRate).toBe(10);
    });
  });

  describe("Sản phẩm không có đơn vị bán buôn", () => {
    it("chỉ có 1 unit base → hasWholesale=false", () => {
      const result = resolveProductUnits({
        wholesale_unit: null,
        retail_unit: null,
        product_units: singleUnitProduct,
      });

      expect(result.hasWholesale).toBe(false);
      expect(result.wholesaleUnitObj).toBeUndefined();
      expect(result.retailUnitObj?.id).toBe(100);
    });

    it("product_units rỗng → hasWholesale=false, retailUnitObj=undefined", () => {
      const result = resolveProductUnits({
        wholesale_unit: "Hộp",
        retail_unit: "Hộp",
        product_units: [],
      });

      expect(result.hasWholesale).toBe(false);
      expect(result.retailUnitObj).toBeUndefined();
    });
  });

  describe("Fallback: không có unit_type, dùng name matching", () => {
    it("legacy data chỉ có unit_type='base' → fallback sang wholesale_unit/retail_unit name", () => {
      const result = resolveProductUnits({
        wholesale_unit: "Hộp",
        retail_unit: "Vỉ",
        product_units: legacyUnits,
      });

      // Không có unit_type "wholesale" → fallback sang find(unit_name === "Hộp")
      expect(result.wholesaleUnitObj?.id).toBe(202);
      expect(result.wholesaleUnitObj?.unit_name).toBe("Hộp");
      // Không có unit_type "retail" → fallback sang find(unit_name === "Vỉ")
      expect(result.retailUnitObj?.id).toBe(201);
      expect(result.retailUnitObj?.unit_name).toBe("Vỉ");
      expect(result.hasWholesale).toBe(true);
    });

    it("legacy data, wholesale_unit === retail_unit → cùng object → hasWholesale=false", () => {
      const result = resolveProductUnits({
        wholesale_unit: "Hộp",
        retail_unit: "Hộp",
        product_units: legacyUnits,
      });

      // Cả 2 đều find "Hộp" → cùng id 202
      expect(result.wholesaleUnitObj?.id).toBe(202);
      expect(result.retailUnitObj?.id).toBe(202);
      expect(result.hasWholesale).toBe(false);
    });
  });

  describe("Fallback retail: is_base → first element", () => {
    it("không có retail_unit name match → fallback is_base", () => {
      const result = resolveProductUnits({
        wholesale_unit: null,
        retail_unit: "Lọ",
        product_units: singleUnitProduct,
      });

      // "Lọ" không match → fallback is_base → Chai
      expect(result.retailUnitObj?.unit_name).toBe("Chai");
    });

    it("không có is_base → fallback first element", () => {
      const noneBase = [
        { id: 300, unit_name: "Tuýp", unit_type: "base", is_base: false, conversion_rate: 1 },
      ];
      const result = resolveProductUnits({
        wholesale_unit: null,
        retail_unit: null,
        product_units: noneBase,
      });

      expect(result.retailUnitObj?.id).toBe(300);
    });
  });

  describe("Rate defaults", () => {
    it("wholesaleRate mặc định 1 khi không có wholesale unit", () => {
      const result = resolveProductUnits({
        wholesale_unit: null,
        retail_unit: null,
        product_units: singleUnitProduct,
      });

      expect(result.wholesaleRate).toBe(1);
      expect(result.retailRate).toBe(1);
    });
  });
});
