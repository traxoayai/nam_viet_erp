// src/features/sales/api/b2bService.ts
import {
  B2BOrderFilters,
  B2BOrderViewResponse,
  B2BOrderDetail,
} from "../types/b2b.types";

import { safeRpc } from "@/shared/lib/safeRpc";
import { supabase } from "@/shared/lib/supabaseClient";

export const b2bService = {
  getOrderDetail: async (id: string): Promise<B2BOrderDetail> => {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        customer_b2b:customers_b2b(*),
        customer_b2c:customers(*),
        order_items (
          id,
          uom,
          quantity,
          unit_price,
          total_line,
          batch_no,
          expiry_date,
          product:product_id (
            id,
            sku,
            name,
            image_url,
            wholesale_unit   
          )
        ),
        sales_invoices (
            id, status, invoice_number, created_at
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching order detail:", error);
      throw error;
    }

    const orderData = data as any;
    const customerData = orderData.customer_b2b || orderData.customer_b2c;

    // Transform response to match B2BOrderDetail interface
    return {
      id: orderData.id,
      code: orderData.code,
      status: orderData.status,
      created_at: orderData.created_at,
      note: orderData.note,
      payment_method: orderData.payment_method || "COD", // Fallback nếu null

      // Map Customer Info (Fix cột name, phone, shipping_address)
      customer_id: customerData?.id,
      customer_name: customerData?.name || "Khách lẻ",
      customer_phone: customerData?.phone,
      delivery_address:
        orderData.delivery_address || customerData?.shipping_address || customerData?.address,
      tax_code: customerData?.tax_code,
      customer_email: customerData?.email,

      // Map Financials (Fix cột final_amount khớp DB)
      sub_total: orderData.total_amount || 0, // DB: total_amount là tổng tiền hàng
      discount_amount: orderData.discount_amount || 0,
      shipping_fee: orderData.shipping_fee || 0,
      final_amount: orderData.final_amount || 0, // DB: final_amount là khách phải trả
      paid_amount: orderData.paid_amount || 0,
      payment_status: orderData.payment_status || "unpaid",

      // Map Items
      items: (orderData.order_items || []).map((item: any) => ({
        id: item.id,
        product_id: item.product?.id,
        sku: item.product?.sku,
        batch_no: item.batch_no,
        expiry_date: item.expiry_date,
        product_name: item.product?.name || "Sản phẩm đã xóa",
        product_image: item.product?.image_url,
        quantity: item.quantity,
        unit_price: item.unit_price,
        // Lưu ý: total_line trong DB là cột generated, hoặc tính tay
        total_price: item.total_line || item.quantity * item.unit_price,
        // [FIX] Ưu tiên lấy uom của đơn hàng, nếu không có mới fallback về wholesale_unit
        unit_name: item.uom || item.product?.wholesale_unit || "ĐV", 
        uom: item.uom || item.product?.wholesale_unit || "ĐV", // Cung cấp biến uom cho printTemplates
      })),
      sales_invoices: orderData.sales_invoices?.[0] || null, // Map invoice info
    };
  },

  updateStatus: async (id: string, status: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
  },

  cancelOrderSafe: async (orderId: string, reason: string) => {
    const { data } = await safeRpc("cancel_order", {
      p_order_id: orderId,
      p_reason: reason,
    });
    return data;
  },

  // Gọi RPC Nhân bản Đơn hàng
  async cloneOrder(oldOrderId: string) {
    const { data } = await safeRpc("clone_sales_order", {
      p_old_order_id: oldOrderId,
    });
    return data;
  },

  // Gọi RPC Xử lý Trả Hàng Bán
  async processSalesReturn(payload: any) {
    const { data } = await safeRpc("process_sales_return", {
      p_payload: payload,
    });
    return data;
  },

  getOrders: async (params: B2BOrderFilters): Promise<B2BOrderViewResponse> => {
    const { data } = await safeRpc("get_sales_orders_view", {
      p_page: params.page,
      p_page_size: params.pageSize,
      p_search: params.search || undefined,
      p_status: params.status || undefined,
      p_order_type: "B2B",
    });

    // Supabase RPC trả về data dạng JSON, cần ép kiểu
    return data as unknown as B2BOrderViewResponse;
  },

  bulkPayOrders: async (
    orderIds: string[],
    fundAccountId: number,
    note?: string
  ) => {
    const { data } = await safeRpc("bulk_pay_orders", {
      p_order_ids: orderIds,
      p_fund_account_id: fundAccountId,
      p_note: note || "Kế toán thu tiền hàng loạt",
    });

    return data;
  },
};
