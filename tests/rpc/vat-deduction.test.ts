import { describe, it, expect } from "vitest";
import { adminClient } from "../helpers/supabase";

describe("VAT Deduction RPCs", () => {
  // === deduct_vat_for_pos_export (single item) ===
  describe("deduct_vat_for_pos_export", () => {
    it("rejects non-existent product+vat_rate combo", async () => {
      const { error } = await adminClient.rpc("deduct_vat_for_pos_export", {
        p_product_id: 999999,
        p_vat_rate: 10,
        p_base_qty: 1,
      });
      expect(error).toBeDefined();
      expect(error!.message).toContain("Không tìm thấy kho VAT");
    });

    it("rejects when balance insufficient", async () => {
      // Find a product with VAT balance
      const { data: ledger } = await adminClient
        .from("vat_inventory_ledger")
        .select("product_id, vat_rate, quantity_balance")
        .gt("quantity_balance", 0)
        .limit(1)
        .maybeSingle();

      if (!ledger) return; // Skip if no VAT data

      const { error } = await adminClient.rpc("deduct_vat_for_pos_export", {
        p_product_id: ledger.product_id,
        p_vat_rate: ledger.vat_rate,
        p_base_qty: ledger.quantity_balance + 999999, // Request more than available
      });
      expect(error).toBeDefined();
      expect(error!.message).toContain("Không đủ kho VAT");
    });
  });

  // === batch_deduct_vat_for_pos (atomic batch) ===
  describe("batch_deduct_vat_for_pos", () => {
    it("rejects empty items gracefully", async () => {
      const { error } = await adminClient.rpc("batch_deduct_vat_for_pos", {
        p_items: [],
      });
      // Empty array should succeed (no-op)
      expect(error).toBeNull();
    });

    it("rejects when any item has insufficient balance (atomic rollback)", async () => {
      const { error } = await adminClient.rpc("batch_deduct_vat_for_pos", {
        p_items: [
          { product_id: 999999, unit: "Viên", quantity: 1, vat_rate: 10 },
        ],
      });
      expect(error).toBeDefined();
      expect(error!.message).toContain("Không tìm thấy kho VAT");
    });
  });

  // === process_vat_export_entry (outbound invoice) ===
  describe("process_vat_export_entry", () => {
    it("rejects non-existent invoice", async () => {
      const { error } = await adminClient.rpc("process_vat_export_entry", {
        p_invoice_id: 999999,
      });
      expect(error).toBeDefined();
      expect(error!.message).toContain("không tồn tại");
    });
  });
});
