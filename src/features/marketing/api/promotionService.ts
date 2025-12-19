// src/services/promotionService.ts
import { supabase } from "@/shared/lib/supabaseClient";

export interface Promotion {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: "public" | "personal" | "point_exchange";
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order_value: number;
  max_discount_value?: number;
  total_usage_limit?: number;
  usage_count: number;
  usage_limit_per_user: number; // Mới
  customer_id?: number;
  valid_from: string;
  valid_to: string;
  status: string;
  created_at?: string;
}

export const promotionService = {
  async fetchPromotions(search: string = "", status?: string) {
    // <-- CẬP NHẬT THAM SỐ
    let query = supabase
      .from("promotions")
      .select("*")
      .order("created_at", { ascending: false });

    // Logic lọc
    if (status) {
      query = query.eq("status", status);
    }
    if (search) {
      // Tìm theo mã code HOẶC tên chiến dịch
      query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Promotion[]; // (Nhớ import type Promotion)
  },

  // 2. Tạo mã mới (Hỗ trợ tạo hàng loạt cho nhiều khách)
  async createPromotion(data: any) {
    // Nếu là loại Personal và có danh sách khách hàng (Mảng ID)
    if (
      data.type === "personal" &&
      Array.isArray(data.customer_ids) &&
      data.customer_ids.length > 0
    ) {
      const customers = data.customer_ids;
      // Tạo bản sao data cho từng khách
      const batchData = customers.map((customerId: any, index: number) => ({
        ...data,
        customer_id: customerId, // Gán ID từng khách
        // Nếu mã code là 'VIP' -> Tự sinh thành 'VIP-1', 'VIP-2'... hoặc random suffix để tránh trùng
        code: customers.length > 1 ? `${data.code}-${index + 1}` : data.code,
        // Xóa trường customer_ids thừa
        customer_ids: undefined,
      }));

      const { error } = await supabase.from("promotions").insert(batchData);
      if (error) throw error;
    } else {
      // Tạo đơn lẻ (Public hoặc 1 khách)
      // Xóa customer_ids nếu có để tránh lỗi DB không có cột này
      const { customer_ids, ...singleData } = data;
      const { error } = await supabase.from("promotions").insert([singleData]);
      if (error) throw error;
    }
    return true;
  },

  async deletePromotion(id: string) {
    // Xóa cứng (Hard Delete) theo đề xuất của QA nếu chưa dùng
    const { error } = await supabase.from("promotions").delete().eq("id", id);
    if (error) {
      // Nếu lỗi khóa ngoại (đã dùng), chuyển sang inactive
      console.warn("Đã dùng, chuyển sang ẩn.");
      await supabase
        .from("promotions")
        .update({ status: "inactive" })
        .eq("id", id);
    }
    return true;
  },

  // Hàm kiểm tra quan trọng
  async checkPromotionCode(
    code: string,
    customerId: number,
    orderValue: number
  ) {
    const { data, error } = await supabase.rpc("verify_promotion_code", {
      p_code: code,
      p_customer_id: customerId,
      p_order_value: orderValue,
    });
    if (error) throw error;
    return data;
  },
};
