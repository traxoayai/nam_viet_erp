import { describe, expect, it } from "vitest";

import { adminClient } from "../helpers/supabase";

/**
 * Fee Distribution RPC — allocation_invoice_fees()
 *
 * Allocates purchase fees (shipping, handling, etc.) proportionally across
 * invoice line items based on their line_total values.
 *
 * Guards against:
 *   - Null/undefined parameter handling
 *   - Zero total value edge case
 *   - Incorrect rounding (must round to 2 decimal places)
 *   - Lost precision in proportional calculation
 */
describe("Fee distribution RPC (allocate_invoice_fees)", () => {
  /**
   * Basic proportional allocation test:
   * Line 1: line_total = 1000 (1/3 of total)
   * Line 2: line_total = 2000 (2/3 of total)
   * Fee total: 300
   *
   * Expected:
   * Line 1: (1000/3000) * 300 = 100
   * Line 2: (2000/3000) * 300 = 200
   */
  it("should allocate fees proportionally based on line_total", async () => {
    const items = {
      lines: [
        { product_id: 1, line_total: 1000 },
        { product_id: 2, line_total: 2000 },
      ],
    };

    const { data, error } = await adminClient.rpc("allocate_invoice_fees", {
      p_items_json: items,
      p_fee_total: 300,
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.lines).toHaveLength(2);
    expect(data.lines[0].allocated_fee).toBe(100);
    expect(data.lines[1].allocated_fee).toBe(200);
  });

  /**
   * Three-way split allocation test
   * Ensures RPC can handle more complex scenarios
   */
  it("should allocate fees across three items correctly", async () => {
    const items = {
      lines: [
        { product_id: 1, line_total: 1000 },
        { product_id: 2, line_total: 1500 },
        { product_id: 3, line_total: 2500 },
      ],
    };

    const { data, error } = await adminClient.rpc("allocate_invoice_fees", {
      p_items_json: items,
      p_fee_total: 500,
    });

    expect(error).toBeNull();
    expect(data.lines).toHaveLength(3);
    // Line 1: (1000/5000) * 500 = 100
    expect(data.lines[0].allocated_fee).toBe(100);
    // Line 2: (1500/5000) * 500 = 150
    expect(data.lines[1].allocated_fee).toBe(150);
    // Line 3: (2500/5000) * 500 = 250
    expect(data.lines[2].allocated_fee).toBe(250);
  });

  /**
   * Rounding test: verify fees are rounded to 2 decimal places
   * Total: 1000 + 2000 + 3000 = 6000
   * Fee: 100 (arbitrary, tests rounding)
   *
   * Line 1: (1000/6000) * 100 = 16.666... → 16.67
   * Line 2: (2000/6000) * 100 = 33.333... → 33.33
   * Line 3: (3000/6000) * 100 = 50.000... → 50.00
   */
  it("should round allocated fees to 2 decimal places", async () => {
    const items = {
      lines: [
        { product_id: 1, line_total: 1000 },
        { product_id: 2, line_total: 2000 },
        { product_id: 3, line_total: 3000 },
      ],
    };

    const { data, error } = await adminClient.rpc("allocate_invoice_fees", {
      p_items_json: items,
      p_fee_total: 100,
    });

    expect(error).toBeNull();
    expect(data.lines[0].allocated_fee).toBe(16.67);
    expect(data.lines[1].allocated_fee).toBe(33.33);
    expect(data.lines[2].allocated_fee).toBe(50);
  });

  /**
   * Zero fee_total edge case: should return items unchanged
   */
  it("should return unchanged items when fee_total is 0", async () => {
    const items = {
      lines: [
        { product_id: 1, line_total: 1000 },
        { product_id: 2, line_total: 2000 },
      ],
    };

    const { data, error } = await adminClient.rpc("allocate_invoice_fees", {
      p_items_json: items,
      p_fee_total: 0,
    });

    expect(error).toBeNull();
    expect(data.lines[0]).not.toHaveProperty("allocated_fee");
    expect(data.lines[1]).not.toHaveProperty("allocated_fee");
  });

  /**
   * Zero total_value edge case: should return items unchanged
   * (all line_total are 0 or null)
   */
  it("should return unchanged items when total line value is 0", async () => {
    const items = {
      lines: [
        { product_id: 1, line_total: 0 },
        { product_id: 2, line_total: 0 },
      ],
    };

    const { data, error } = await adminClient.rpc("allocate_invoice_fees", {
      p_items_json: items,
      p_fee_total: 300,
    });

    expect(error).toBeNull();
    expect(data.lines[0]).not.toHaveProperty("allocated_fee");
    expect(data.lines[1]).not.toHaveProperty("allocated_fee");
  });

  /**
   * Null line_total handling: should treat as 0
   */
  it("should treat null line_total as 0", async () => {
    const items = {
      lines: [
        { product_id: 1, line_total: null },
        { product_id: 2, line_total: 1000 },
      ],
    };

    const { data, error } = await adminClient.rpc("allocate_invoice_fees", {
      p_items_json: items,
      p_fee_total: 100,
    });

    expect(error).toBeNull();
    // When total is 1000, line 2 should get entire fee
    expect(data.lines[1].allocated_fee).toBe(100);
  });

  /**
   * Preserve non-allocation fields: ensure existing data is not lost
   */
  it("should preserve existing line item fields after allocation", async () => {
    const items = {
      lines: [
        { product_id: 101, quantity: 5, unit_price: 200, line_total: 1000 },
        { product_id: 102, quantity: 10, unit_price: 200, line_total: 2000 },
      ],
    };

    const { data, error } = await adminClient.rpc("allocate_invoice_fees", {
      p_items_json: items,
      p_fee_total: 300,
    });

    expect(error).toBeNull();
    // Original fields should be preserved
    expect(data.lines[0].product_id).toBe(101);
    expect(data.lines[0].quantity).toBe(5);
    expect(data.lines[0].unit_price).toBe(200);
    expect(data.lines[0].line_total).toBe(1000);
    // New field should be added
    expect(data.lines[0].allocated_fee).toBe(100);
  });

  /**
   * Large fee values: ensure precision doesn't break with large numbers
   */
  it("should handle large fee values correctly", async () => {
    const items = {
      lines: [
        { product_id: 1, line_total: 50000 },
        { product_id: 2, line_total: 150000 },
      ],
    };

    const { data, error } = await adminClient.rpc("allocate_invoice_fees", {
      p_items_json: items,
      p_fee_total: 10000,
    });

    expect(error).toBeNull();
    // Line 1: (50000/200000) * 10000 = 2500
    expect(data.lines[0].allocated_fee).toBe(2500);
    // Line 2: (150000/200000) * 10000 = 7500
    expect(data.lines[1].allocated_fee).toBe(7500);
  });

  /**
   * Single line item: entire fee goes to that line
   */
  it("should allocate entire fee to single line item", async () => {
    const items = {
      lines: [{ product_id: 1, line_total: 5000 }],
    };

    const { data, error } = await adminClient.rpc("allocate_invoice_fees", {
      p_items_json: items,
      p_fee_total: 1000,
    });

    expect(error).toBeNull();
    expect(data.lines).toHaveLength(1);
    expect(data.lines[0].allocated_fee).toBe(1000);
  });
});
