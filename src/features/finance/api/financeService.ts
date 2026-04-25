// src/features/finance/api/financeService.ts
import { safeRpc } from "@/shared/api/safeRpc";
import { DEFAULT_WAREHOUSE_ID } from "@/shared/constants/defaults";
import { supabase } from "@/shared/lib/supabaseClient";

export const financeService = {
  // Tìm khách B2C (Tái sử dụng logic POS)
  searchCustomersB2C: async (keyword: string) => {
    // Gọi RPC search_customers_pos (Đã tồn tại và hoạt động tốt ở POS)
    const { data } = await safeRpc("search_customers_pos", {
      p_keyword: keyword,
      p_limit: 20,
      p_warehouse_id: DEFAULT_WAREHOUSE_ID, // Default warehouse cho context tài chính
    });
    return data || [];
  },

  // Tìm khách B2B
  searchCustomersB2B: async (keyword: string) => {
    const { data } = await safeRpc("search_customers_b2b_v2", {
      p_keyword: keyword,
    });
    return data || [];
  },

  // [NEW] Lấy nợ trực tiếp từ View (Thay thế hoàn toàn cột cũ)
  getB2BDebt: async (customerId: number) => {
    const { data, error } = await supabase
      .from("b2b_customer_debt_view")
      .select("actual_current_debt")
      .eq("customer_id", customerId)
      .maybeSingle();
    if (error) {
      throw new Error(`Không thể tải công nợ B2B: ${error.message}`);
    }
    return Number(data?.actual_current_debt ?? 0);
  },

  getB2BDebtsList: async (customerIds: number[]) => {
    if (!customerIds.length) return {};
    const { data, error } = await supabase
      .from("b2b_customer_debt_view")
      .select("customer_id, actual_current_debt")
      .in("customer_id", customerIds);
    if (error) {
      console.error("[getB2BDebtsList]", error.message);
      throw new Error(`Không thể tải danh sách công nợ B2B: ${error.message}`);
    }
    if (!data || data.length === 0) return {};
    return data.reduce<Record<number, number | null>>((acc, row) => {
      if (row.customer_id != null) {
        acc[row.customer_id] = row.actual_current_debt as number | null;
      }
      return acc;
    }, {});
  },

  // [NEW] Xử lý thanh toán Bulk Gạch nợ
  processBulkPayment: async (payload: {
    p_customer_id: number;
    p_total_amount: number;
    p_allocations: Array<{
      order_id: string | number;
      allocated_amount: number;
    }>;
    p_fund_account_id?: number;
    p_description?: string;
  }) => {
    const { data } = await safeRpc("process_bulk_payment", payload);
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
    const { data } = await safeRpc("get_partner_debt_live", {
      p_partner_id: id,
      p_partner_type: type,
    });
    return data || 0;
  },

  // [NEW] Lấy danh sách giao dịch (cho FinanceTransactionPage)
  getTransactions: async (params: {
    page?: number;
    pageSize?: number;
    search?: string;
    flow?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    creatorId?: string | null;
    fund_id?: number;
  }) => {
    // safeRpc type gen không cho phép null nhưng PG function accept null → cast
    const { data } = await safeRpc("get_transactions", {
      p_page: params.page ?? 1,
      p_page_size: params.pageSize ?? 10,
      p_search: (params.search ?? null) as string,
      p_flow: (params.flow ?? null) as string,
      p_status: (params.status ?? null) as string,
      p_date_from: (params.date_from ?? null) as string,
      p_date_to: (params.date_to ?? null) as string,
      p_creator_id: (params.creatorId ?? null) as string | undefined,
    });

    // Core trả về mảng, phần tử đầu tiên chứa full_count
    const totalCount = data && data.length > 0 ? data[0].full_count : 0;
    return { data: data || [], totalCount };
  },
};
