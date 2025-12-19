// src/services/inventoryService.ts
import { v4 as uuidv4 } from "uuid";

import { supabase } from "@/shared/lib/supabaseClient";

export const inventoryService = {
  // 1. Tạo Phiếu Nhập Kho (Gọi RPC)
  async createReceipt(payload: any) {
    const { data, error } = await supabase.rpc("create_inventory_receipt", {
      p_po_id: payload.po_id,
      p_warehouse_id: payload.warehouse_id,
      p_note: payload.note,
      p_items: payload.items, // Array [{product_id, quantity, lot_number, expiry_date}]
    });
    if (error) throw error;
    return data;
  },

  // 2. Scan Label AI (Đọc vỏ hộp thuốc)
  async scanProductLabel(file: File) {
    // Upload ảnh tạm
    const fileName = `temp/${uuidv4()}.${file.name.split(".").pop()}`;
    const { error: uploadError } = await supabase.storage
      .from("invoices") // Dùng tạm bucket này hoặc tạo bucket 'evidence'
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("invoices")
      .getPublicUrl(fileName);

    // Gọi AI
    const { data, error } = await supabase.functions.invoke(
      "scan-product-label",
      {
        body: { file_url: urlData.publicUrl },
      }
    );

    if (error) throw error;
    return { ...data, file_url: urlData.publicUrl }; // Trả về cả URL để lưu bằng chứng
  },

  // --- Lấy phiếu nhập theo PO ID ---
  async getReceiptByPO(poId: number) {
    const { data, error } = await supabase
      .from("inventory_receipts")
      .select(
        `
        *,
        items:inventory_receipt_items (
          product_id, quantity, lot_number, expiry_date,
          product:products (name, sku, retail_unit)
        )
      `
      )
      .eq("po_id", poId)
      .single(); // Lấy 1 phiếu (giả định 1 PO nhập 1 lần)

    if (error) throw error;
    return data;
  },
};
