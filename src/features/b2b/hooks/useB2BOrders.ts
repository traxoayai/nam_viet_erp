// src/features/b2b/hooks/useB2BOrders.ts

import { useState, useCallback } from "react";
// Lưu ý: Kiểm tra lại đường dẫn import b2bService cho đúng với cấu trúc folder của Sếp
import { b2bService } from "@/features/sales/api/b2bService";
import { useListingLogic } from "@/shared/hooks/useListingLogic";
import { B2BOrderItem, B2BOrderStats } from "@/features/sales/types/b2b.types";

export const useB2BOrders = () => {
  const [stats, setStats] = useState<B2BOrderStats>({
    sales_this_month: 0,
    draft_count: 0,
    pending_payment: 0,
  });

  const fetcherAdapter = useCallback(async (params: any) => {
    const response = await b2bService.getOrders({
      page: params.page,
      pageSize: params.pageSize,
      search: params.search,
      status: params.status,
    });

    if (response.stats) {
      setStats(response.stats);
    }

    return {
      data: response.data,
      total: response.total,
    };
  }, []);

  // 1. Lấy đủ các biến từ useListingLogic
  const { tableProps, filterProps, filters, refresh } =
    useListingLogic<B2BOrderItem>({
      fetcher: fetcherAdapter,
      defaultFilters: {
        status: "",
      },
    });

  return {
    tableProps,
    filterProps,
    stats,
    // 2. FIX LỖI: Map 'filters' thành 'currentFilters' để UI dùng
    currentFilters: filters,
    // 3. FIX LỖI: Trả về hàm 'refresh' trực tiếp
    refresh,
  };
};