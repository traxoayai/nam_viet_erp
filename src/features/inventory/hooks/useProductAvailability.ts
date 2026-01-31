import { useQuery } from '@tanstack/react-query';
import { inventoryService } from '../api/inventoryService';

export const useProductAvailability = (warehouseId: number, productIds: number[]) => {
  return useQuery({
    queryKey: ['inventory', 'availability', warehouseId, productIds],
    queryFn: () => inventoryService.getAvailability(warehouseId, productIds),
    enabled: !!warehouseId && productIds.length > 0,
    staleTime: 1000 * 60, // 1 minute
  });
};
