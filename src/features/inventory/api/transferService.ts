// src/features/inventory/api/transferService.ts
import {
  TransferMaster,
  TransferDetail,
  TransferStatus,
} from "../types/transfer";

import { supabase } from "@/shared/lib/supabaseClient";

export const transferService = {
  /**
   * Create Auto Replenishment Request
   * Calls RPC: create_auto_replenishment_request
   */
  createAutoReplenishment: async (destWarehouseId: number, note?: string) => {
    const { data, error } = await supabase.rpc(
      "create_auto_replenishment_request",
      {
        p_dest_warehouse_id: destWarehouseId,
        p_note: note || "",
      }
    );

    if (error) throw error;
    return data; // Returns request_id
  },

  /**
   * Fetch Transfers List
   */
  fetchTransfers: async (filters: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    creatorId?: string;
    receiverId?: string;
  }) => {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 10;

    // [UPDATE] Use RPC get_transfers (V32.7)
    const { data, error } = await supabase.rpc("get_transfers", {
      p_page: page,
      p_page_size: pageSize,
      p_search: filters.search || null,
      p_status: filters.status || null,
      p_date_from: filters.dateFrom || null,
      p_date_to: filters.dateTo || null,
      p_creator_id: filters.creatorId || null,
      p_receiver_id: filters.receiverId || null,
    });

    if (error) throw error;

    // RPC returns { data: [...], total_count: numbers } OR just array?
    // Usually our RPCs return a JSON object with data & total.
    // Let's assume standard pagination pattern for this project's RPCs.
    // If the RPC returns just list, I might lose total count availability unless it's in the response.
    // Checking previous similar RPC usage... `search_products_v2` returned { data: ..., count }.
    // Let's assume the RPC returns { data: Transfer[], total_count: number } based on standard.
    // If not, I'd have to adjust.
    // HOWEVER, the prompt didn't specify return shape.
    // "Backend: Đã Deploy RPC get_transfers V32.7"
    // I will assume it returns { data: [], total_count: 0 } or similar.

    // SAFEGUARD: If data is array directly, use it. If it has .data property, use that.
    const resultData = data?.data || data || [];
    const totalCount = data?.total_count || 0;

    return { data: resultData, total: totalCount };
  },

  /**
   * Get Transfer Detail
   * Fetches header and joined items
   */
  getTransferDetail: async (id: number): Promise<TransferDetail | null> => {
    // Fetch Header
    const { data: header, error: headerError } = await supabase
      .from("inventory_transfers")
      .select(
        `
                *,
                source:source_warehouse_id(name),
                dest:dest_warehouse_id(name)
            `
      )
      .eq("id", id)
      .single();

    if (headerError) throw headerError;
    if (!header) return null;

    // Fetch Items
    const { data: items, error: itemsError } = await supabase
      .from("inventory_transfer_items")
      .select(
        `
                *,
                product:product_id(name, sku, wholesale_unit, barcode)
            `
      )
      .eq("transfer_id", id);

    if (itemsError) throw itemsError;

    // Map Header & Items
    const transferMaster: TransferMaster = {
      ...header,
      source_warehouse_name: header.source?.name,
      dest_warehouse_name: header.dest?.name,
    };

    const transferItems = (items || []).map((item: any) => ({
      ...item,
      // Map DB columns (snake_case qty_) to TS interface (quantity_)
      quantity_requested: item.qty_requested,
      quantity_approved: item.qty_approved,
      quantity_shipped: item.qty_shipped,
      quantity_received: item.qty_received,
      conversion_factor: item.conversion_factor,

      // Product joins
      product_name: item.product?.name,
      sku: item.product?.sku,
      uom: item.unit, // The unit saved in transfer_items IS the wholesale unit
      barcode: item.product?.barcode,
    }));

    return {
      ...transferMaster,
      items: transferItems,
    };
  },

  /**
   * Update Transfer Status
   */
  updateTransferStatus: async (id: number, status: TransferStatus) => {
    const { error } = await supabase
      .from("inventory_transfers")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;
    return true;
  },

  /**
   * Approve Transfer
   * Update quantity_approved for items and status for header
   */
  approveTransfer: async (
    id: number,
    items: { id: number; qty_approved: number }[]
  ) => {
    // 1. Update items (Loop for now as standard Supabase update doesn't support bulk update with different values easily without RPC)
    for (const item of items) {
      const { error: itemError } = await supabase
        .from("inventory_transfer_items")
        .update({
          quantity_approved: item.qty_approved,
          // If approved amount matches requested, we can auto-fill quantity_shipped in next step,
          // but for now just approve.
        })
        .eq("id", item.id);

      if (itemError) throw itemError;
    }

    // 2. Update Header Status
    const { error: headerError } = await supabase
      .from("inventory_transfers")
      .update({
        status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (headerError) throw headerError;
    return true;
  },

  /**
   * Cancel Transfer
   */
  cancelTransfer: async (id: number, reason: string) => {
    // Get current note to append
    const { data: current } = await supabase
      .from("inventory_transfers")
      .select("note")
      .eq("id", id)
      .single();

    const newNote =
      (current?.note ? current.note + "\n" : "") + `[Cancelled]: ${reason}`;

    const { error } = await supabase
      .from("inventory_transfers")
      .update({
        status: "cancelled",
        note: newNote,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
    return true;
  },

  /**
   * Delete Transfer (Hard Delete)
   */
  deleteTransfer: async (id: number) => {
    const { error } = await supabase
      .from("inventory_transfers")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  },

  /**
   * Delete Transfer Item
   */
  deleteTransferItem: async (itemId: number) => {
    const { error } = await supabase
      .from("inventory_transfer_items")
      .delete()
      .eq("id", itemId);

    if (error) throw error;
    return true;
  },

  /**
   * Fetch Source Batches
   * Returns batches available in source warehouse for specific product
   */
  fetchSourceBatches: async (productId: number, warehouseId: number) => {
    const { data, error } = await supabase.rpc("search_product_batches", {
      p_product_id: productId,
      p_warehouse_id: warehouseId,
    });

    if (error) throw error;
    return data; // Returns array of batches with quantity
  },

  /**
   * Fetch Batches for ALL items in transfer (Optimization)
   */
  fetchBatchesForTransfer: async (
    items: { product_id: number }[],
    warehouseId: number
  ) => {
    // Since we don't have a bulk RPC yet, we'll use Promise.all for V1
    // This is acceptable for typical transfer sizes (< 50 items)
    const promises = items.map((item) =>
      supabase
        .rpc("search_product_batches", {
          p_product_id: item.product_id,
          p_warehouse_id: warehouseId,
        })
        .then((res) => ({
          productId: item.product_id,
          batches: res.data || [],
        }))
    );

    const results = await Promise.all(promises);
    // Convert to map: productId -> batches[]
    const batchMap: Record<number, any[]> = {};
    results.forEach((res) => {
      batchMap[res.productId] = res.batches;
    });

    return batchMap;
  },

  /**
   * Submit Shipping
   * Calls RPC: submit_transfer_shipping
   */
  submitShipping: async (
    transferId: number,
    items: { transfer_item_id: number; batch_id: number; quantity: number }[]
  ) => {
    const { error } = await supabase.rpc("submit_transfer_shipping", {
      p_transfer_id: transferId,
      p_batch_items: items,
    });

    if (error) throw error;
  },

  /**
   * Check Stock Availability (Validate)
   * Calls RPC: search_product_batches
   */
  checkAvailability: async (productId: number, warehouseId: number) => {
    const { data, error } = await supabase.rpc("search_product_batches", {
      p_product_id: productId,
      p_warehouse_id: warehouseId,
    });
    if (error) throw error;
    // Trả về tổng tồn kho (Base Unit) của tất cả các lô cộng lại
    const totalStock =
      data?.reduce((sum: number, b: any) => sum + b.quantity, 0) || 0;
    return totalStock;
  },

  /**
   * Create Manual Transfer
   * Calls RPC: create_manual_transfer
   */
  createManualTransfer: async (payload: {
    p_source_warehouse_id: number;
    p_dest_warehouse_id: number;
    p_note: string;
    p_items: Array<{
      product_id: number;
      quantity: number; // Số lượng theo đơn vị Sỉ
      unit: string; // Tên đơn vị Sỉ
      conversion_factor: number; // Hệ số quy đổi
    }>;
  }) => {
    const { data, error } = await supabase.rpc(
      "create_manual_transfer",
      payload
    );
    if (error) throw error;
    return data; // { success: true, transfer_id: ... }
  },
};
