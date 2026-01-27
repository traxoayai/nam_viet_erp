import { supabase } from "@/shared/lib/supabaseClient";

export const financeService = {
  // Tìm khách B2C (Tái sử dụng logic POS)
  searchCustomersB2C: async (keyword: string) => {
    // Gọi RPC search_customers_pos (Đã tồn tại và hoạt động tốt ở POS)
    const { data, error } = await supabase.rpc('search_customers_pos', {
      p_keyword: keyword,
      p_limit: 20,
      p_warehouse_id: 1 // Default warehouse cho context tài chính
    });
    if (error) throw error;
    return data || [];
  },

  // Tìm khách B2B
  searchCustomersB2B: async (keyword: string) => {
    const { data, error } = await supabase.rpc('search_customers_b2b_v2', {
      p_keyword: keyword
    });
    if (error) throw error;
    return data || [];
  },

  // Lấy nợ
  getPartnerDebt: async (id: number, type: string) => {
    const { data, error } = await supabase.rpc('get_partner_debt_live', {
      p_partner_id: id,
      p_partner_type: type
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
        p_creator_id: params.creatorId || null 
    });

    if (error) throw error;
    
    // Core trả về mảng, phần tử đầu tiên chứa full_count
    const totalCount = data && data.length > 0 ? data[0].full_count : 0;
    return { data: data || [], totalCount };
  }
};
