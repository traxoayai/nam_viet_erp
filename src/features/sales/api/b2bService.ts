// src/features/sales/api/b2bService.ts
import {
  B2BOrderFilters,
  B2BOrderViewResponse,
  B2BOrderDetail,
} from "../types/b2b.types";

import { accountingService } from "@/features/finance/api/accountingService";
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

    interface RawOrderItem {
      id: string;
      uom?: string;
      quantity?: number;
      unit_price?: number;
      total_line?: number;
      batch_no?: string;
      expiry_date?: string;
      product?: {
        id?: number;
        sku?: string;
        name?: string;
        image_url?: string;
        wholesale_unit?: string;
      };
    }
    interface RawCustomer {
      id?: string | number;
      name?: string;
      phone?: string;
      address?: string;
      shipping_address?: string;
      tax_code?: string;
      email?: string;
    }
    interface RawOrderRow {
      id: string;
      code: string;
      status: string;
      created_at: string;
      note?: string;
      payment_method?: string;
      delivery_address?: string;
      total_amount?: number;
      discount_amount?: number;
      shipping_fee?: number;
      final_amount?: number;
      paid_amount?: number;
      payment_status?: string;
      warehouse_id?: number;
      customer_b2b?: RawCustomer;
      customer_b2c?: RawCustomer;
      order_items?: RawOrderItem[];
      sales_invoices?: Array<{
        id: number;
        status: string;
        invoice_number?: string;
        created_at: string;
      }>;
    }
    const orderData = data as unknown as RawOrderRow;
    const customerData = orderData.customer_b2b || orderData.customer_b2c;

    // Lookup vị trí kệ (shelf_location) cho từng sản phẩm tại kho xuất bán
    // của đơn — phục vụ in phiếu giao hàng để dược sĩ nhặt theo trật tự kệ.
    const productIds: number[] = (orderData.order_items || [])
      .map((it: { product?: { id?: number } }) => it.product?.id)
      .filter((v: unknown): v is number => typeof v === "number");
    const shelfMap = new Map<number, string>();
    if (orderData.warehouse_id && productIds.length > 0) {
      const { data: invRows } = await supabase
        .from("product_inventory")
        .select("product_id, shelf_location")
        .eq("warehouse_id", orderData.warehouse_id)
        .in("product_id", productIds);
      for (const r of (invRows ?? []) as Array<{
        product_id: number;
        shelf_location: string | null;
      }>) {
        if (r.shelf_location) shelfMap.set(r.product_id, r.shelf_location);
      }
    }

    // Transform response to match B2BOrderDetail interface
    return {
      id: orderData.id,
      code: orderData.code,
      status: orderData.status as B2BOrderDetail["status"],
      created_at: orderData.created_at,
      note: orderData.note,
      payment_method:
        (orderData.payment_method as B2BOrderDetail["payment_method"]) ||
        "cash", // Fallback nếu null

      // Map Customer Info (Fix cột name, phone, shipping_address)
      customer_id: String(customerData?.id ?? ""),
      customer_name: customerData?.name || "Khách lẻ",
      customer_phone: customerData?.phone,
      delivery_address:
        orderData.delivery_address ||
        customerData?.shipping_address ||
        customerData?.address ||
        "",
      tax_code: customerData?.tax_code,
      customer_email: customerData?.email,

      // Map Financials (Fix cột final_amount khớp DB)
      sub_total: orderData.total_amount || 0, // DB: total_amount là tổng tiền hàng
      discount_amount: orderData.discount_amount || 0,
      shipping_fee: orderData.shipping_fee || 0,
      final_amount: orderData.final_amount || 0, // DB: final_amount là khách phải trả
      paid_amount: orderData.paid_amount || 0,
      payment_status:
        (orderData.payment_status as B2BOrderDetail["payment_status"]) ||
        "unpaid",

      // Map Items
      items: (orderData.order_items || []).map((item) => ({
        id: item.id,
        product_id: String(item.product?.id ?? ""),
        sku: item.product?.sku,
        batch_no: item.batch_no,
        expiry_date: item.expiry_date,
        product_name: item.product?.name || "Sản phẩm đã xóa",
        product_image: item.product?.image_url,
        quantity: Number(item.quantity ?? 0),
        unit_price: Number(item.unit_price ?? 0),
        // Lưu ý: total_line trong DB là cột generated, hoặc tính tay
        total_price:
          Number(item.total_line ?? 0) ||
          Number(item.quantity ?? 0) * Number(item.unit_price ?? 0),
        // [FIX] Ưu tiên lấy uom của đơn hàng, nếu không có mới fallback về wholesale_unit
        unit_name: item.uom || item.product?.wholesale_unit || "ĐV",
        uom: item.uom || item.product?.wholesale_unit || "ĐV", // Cung cấp biến uom cho printTemplates
        shelf_location:
          (item.product?.id !== undefined && shelfMap.get(item.product.id)) ||
          undefined,
      })),
      sales_invoices: (orderData.sales_invoices?.[0] ?? null) as
        | B2BOrderDetail["sales_invoices"]
        | null,
    };
  },

  updateStatus: async (id: string, status: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
    // Ghi sổ doanh thu + giá vốn khi đơn vào trạng thái ghi nhận (non-blocking).
    // RPC tự status-gate (chỉ ghi PACKED/SHIPPING/DELIVERED/COMPLETED) + idempotent +
    // advisory lock → gọi mọi lần đổi status đều an toàn, không nhân đôi. Vá lỗ hổng
    // đơn set DELIVERED thẳng (không qua đóng gói) bị sót bút toán.
    void accountingService.postSalesOrderSafe(id);
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
  async processSalesReturn(payload: Record<string, unknown>) {
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
