import { supabase } from "@/shared/lib/supabaseClient";
import {
  B2BOrderFilters,
  B2BOrderViewResponse,
  B2BOrderDetail,
} from "../types/b2b.types";

export const b2bService = {
  getOrderDetail: async (id: string): Promise<B2BOrderDetail> => {
    // Query data with joins
    // SENKO V400 FIX: Corrected column names based on Schema
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        customer:customer_id (
          id,
          name,              
          phone,             
          shipping_address   
        ),
        order_items (
          id,
          quantity,
          unit_price,
          total_line,        
          product:product_id (
            id,
            name,
            image_url,
            wholesale_unit   
          )
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching order detail:", error);
      throw error;
    }

    const orderData = data as any;

    // Transform response to match B2BOrderDetail interface
    return {
      id: orderData.id,
      code: orderData.code,
      status: orderData.status,
      created_at: orderData.created_at,
      note: orderData.note,
      payment_method: orderData.payment_method || "COD", // Fallback nếu null

      // Map Customer Info (Fix cột name, phone, shipping_address)
      customer_id: orderData.customer?.id,
      customer_name: orderData.customer?.name || "Khách lẻ",
      customer_phone: orderData.customer?.phone,
      delivery_address:
        orderData.delivery_address || orderData.customer?.shipping_address,

      // Map Financials (Fix cột final_amount khớp DB)
      sub_total: orderData.total_amount || 0, // DB: total_amount là tổng tiền hàng
      discount_amount: orderData.discount_amount || 0,
      shipping_fee: orderData.shipping_fee || 0,
      final_amount: orderData.final_amount || 0, // DB: final_amount là khách phải trả

      // Map Items
      items: (orderData.order_items || []).map((item: any) => ({
        id: item.id,
        product_id: item.product?.id,
        product_name: item.product?.name || "Sản phẩm đã xóa",
        product_image: item.product?.image_url,
        quantity: item.quantity,
        unit_price: item.unit_price,
        // Lưu ý: total_line trong DB là cột generated, hoặc tính tay
        total_price: item.total_line || item.quantity * item.unit_price,
        unit_name: item.product?.wholesale_unit, // Dùng đơn vị buôn
      })),
    };
  },

  updateStatus: async (id: string, status: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
  },

  getOrders: async (params: B2BOrderFilters): Promise<B2BOrderViewResponse> => {
    const { data, error } = await supabase.rpc("get_b2b_orders_view", {
      p_page: params.page,
      p_page_size: params.pageSize,
      p_search: params.search || null,
      p_status: params.status || null,
    });

    if (error) {
      console.error("Lỗi gọi RPC get_b2b_orders_view:", error);
      throw error;
    }

    // Supabase RPC trả về data dạng JSON, cần ép kiểu
    return data as unknown as B2BOrderViewResponse;
  },
};