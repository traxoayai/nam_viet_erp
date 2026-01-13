// src/services/salesService.ts
import { supabase } from "@/shared/lib/supabaseClient";
import {
  CustomerB2B,
  ProductB2B,
  ShippingPartner,
  VoucherRecord,
  CreateSalesOrderPayload,
} from "@/features/sales/types/b2b_sales"; // Import Type mới nhất

export const salesService = {
  // 1. Tìm khách hàng B2B
  async searchCustomers(keyword: string): Promise<CustomerB2B[]> {
    const { data, error } = await supabase.rpc("search_customers_b2b_v2", {
      p_keyword: keyword || "",
    });
    if (error) {
      console.error("Lỗi tìm khách hàng:", error);
      return [];
    }
    return data || [];
  },

  // 2. Tìm sản phẩm (Type ProductB2B giờ đã có shelf_location)
  async searchProducts(keyword: string, warehouseId: number = 1): Promise<ProductB2B[]> {
    const { data, error } = await supabase.rpc(
      "search_products_for_b2b_order",
      {
        p_keyword: keyword || "",
        p_warehouse_id: warehouseId // [FIX]
      }
    );
    if (error) return [];
    return data || [];
  },

  // 3. Lấy đối tác vận chuyển
  async getShippingPartners(): Promise<ShippingPartner[]> {
    const { data, error } = await supabase.rpc("get_active_shipping_partners");
    if (error) return [];
    // Data trả về từ RPC cần đảm bảo có trường cut_off_time
    return data || [];
  },

  // 4. Lấy Voucher
  async getVouchers(
    customerId: number,
    orderTotal: number
  ): Promise<VoucherRecord[]> {
    const { data, error } = await supabase.rpc("get_available_vouchers", {
      p_customer_id: customerId,
      p_order_total: orderTotal,
    });
    if (error) return [];
    return data || [];
  },

  // 5. Tạo đơn hàng (QUAN TRỌNG: Mapping Payload Mới)
  async createOrder(payload: CreateSalesOrderPayload) {
    // Payload lúc này đã bao gồm: p_delivery_method, p_shipping_partner_id
    const { data, error } = await supabase.rpc("create_sales_order", payload);
    if (error) throw error;
    return data; // Trả về UUID đơn hàng
  },

  // 6. [NEW] Lấy danh sách đơn hàng (Unified)
  async getOrders(params: {
    page: number;
    pageSize: number;
    orderType?: 'B2B' | 'POS'; // Lọc loại đơn
    search?: string;
    status?: string;
    remittanceStatus?: string; // 'pending' để lọc đơn chưa nộp tiền
    dateFrom?: string; // ISO String
    dateTo?: string;   // ISO String
  }) {
    const { data, error } = await supabase.rpc('get_sales_orders_view', {
      p_page: params.page,
      p_page_size: params.pageSize,
      p_order_type: params.orderType || null,
      p_search: params.search || null,
      p_status: params.status || null,
      p_remittance_status: params.remittanceStatus || null,
      p_date_from: params.dateFrom || null,
      p_date_to: params.dateTo || null
    });

    if (error) {
      console.error("Get Orders Error:", error);
      return { data: [], total: 0, stats: {} };
    }


    
    // Core trả về JSONB { data, total, stats }
    return data as {
        data: any[];
        total: number;
        stats: {
            total_sales: number;
            count_pending_remittance: number;
            total_cash_pending: number;
        }
    };
  },

  // 7. [NEW] Cập nhật Yêu cầu Xuất Hóa Đơn
  async updateInvoiceRequest(orderId: string, invoiceData: any) {
    // invoiceData: { companyName, taxCode, address, email, ... }
    const { error } = await supabase
      .from('orders')
      .update({
        invoice_status: 'pending', // Chuyển trạng thái thành "Chờ xuất"
        invoice_request_data: invoiceData,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) throw error;
    return true;
  },

  // 8. [NEW] Lấy dữ liệu chi tiết để Xuất Excel Kế toán
  // Hàm này sẽ lấy cả thông tin đơn hàng và danh sách sản phẩm (order_items)
  async getOrdersForInvoiceExport(orderIds: string[]) {
    // Lấy thông tin đơn hàng + items
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          product_name,
          unit_name,
          quantity,
          unit_price,
          total_price,
          vat_rate -- Cần đảm bảo bảng order_items có cột này hoặc lấy từ product
        )
      `)
      .in('id', orderIds);

    if (error) throw error;
    return data;
  },

  // 9. [NEW] Xác nhận thu tiền đơn hàng (Bulk Action)
  async confirmPayment(orderIds: (string | number)[], fundAccountId: number) {
    const { error } = await supabase.rpc('confirm_order_payment', {
      p_order_ids: orderIds,
      p_fund_account_id: fundAccountId
    });
    if (error) throw error;
    return true;
  }
};
