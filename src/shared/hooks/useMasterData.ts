// src/shared/hooks/useMasterData.ts
import { useQuery } from "@tanstack/react-query";
import { posService } from "@/features/pos/api/posService";

// Master data hiếm khi thay đổi (Kho, Đơn vị tính...), cache 1 giờ là an toàn.
const MASTER_DATA_STALE_TIME = 1000 * 60 * 60; 

/**
 * Hook để gọi và cache danh sách các Kho Active.
 * Phù hợp cho Dropdown, Filters ở POS, Finance, Purchasing,...
 */
export function useActiveWarehouses() {
  return useQuery({
    queryKey: ["master", "active_warehouses"],
    queryFn: async () => {
      const data = await posService.getActiveWarehouses();
      return data;
    },
    staleTime: MASTER_DATA_STALE_TIME,
    refetchOnWindowFocus: false, // Tránh gọi lại quá nhiều khi chuyển tab
  });
}
