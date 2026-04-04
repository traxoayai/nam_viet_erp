// src/services/salesService.ts
import {
  CustomerB2B,
  ProductB2B,
  ShippingPartner,
  VoucherRecord,
  CreateSalesOrderPayload,
} from "@/features/sales/types/b2b_sales"; // Import Type mới nhất
import { safeRpc } from "@/shared/lib/safeRpc";
import type { Json } from "@/shared/lib/database.types";
import { supabase } from "@/shared/lib/supabaseClient";

// [NEW] Interface cho Update Order
export interface UpdateOrderPayload {
  p_order_id: string;
  p_customer_id: number;
  p_delivery_address: string;
  p_delivery_time: string;
  p_note: string;
  p_discount_amount: number;
  p_shipping_fee: number;
  p_status?: "DRAFT" | "QUOTE" | "CONFIRMED";
  p_items: {
    product_id: number;
    quantity: number;
    uom: string;
    unit_price: number;
    discount: number;
    is_gift: boolean;
    note?: string;
  }[];
}

export const salesService = {
  // 1. Tìm khách hàng B2B
  async searchCustomers(keyword: string): Promise<CustomerB2B[]> {
    try {
      const { data } = await safeRpc("search_customers_b2b_v2", {
        p_keyword: keyword || "",
      });
      return (data ?? []) as unknown as CustomerB2B[];
    } catch {
      return [];
    }
  },

  // 2. Tìm sản phẩm (Type ProductB2B giờ đã có shelf_location)
  async searchProducts(
    keyword: string,
    warehouseId: number = 1
  ): Promise<ProductB2B[]> {
    try {
      const { data } = await safeRpc("search_products_for_b2b_order", {
        p_keyword: keyword || "",
        p_warehouse_id: warehouseId, // [FIX]
      });
      return (data ?? []) as unknown as ProductB2B[];
    } catch {
      return [];
    }
  },

  // 3. Lấy đối tác vận chuyển
  async getShippingPartners(): Promise<ShippingPartner[]> {
    try {
      const { data } = await safeRpc("get_active_shipping_partners");
      // Data trả về từ RPC cần đảm bảo có trường cut_off_time
      return (data ?? []) as unknown as ShippingPartner[];
    } catch {
      return [];
    }
  },

  // 4. Lấy Voucher
  async getVouchers(
    customerId: number,
    orderTotal: number
  ): Promise<VoucherRecord[]> {
    try {
      const { data } = await safeRpc("get_available_vouchers", {
        p_customer_id: customerId,
        p_order_total: orderTotal,
      });
      return (data ?? []) as unknown as VoucherRecord[];
    } catch {
      return [];
    }
  },

  // 5. Tạo đơn hàng (QUAN TRỌNG: Mapping Payload Mới)
  async createOrder(payload: CreateSalesOrderPayload) {
    // Payload lúc này đã bao gồm: p_delivery_method, p_shipping_partner_id
    const { data } = await safeRpc("create_sales_order", payload as unknown as Record<string, unknown>);

    return data; // Trả về UUID đơn hàng
  },

  // 5.1 [NEW] Cập nhật đơn hàng (Spec V41)
  async updateOrder(payload: UpdateOrderPayload) {
    await safeRpc("update_sales_order", payload);
    return true;
  },

  // 6. [NEW] Lấy danh sách đơn hàng (Unified via RPC V8)
  async getOrders(params: {
    page: number;
    pageSize: number;
    orderType?: string; // Hỗ trợ lọc nhiều loại đơn (Vd: 'POS,CLINICAL')
    search?: string;
    status?: string;
    remittanceStatus?: string; // 'pending' để lọc đơn chưa nộp tiền
    dateFrom?: string; // ISO String
    dateTo?: string; // ISO String
    // New Filters
    creatorId?: string;
    paymentStatus?: string;
    invoiceStatus?: string;
    // [NEW] Filters for RPC V9.2
    paymentMethod?: string;
    warehouseId?: number;
    customerId?: number;
  }) {
    try {
      const { data } = await safeRpc("get_sales_orders_view", {
        p_page: params.page,
        p_page_size: params.pageSize,
        p_search: params.search || "",
        p_status: params.status || undefined,
        p_order_type: params.orderType || undefined,
        p_remittance_status: params.remittanceStatus || undefined,
        p_date_from: params.dateFrom || undefined,
        p_date_to: params.dateTo || undefined,
        p_creator_id: params.creatorId || undefined,
        p_payment_status: params.paymentStatus || undefined,
        p_invoice_status: params.invoiceStatus || undefined,
        p_payment_method: params.paymentMethod || undefined,
        p_warehouse_id: params.warehouseId || undefined,
        p_customer_id: params.customerId || undefined,
      });

      // Data trả về từ RPC đã bao gồm total và stats
      const res = data as unknown as { data: unknown[]; total: number; stats: { total_sales: number; count_pending_remittance: number; total_cash_pending: number } } | null;
      return {
        data: res?.data || [],
        total: res?.total || 0,
        stats: res?.stats || {
          total_sales: 0,
          count_pending_remittance: 0,
          total_cash_pending: 0,
        },
      };
    } catch {
      return { data: [], total: 0, stats: {} };
    }
  },

  // 7. [NEW] Cập nhật Yêu cầu Xuất Hóa Đơn
  async updateInvoiceRequest(orderId: string, invoiceData: Record<string, unknown>) {
    // invoiceData: { companyName, taxCode, address, email, ... }
    const { error } = await supabase
      .from("orders")
      .update({
        invoice_status: "pending", // Chuyển trạng thái thành "Chờ xuất"
        invoice_request_data: invoiceData as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) throw error;
    return true;
  },

  // 8. [NEW] Lấy dữ liệu chi tiết để Xuất Excel Kế toán
  // Hàm này sẽ lấy cả thông tin đơn hàng và danh sách sản phẩm (order_items)
  async getOrdersForInvoiceExport(orderIds: string[]) {
    // Lấy thông tin đơn hàng + items
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        order_items (
          uom,
          quantity,
          unit_price,
          total_line,
          batch_no,
          expiry_date,
          product:product_id (
            sku,
            name
          )
        )
      `
      )
      .in("id", orderIds);

    if (error) throw error;
    return data;
  },

  // 9. [NEW] Xác nhận thu tiền đơn hàng (Bulk Action)
  async confirmPayment(orderIds: (string | number)[], fundAccountId: number) {
    await safeRpc("confirm_order_payment", {
      p_order_ids: orderIds.map(String),
      p_fund_account_id: fundAccountId,
    });
    return true;
  },

  // 10. [NEW] Đánh dấu đơn hàng là Chuyển khoản (Cho flow B2B List)
  async markOrderAsBankTransfer(orderId: string | number) {
    const { error } = await supabase
      .from("orders")
      .update({
        payment_method: "bank_transfer",
        updated_at: new Date().toISOString(),
      })
      .eq("id", String(orderId));

    if (error) throw error;
    return true;
  },

  // [NEW] Thêm hàm này để lấy chi tiết đơn hàng cho việc in ấn
  async getOrderDetail(orderId: number | string) {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
                *,
                customer:customer_id(id, name, phone, shipping_address, tax_code, email),
                items:order_items(
                    id, quantity, unit_price, total_line,
                    product:product_id(
                        id, name, sku, image_url, wholesale_unit,
                        product_inventory(warehouse_id, shelf_location, stock_quantity)
                    )
                ),
                sales_invoices(id, status, invoice_number, created_at)
            `
      )
      .eq("id", String(orderId))
      .single();

    if (error) throw error;
    return data;
  },

  // 11. [NEW] Xóa đơn hàng (Admin Only)
  async deleteOrder(orderId: string | number) {
    const { error } = await supabase.from("orders").delete().eq("id", String(orderId));
    if (error) throw error;
    return true;
  },
};
