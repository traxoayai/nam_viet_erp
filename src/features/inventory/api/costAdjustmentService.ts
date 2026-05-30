// src/features/inventory/api/costAdjustmentService.ts
// Service cho màn "Điều chỉnh Giá Vốn" (Batch Cost Adjustment / Revaluation)

import { safeRpc } from "@/shared/lib/safeRpc";
import { supabase } from "@/shared/lib/supabaseClient";

export type CostAdjustmentReason =
  | "data_fix"
  | "supplier_adjust"
  | "nrv_writedown";

export interface BatchValuationRow {
  inventory_batch_id: number;
  batch_id: number;
  product_id: number;
  sku: string | null;
  product_name: string;
  warehouse_id: number | null;
  warehouse_name: string | null;
  lot_number: string;
  expiry_date: string;
  quantity: number;
  inbound_price: number;
  total_value: number;
  last_revalued_at: string | null;
  total_count: number;
}

export interface InventoryTotalValue {
  total_value: number;
  total_qty: number;
  count_batches: number;
  count_zero_price_batches: number;
}

export interface BatchCostChange {
  batch_id: number;
  new_price: number;
}

export interface BulkUpdateResult {
  status: "success" | "error";
  updated_count?: number;
  skipped_count?: number;
  revaluation_ids?: number[];
  message?: string;
}

export interface RevaluationHistoryRow {
  id: number;
  batch_id: number;
  product_id: number;
  warehouse_id: number | null;
  old_price: number;
  new_price: number;
  qty_at_change: number;
  delta_value: number;
  reason_code: CostAdjustmentReason;
  note: string | null;
  vat_synced: boolean;
  user_id: string | null;
  created_at: string;
  batch?: { batch_code: string; expiry_date: string } | null;
  product?: { sku: string | null; name: string } | null;
}

export const costAdjustmentService = {
  /**
   * Grid dữ liệu chính của màn: mỗi dòng = 1 (batch, warehouse) đang có tồn.
   */
  async getValuationGrid(params: {
    warehouseId?: number | null;
    search?: string;
    onlyMissingPrice?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const { data } = await safeRpc(
      "get_batch_valuation_grid",
      {
        p_warehouse_id: params.warehouseId ?? undefined,
        p_search: params.search ?? "",
        p_only_missing_price: params.onlyMissingPrice ?? false,
        p_limit: params.limit ?? 50,
        p_offset: params.offset ?? 0,
      },
      { silent: true }
    );
    return (data ?? []) as BatchValuationRow[];
  },

  /**
   * Stat tổng giá trị tồn kho cho header.
   */
  async getTotalValue(warehouseId?: number | null) {
    const { data } = await safeRpc(
      "get_inventory_total_value",
      { p_warehouse_id: warehouseId ?? undefined },
      { silent: true }
    );
    const raw = (data ?? {}) as Partial<InventoryTotalValue>;
    return {
      total_value: Number(raw.total_value ?? 0),
      total_qty: Number(raw.total_qty ?? 0),
      count_batches: Number(raw.count_batches ?? 0),
      count_zero_price_batches: Number(raw.count_zero_price_batches ?? 0),
    } as InventoryTotalValue;
  },

  /**
   * Cập nhật giá vốn hàng loạt. RPC chạy trong 1 transaction:
   *   UPDATE batches + INSERT batch_revaluations + SYNC vat_inventory_ledger.
   */
  async bulkUpdate(
    changes: BatchCostChange[],
    reason: CostAdjustmentReason,
    note?: string
  ): Promise<BulkUpdateResult> {
    if (!changes.length) {
      return { status: "error", message: "Chưa có thay đổi nào" };
    }

    const { data } = await safeRpc("bulk_update_batch_costs", {
      p_changes: changes as any,
      p_reason: reason,
      p_note: note ?? undefined,
    });

    const row = (data ?? {}) as unknown as BulkUpdateResult;
    if (row?.status === "error") {
      throw new Error(row.message || "Không cập nhật được giá vốn");
    }
    return row;
  },

  /**
   * Lịch sử định giá cho drawer bên phải.
   */
  async getHistory(params: {
    batchId?: number;
    productId?: number;
    limit?: number;
  }) {
    let query = supabase
      .from("batch_revaluations")
      .select(
        `
        id, batch_id, product_id, warehouse_id,
        old_price, new_price, qty_at_change, delta_value,
        reason_code, note, vat_synced, user_id, created_at,
        batch:batches ( batch_code, expiry_date ),
        product:products ( sku, name )
      `
      )
      .order("created_at", { ascending: false })
      .limit(params.limit ?? 50);

    if (params.batchId) query = query.eq("batch_id", params.batchId);
    if (params.productId) query = query.eq("product_id", params.productId);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as RevaluationHistoryRow[];
  },
};
