import { describe, it, expect } from "vitest";

import { pickShelfLocation } from "@/features/sales/hooks/usePickingListPrint";

describe("pickShelfLocation", () => {
  it("trả về null khi invList rỗng hoặc không phải array", () => {
    expect(pickShelfLocation(undefined, 1)).toBeNull();
    expect(pickShelfLocation(null, 1)).toBeNull();
    expect(pickShelfLocation([], 1)).toBeNull();
  });

  it("chỉ lấy shelf_location của đúng kho xuất (warehouseId)", () => {
    const invList = [
      { warehouse_id: 2, shelf_location: "B-02-03", stock_quantity: 50 },
      { warehouse_id: 1, shelf_location: "A-01-01", stock_quantity: 0 },
    ];
    // Order xuất từ kho 1, dù kho 2 có stock cũng phải lấy kệ kho 1
    expect(pickShelfLocation(invList, 1)).toBe("A-01-01");
  });

  it("ưu tiên record có stock_quantity > 0 trong cùng kho", () => {
    const invList = [
      { warehouse_id: 1, shelf_location: "A-OLD", stock_quantity: 0 },
      { warehouse_id: 1, shelf_location: "A-NEW", stock_quantity: 10 },
    ];
    expect(pickShelfLocation(invList, 1)).toBe("A-NEW");
  });

  it("fallback record đầu tiên trong cùng kho khi không có stock > 0", () => {
    const invList = [
      { warehouse_id: 1, shelf_location: "A-FIRST", stock_quantity: 0 },
      { warehouse_id: 1, shelf_location: "A-SECOND", stock_quantity: 0 },
    ];
    expect(pickShelfLocation(invList, 1)).toBe("A-FIRST");
  });

  it("trả về null khi product_inventory không có record cho kho xuất", () => {
    const invList = [
      { warehouse_id: 2, shelf_location: "B-01", stock_quantity: 5 },
      { warehouse_id: 3, shelf_location: "C-01", stock_quantity: 5 },
    ];
    expect(pickShelfLocation(invList, 1)).toBeNull();
  });

  it("bỏ qua record có shelf_location null/undefined trong cùng kho", () => {
    const invList = [
      { warehouse_id: 1, shelf_location: null, stock_quantity: 10 },
      { warehouse_id: 1, shelf_location: "A-VALID", stock_quantity: 0 },
    ];
    expect(pickShelfLocation(invList, 1)).toBe("A-VALID");
  });

  it("warehouseId null/undefined -> trả về null (không guess kho khác)", () => {
    const invList = [
      { warehouse_id: 1, shelf_location: "A-01", stock_quantity: 10 },
    ];
    expect(pickShelfLocation(invList, null)).toBeNull();
    expect(pickShelfLocation(invList, undefined)).toBeNull();
  });
});
