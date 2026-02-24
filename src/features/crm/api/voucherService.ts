import { supabase } from "@/shared/lib/supabaseClient";

export const voucherService = {
  // Lấy danh sách voucher (Promotions) đang chạy
  async getActivePromotions() {
    const { data, error } = await supabase
      .from("promotions")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  // Lấy lịch sử phân phối của 1 voucher
  async getDistributionHistory(promotionId: string) {
    const { data, error } = await supabase
      .from("promotion_targets")
      .select(
        `
        created_at,
        target_type,
        target_id,
        customer_segments ( name ) 
      `
      )
      .eq("promotion_id", promotionId)
      .eq("target_type", "segment"); // Hiện tại chỉ quan tâm đến Segment

    if (error) throw error;

    // Map dữ liệu cho đẹp
    return data.map((item: any) => ({
      target_name: item.customer_segments?.name || `Segment #${item.target_id}`,
      distributed_at: item.created_at,
    }));
  },

  // GỌI RPC: Bắn voucher cho nhóm khách
  async distributeToSegment(promotionId: string, segmentId: number) {
    const { data, error } = await supabase.rpc(
      "distribute_voucher_to_segment",
      {
        p_promotion_id: promotionId,
        p_segment_id: segmentId,
      }
    );

    if (error) throw error;
    return data; // Trả về số lượng khách được nhận
  },
};
