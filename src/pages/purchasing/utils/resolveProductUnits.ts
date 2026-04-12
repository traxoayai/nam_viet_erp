// src/pages/purchasing/utils/resolveProductUnits.ts

export interface ProductUnit {
  id: number;
  unit_name: string;
  unit_type: string | null;
  is_base: boolean | null;
  conversion_rate: number | null;
  price_sell?: number | null;
  price?: number | null;
}

interface ResolveInput {
  wholesale_unit: string | null;
  retail_unit: string | null;
  product_units: ProductUnit[];
}

export interface ResolveResult {
  wholesaleUnitObj: ProductUnit | undefined;
  retailUnitObj: ProductUnit | undefined;
  hasWholesale: boolean;
  wholesaleRate: number;
  retailRate: number;
}

/**
 * Xác định đơn vị bán buôn / bán lẻ từ product_units.
 * Ưu tiên unit_type (chính xác) trước, fallback sang name matching.
 */
export function resolveProductUnits(input: ResolveInput): ResolveResult {
  const { wholesale_unit, retail_unit, product_units } = input;

  const wholesaleUnitObj =
    product_units.find((u) => u.unit_type === "wholesale") ||
    (wholesale_unit
      ? product_units.find((u) => u.unit_name === wholesale_unit)
      : undefined);

  const retailUnitObj =
    product_units.find((u) => u.unit_type === "retail") ||
    (retail_unit
      ? product_units.find((u) => u.unit_name === retail_unit)
      : undefined) ||
    product_units.find((u) => u.is_base) ||
    product_units[0];

  const wholesaleRate = wholesaleUnitObj?.conversion_rate || 1;
  const retailRate = retailUnitObj?.conversion_rate || 1;

  const hasWholesale =
    !!wholesaleUnitObj &&
    !!retailUnitObj &&
    wholesaleUnitObj.id !== retailUnitObj.id;

  return { wholesaleUnitObj, retailUnitObj, hasWholesale, wholesaleRate, retailRate };
}
