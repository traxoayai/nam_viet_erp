// src/features/sales/hooks/useSalesOrders.ts
import { useState, useCallback } from "react";
import { salesService } from "@/features/sales/api/salesService";
import { useListingLogic } from "@/shared/hooks/useListingLogic";

interface UseSalesOrdersProps {
  // Cho phép truyền 'POS', 'B2B', hoặc comma-separated strings như 'POS,CLINICAL'
  orderType?: string;
}

export const useSalesOrders = ({ orderType }: UseSalesOrdersProps = {}) => {
  const [stats, setStats] = useState<any>({
    total_sales: 0,
    count_pending_remittance: 0,
    total_cash_pending: 0,
  });

  const fetcherAdapter = useCallback(async (params: any) => {
    const response = await salesService.getOrders({
      page: params.page,
      pageSize: params.pageSize,
      search: params.search,
      status: params.status,
      remittanceStatus: params.remittanceStatus, // Support for POS filtering
      orderType: orderType, // Pass logic type from Hook props
      // New Filters from UI
      creatorId: params.creatorId,
      paymentStatus: params.paymentStatus,
      invoiceStatus: params.invoiceStatus,
      paymentMethod: params.paymentMethod, // [NEW]
      warehouseId: params.warehouseId,     // [NEW]
      customerId: params.customerId        // [NEW]
    });


    if (response.stats) {
      setStats(response.stats);
    }

    return {
      data: response.data,
      total: response.total,
    };
  }, [orderType]);

  const { tableProps, filterProps, filters, refresh, setFilters } =
    useListingLogic<any>({
      fetcher: fetcherAdapter,
      defaultFilters: {
        status: "",
        paymentStatus: "",
        invoiceStatus: "",
        creatorId: "",
      },
    });

  return {
    // Return compatible props for both SmartTable and manual Table
    tableProps,
    filterProps,
    
    // Direct access for manual usage
    orders: tableProps.dataSource,
    loading: tableProps.loading,
    total: tableProps.pagination.total,
    refresh,
    refetch: refresh, // Alias for manual usage
    
    stats,
    currentFilters: filters, // For FilterAction
    setFilters
  };
};
