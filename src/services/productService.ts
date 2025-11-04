// src/services/productService.ts
import { supabase } from "@/lib/supabaseClient";
import { ProductFilters } from "@/types/product";

interface FetchParams {
  filters: ProductFilters;
  page: number;
  pageSize: number;
}

export const getProducts = async ({ filters, page, pageSize }: FetchParams) => {
  // Gọi "cỗ máy" RPC Sếp đã tạo trong SQL
  const { data, error, count } = await supabase.rpc("get_products_list", {
    search_query: filters.search_query || null,
    category_filter: filters.category_filter || null,
    manufacturer_filter: filters.manufacturer_filter || null,
    status_filter: filters.status_filter || null,
    page_num: page,
    page_size: pageSize,
  });

  if (error) {
    console.error("Lỗi khi gọi RPC get_products_list:", error);
    throw error;
  }

  // Lấy tổng số lượng (total_count) từ bản ghi đầu tiên (nếu có)
  const totalCount = data && data.length > 0 ? data[0].total_count : 0;

  return { data: data || [], totalCount };
};
