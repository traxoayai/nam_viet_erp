// src/features/inventory/api/inboundService.ts
import {
  InboundTask,
  InboundFilter,
  InboundDetailResponse,
  ProcessInboundPayload,
} from "../types/inbound";

import { DEFAULT_WAREHOUSE_ID } from "@/shared/constants/defaults";
import { safeRpc } from "@/shared/lib/safeRpc";

export const inboundService = {
  // 1. Get List
  async getInboundTasks(
    filter: InboundFilter
  ): Promise<{ data: InboundTask[]; total: number }> {
    const { data } = await safeRpc("get_warehouse_inbound_tasks", {
      p_page: filter.page,
      p_page_size: filter.pageSize,
      p_search: filter.search || null,
      p_status: filter.status === "all" ? null : filter.status,
      p_date_from: filter.date_from || null,
      p_date_to: filter.date_to || null,
      p_warehouse_id: DEFAULT_WAREHOUSE_ID, // Default warehouse for now, can be parameterized later
    });

    const tasks = (data || []) as InboundTask[];
    const total = tasks.length > 0 ? tasks[0].total_count : 0;
    return { data: tasks, total };
  },

  // 2. Get Detail
  async getInboundDetail(poId: number): Promise<InboundDetailResponse> {
    const { data } = await safeRpc("get_inbound_detail", {
      p_po_id: poId,
    });

    // Ensure structure matches if RPC returns slightly different content,
    // but assuming RPC matches the interface for now.
    return data as InboundDetailResponse;
  },

  // 3. Submit Receipt
  async submitReceipt(payload: ProcessInboundPayload): Promise<void> {
    await safeRpc("process_inbound_receipt", {
      p_po_id: payload.p_po_id,
      p_warehouse_id: payload.p_warehouse_id,
      p_items: payload.p_items,
    });
  },

  // 4. Allocate Costs (Landed Cost)
  async allocateCosts(receiptId: number): Promise<void> {
    await safeRpc("allocate_inbound_costs", {
      p_receipt_id: receiptId,
    });
  },
};
