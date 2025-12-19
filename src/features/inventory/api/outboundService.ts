import { supabase } from "@/shared/lib/supabaseClient";
import { OutboundTask, OutboundStats, OutboundDetailResponse, OutboundFilter } from "../types/outbound";

export const outboundService = {
  // 1. Get List with Filters (V3)
  async getOutboundTasks(filter: OutboundFilter): Promise<{ data: OutboundTask[]; total: number }> {
    const { data, error } = await supabase.rpc("get_warehouse_outbound_tasks", {
      p_page: filter.page,
      p_page_size: filter.pageSize,
      p_search: filter.search || null,
      p_status: filter.status === "All" ? null : filter.status,
      p_type: filter.type || null,
      p_date_from: filter.date_from || null,
      p_date_to: filter.date_to || null,
      p_warehouse_id: 1, 
    });

    if (error) {
      console.error("Error fetching tasks:", error);
      throw error;
    }

    const tasks = (data || []) as OutboundTask[];
    const total = tasks.length > 0 ? tasks[0].total_count : 0;
    return { data: tasks, total };
  },

  // 2. Get Stats
  async getOutboundStats(warehouseId: number): Promise<OutboundStats> {
    const { data, error } = await supabase.rpc("get_outbound_stats", {
      p_warehouse_id: warehouseId,
    });
    if (error) throw error;
    return data as OutboundStats;
  },

  // 3. Get Detail
  async getOrderDetail(orderId: string): Promise<OutboundDetailResponse> {
    const { data, error } = await supabase.rpc("get_outbound_order_detail", {
      p_order_id: orderId,
    });
    if (error) throw error;
    return data as OutboundDetailResponse;
  },

  // 4. Confirm Packing
  async confirmPacking(orderId: string): Promise<void> {
    const { error } = await supabase.rpc("confirm_outbound_packing", {
      p_order_id: orderId,
    });
    if (error) throw error;
  },

  // 5. Update Package Count
  async updatePackageCount(taskId: string, count: number): Promise<void> {
    const { error } = await supabase.rpc("update_outbound_package_count", {
      p_order_id: taskId,
      p_count: count,
    });
    if (error) throw error;
  },

  // 6. Cancel Task
  async cancelTask(taskId: string, reason: string): Promise<void> {
    const { data: userData } = await supabase.auth.getUser(); 
    const { error } = await supabase.rpc("cancel_outbound_task", {
      p_order_id: taskId,
      p_reason: reason,
      p_user_id: userData.user?.id
    });
    if (error) throw error;
  },

  // 7. Save Draft Progress (FIXED RPC NAME)
  async saveProgress(orderId: string, items: {product_id: number, quantity_picked: number}[]): Promise<void> {
      const { error } = await supabase.rpc("save_outbound_progress", {
          p_order_id: orderId,
          p_items: items
      });
      if (error) throw error;
  },

  // 8. Handover to Shipping (V5)
  async handoverShipping(orderId: string): Promise<void> {
      const { error } = await supabase.rpc("handover_to_shipping", {
          p_order_id: orderId
      });
      if (error) throw error;
  }
};