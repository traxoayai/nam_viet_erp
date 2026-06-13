import { Client } from "pg";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { adminClient } from "../helpers/supabase";

/**
 * Integration tests: Multi-VAT invoice schema with items_json + calculate_invoice_value RPC
 *
 * Schema: finance_invoices gains:
 * - items_json JSONB: stores product lines with per-line vat_rate
 * - discount_total DECIMAL(15,2): invoice-level discount
 * - fee_total DECIMAL(15,2): shipping/handling fees
 *
 * RPC: calculate_invoice_value(items_json, discount_total, fee_total)
 * - Sums line_total from items_json.lines[]
 * - Adds fee_total, subtracts discount_total
 * - Returns final total
 */

const DB_CONFIG = {
  host: "127.0.0.1",
  port: 54322,
  user: "postgres",
  password: "postgres",
  database: "postgres",
};

// Test data: deterministic, isolated
const TEST_SUPPLIER_ID = 9999;
const TEST_INVOICE_1_ID = 88881;
const TEST_INVOICE_2_ID = 88882;

let pg: Client;

beforeAll(async () => {
  pg = new Client(DB_CONFIG);
  await pg.connect();

  // Cleanup: delete test invoices (in case of previous run interruption)
  await pg.query(`DELETE FROM public.finance_invoices WHERE id IN ($1, $2)`, [
    TEST_INVOICE_1_ID,
    TEST_INVOICE_2_ID,
  ]);

  // Ensure test supplier exists (or create dummy entry for FK)
  await pg.query(
    `INSERT INTO public.suppliers (id, name, contact_person, email, phone, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    [
      TEST_SUPPLIER_ID,
      "Test Supplier Corp",
      "Test Contact",
      "test@supplier.local",
      "0123456789",
      new Date(),
    ]
  );
});

afterAll(async () => {
  if (pg) {
    // Cleanup test invoices
    await pg.query(`DELETE FROM public.finance_invoices WHERE id IN ($1, $2)`, [
      TEST_INVOICE_1_ID,
      TEST_INVOICE_2_ID,
    ]);
    await pg.end();
  }
});

describe("Multi-VAT invoice management", () => {
  it("should store items_json with per-line vat_rate in a single invoice", async () => {
    const invoiceData = {
      id: TEST_INVOICE_1_ID,
      invoice_number: "INV-2026-001",
      invoice_symbol: "001",
      invoice_date: "2026-06-13",
      supplier_id: TEST_SUPPLIER_ID,
      file_url: "s3://test/invoice-001.pdf",
      items_json: {
        lines: [
          {
            product_id: 1,
            name: "Panadol 500mg",
            quantity: 10,
            unit: "Hộp",
            unit_price: 100000,
            discount_amount: 5000,
            vat_rate: 0.1,
            vat_amount: 95000,
            line_total: 1050000,
          },
          {
            product_id: 2,
            name: "Vitamin B Complex",
            quantity: 5,
            unit: "Bộ",
            unit_price: 200000,
            discount_amount: 0,
            vat_rate: 0.05,
            vat_amount: 50000,
            line_total: 1050000,
          },
        ],
      },
      discount_total: 5000,
      fee_total: 100000,
    };

    // Insert test invoice via Supabase client
    const { data, error } = await adminClient
      .from("finance_invoices")
      .insert(invoiceData)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.items_json).toBeDefined();
    expect(data!.items_json.lines).toHaveLength(2);
    expect(data!.items_json.lines[0].vat_rate).toBe(0.1);
    expect(data!.items_json.lines[1].vat_rate).toBe(0.05);
    expect(data!.discount_total).toBe(5000);
    expect(data!.fee_total).toBe(100000);
  });

  it("should support multiple invoices with different vat_rate combinations", async () => {
    const invoiceData = {
      id: TEST_INVOICE_2_ID,
      invoice_number: "INV-2026-002",
      invoice_symbol: "002",
      invoice_date: "2026-06-13",
      supplier_id: TEST_SUPPLIER_ID,
      file_url: "s3://test/invoice-002.pdf",
      items_json: {
        lines: [
          {
            product_id: 3,
            name: "Antibiotic A",
            quantity: 20,
            unit: "Chai",
            unit_price: 50000,
            discount_amount: 0,
            vat_rate: 0.05,
            vat_amount: 52500,
            line_total: 1052500,
          },
          {
            product_id: 4,
            name: "Antibiotic B",
            quantity: 15,
            unit: "Chai",
            unit_price: 60000,
            discount_amount: 10000,
            vat_rate: 0.1,
            vat_amount: 80000,
            line_total: 880000,
          },
        ],
      },
      discount_total: 10000,
      fee_total: 50000,
    };

    const { data, error } = await adminClient
      .from("finance_invoices")
      .insert(invoiceData)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.items_json.lines).toHaveLength(2);
    expect(data!.items_json.lines[0].vat_rate).toBe(0.05);
    expect(data!.items_json.lines[1].vat_rate).toBe(0.1);
  });

  it("RPC calculate_invoice_value should compute total: sum(line_total) + fee_total - discount_total", async () => {
    // First insert an invoice to test RPC
    const invoiceData = {
      id: TEST_INVOICE_1_ID,
      invoice_number: "INV-2026-003",
      invoice_symbol: "003",
      invoice_date: "2026-06-13",
      supplier_id: TEST_SUPPLIER_ID,
      file_url: "s3://test/invoice-003.pdf",
      items_json: {
        lines: [
          {
            product_id: 5,
            name: "Medicine A",
            quantity: 10,
            unit: "Hộp",
            unit_price: 100000,
            discount_amount: 0,
            vat_rate: 0.1,
            vat_amount: 100000,
            line_total: 1100000,
          },
          {
            product_id: 6,
            name: "Medicine B",
            quantity: 5,
            unit: "Bộ",
            unit_price: 200000,
            discount_amount: 0,
            vat_rate: 0.05,
            vat_amount: 50000,
            line_total: 1050000,
          },
        ],
      },
      discount_total: 100000,
      fee_total: 500000,
    };

    // Delete before insert (cleanup from previous test)
    await pg.query(`DELETE FROM public.finance_invoices WHERE id = $1`, [
      TEST_INVOICE_1_ID,
    ]);

    const { data: insertData, error: insertError } = await adminClient
      .from("finance_invoices")
      .insert(invoiceData)
      .select()
      .single();

    expect(insertError).toBeNull();
    expect(insertData).toBeTruthy();

    // Call RPC: calculate_invoice_value
    // Expected: (1100000 + 1050000) + 500000 - 100000 = 2550000
    const { data: result, error: rpcError } = await adminClient.rpc(
      "calculate_invoice_value",
      {
        p_items_json: insertData!.items_json,
        p_discount_total: insertData!.discount_total,
        p_fee_total: insertData!.fee_total,
      }
    );

    expect(rpcError).toBeNull();
    expect(result).toBeDefined();
    expect(result).toBe(2550000);
  });

  it("RPC calculate_invoice_value with zero discount and fee should return sum of line_total", async () => {
    const itemsJson = {
      lines: [
        {
          product_id: 7,
          name: "Item 1",
          quantity: 1,
          unit: "Cái",
          unit_price: 500000,
          discount_amount: 0,
          vat_rate: 0.1,
          vat_amount: 50000,
          line_total: 550000,
        },
      ],
    };

    const { data: result, error: rpcError } = await adminClient.rpc(
      "calculate_invoice_value",
      {
        p_items_json: itemsJson,
        p_discount_total: 0,
        p_fee_total: 0,
      }
    );

    expect(rpcError).toBeNull();
    expect(result).toBeDefined();
    expect(result).toBe(550000);
  });

  it("RPC calculate_invoice_value with empty lines should return fee_total - discount_total", async () => {
    const itemsJson = {
      lines: [],
    };

    const { data: result, error: rpcError } = await adminClient.rpc(
      "calculate_invoice_value",
      {
        p_items_json: itemsJson,
        p_discount_total: 50000,
        p_fee_total: 200000,
      }
    );

    expect(rpcError).toBeNull();
    expect(result).toBeDefined();
    expect(result).toBe(150000); // 0 + 200000 - 50000
  });

  it("items_json should retain full structure including vat_rate per line", async () => {
    // Query invoice we inserted and verify structure is preserved
    const { data: invoices, error } = await adminClient
      .from("finance_invoices")
      .select("items_json")
      .eq("id", TEST_INVOICE_1_ID)
      .limit(1);

    expect(error).toBeNull();
    expect(invoices).toBeTruthy();
    if (invoices && invoices.length > 0) {
      interface InvoiceItem {
        product_id: number;
        name: string;
        quantity: number;
        unit: string;
        unit_price: number;
        vat_rate: number;
        vat_amount: number;
        line_total: number;
      }
      interface ItemsJson {
        lines: InvoiceItem[];
      }

      const items = invoices[0].items_json as ItemsJson;
      expect(items.lines).toBeDefined();
      expect(Array.isArray(items.lines)).toBe(true);

      // Verify each line has vat_rate
      items.lines.forEach((line) => {
        expect(line.product_id).toBeDefined();
        expect(line.name).toBeDefined();
        expect(line.quantity).toBeDefined();
        expect(line.unit).toBeDefined();
        expect(line.unit_price).toBeDefined();
        expect(line.vat_rate).toBeDefined();
        expect(typeof line.vat_rate).toBe("number");
        expect(line.vat_amount).toBeDefined();
        expect(line.line_total).toBeDefined();
      });
    }
  });
});
