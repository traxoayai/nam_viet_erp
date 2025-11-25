// src/services/purchaseOrderService.ts
import { supabase } from "@/lib/supabaseClient";
import { PurchaseOrderMaster, PurchaseOrderFilters } from "@/types/purchase";

export const purchaseOrderService = {
  // 1. Lấy danh sách PO (Master View)
  async getPOs(filters: PurchaseOrderFilters, page: number, pageSize: number) {
    const { data, error } = await supabase.rpc("get_purchase_orders_master", {
      p_page: page,
      p_page_size: pageSize,
      p_search: filters.search || null,
      p_status_delivery: filters.delivery_status || null,
      p_status_payment: filters.payment_status || null,
      p_date_from: filters.date_from || null,
      p_date_to: filters.date_to || null,
    });

    if (error) {
      console.error("Lỗi RPC get_purchase_orders_master:", error);
      throw error;
    }

    // Lấy total_count từ dòng đầu tiên (nếu có dữ liệu)
    const totalCount = data && data.length > 0 ? data[0].full_count : 0;

    return { data: data as PurchaseOrderMaster[], totalCount };
  },

  // 2. Xóa PO (Chỉ xóa được khi Pending)
  async deletePO(id: number) {
    const { error } = await supabase.rpc("delete_purchase_order", { p_id: id });
    if (error) throw new Error(error.message);
    return true;
  },

  // 6. Tự động tạo đơn (Min/Max)
  async autoCreateMinMax() {
    const { data, error } = await supabase.rpc(
      "auto_create_purchase_orders_min_max"
    );
    if (error) throw new Error(error.message);
    return data as number; // Trả về số lượng đơn đã tạo
  },
};
