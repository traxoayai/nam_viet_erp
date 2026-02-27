import { supabase } from "@/shared/lib/supabaseClient";

export const financeService = {
  // Tìm khách B2C (Tái sử dụng logic POS)
  searchCustomersB2C: async (keyword: string) => {
    // Gọi RPC search_customers_pos (Đã tồn tại và hoạt động tốt ở POS)
    const { data, error } = await supabase.rpc("search_customers_pos", {
      p_keyword: keyword,
      p_limit: 20,
      p_warehouse_id: 1, // Default warehouse cho context tài chính
    });
    if (error) throw error;
    return data || [];
  },

  // Tìm khách B2B
  searchCustomersB2B: async (keyword: string) => {
    const { data, error } = await supabase.rpc("search_customers_b2b_v2", {
      p_keyword: keyword,
    });
    if (error) throw error;
    return data || [];
  },

  // [NEW] Lấy nợ trực tiếp từ View (Thay thế hoàn toàn cột cũ)
  getB2BDebt: async (customerId: number) => {
    const { data, error } = await supabase
      .from("b2b_customer_debt_view")
      .select("actual_current_debt")
      .eq("customer_id", customerId)
      .single();
    if (error) {
       // Nếu không tìm thấy, mặc định là 0
       return 0;
    }
    return data?.actual_current_debt || 0;
  },

  getB2BDebtsList: async (customerIds: number[]) => {
    if (!customerIds.length) return {};
    const { data, error } = await supabase
      .from("b2b_customer_debt_view")
      .select("customer_id, actual_current_debt")
      .in("customer_id", customerIds);
    if (error) return {};
    return data.reduce((acc: any, row: any) => {
      acc[row.customer_id] = row.actual_current_debt;
      return acc;
    }, {});
  },

  // [NEW] Xử lý thanh toán Bulk Gạch nợ
  processBulkPayment: async (payload: {
    p_customer_id: number;
    p_total_amount: number;
    p_allocations: any[]; // {order_id, allocated_amount}
    p_fund_account_id?: number;
    p_description?: string;
  }) => {
    const { data, error } = await supabase.rpc("process_bulk_payment", payload);
    if (error) throw error;
    return data;
  },

  // [NEW] Lấy danh sách các đơn hàng B2B chưa thanh toán đủ để gạch nợ
  getB2BPendingOrders: async (customerId: number) => {
    const { data, error } = await supabase
      .from("orders")
      .select("id, code, final_amount, paid_amount, created_at")
      .eq("customer_id", customerId)
      // Theo logic Core mới: chỉ tính nợ khi đơn đã đóng gói/giao
      .in("status", ["PACKED", "SHIPPING", "DELIVERED", "COMPLETED"])
      .not("payment_status", "eq", "paid")
      .order("created_at", { ascending: true }); // Từ cũ nhất đến mới nhất
      
    if (error) throw error;
    return data || [];
  },

  // Lấy nợ (Dành cho B2C, Supplier)
  getPartnerDebt: async (id: number, type: string) => {
    // Nếu là khách hàng B2B, chuyển hướng sang lấy từ View mới
    if (type === "customer_b2b") {
       return await financeService.getB2BDebt(id);
    }
    const { data, error } = await supabase.rpc("get_partner_debt_live", {
      p_partner_id: id,
      p_partner_type: type,
    });
    if (error) throw error;
    return data || 0;
  },

  // [NEW] Lấy danh sách giao dịch (cho FinanceTransactionPage)
  getTransactions: async (params: any) => {
    const { data, error } = await supabase.rpc("get_transactions", {
      p_page: params.page,
      p_page_size: params.pageSize,
      p_search: params.search || null,
      p_flow: params.flow || null,
      p_status: params.status || null,
      p_date_from: params.date_from || null,
      p_date_to: params.date_to || null,

      // [NEW] Mapping đúng tham số Core yêu cầu
      p_creator_id: params.creatorId || null,
    });

    if (error) throw error;

    // Core trả về mảng, phần tử đầu tiên chứa full_count
    const totalCount = data && data.length > 0 ? data[0].full_count : 0;
    return { data: data || [], totalCount };
  },
};
