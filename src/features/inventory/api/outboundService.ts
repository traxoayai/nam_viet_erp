import { supabase } from "@/shared/lib/supabaseClient";
import { OutboundTask, OutboundStats } from "../types/outbound";

export const outboundService = {
  // 1. Lấy danh sách nhiệm vụ xuất kho
  // SENKO FIX: Đổi warehouseId: string -> number
  async getOutboundTasks(warehouseId: number, search?: string): Promise<OutboundTask[]> {
    const { data, error } = await supabase.rpc("get_warehouse_outbound_tasks", {
      p_warehouse_id: warehouseId,
      p_search: search || null,
    });

    if (error) {
      console.error("Error fetching outbound tasks:", error);
      throw error;
    }

    return data as OutboundTask[];
  },

  // 2. Lấy thống kê
  // SENKO FIX: Đổi warehouseId: string -> number
  async getOutboundStats(warehouseId: number): Promise<OutboundStats> {
    const { data, error } = await supabase.rpc("get_outbound_stats", {
      p_warehouse_id: warehouseId,
    });

    if (error) {
       console.error("Error fetching outbound stats:", error);
       throw error;
    }

    return data as OutboundStats;
  },
};