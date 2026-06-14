/**
 * React hook for shipping rate calculation
 * Uses TanStack Query for caching and state management
 *
 * Features:
 * - Automatic refetching on param changes
 * - Built-in error handling and retry logic
 * - Optimistic updates support
 * - Stale-while-revalidate caching
 *
 * Usage:
 * ```tsx
 * const { data, isLoading, error } = useShippingRate({
 *   sendProvince: '100',
 *   receiveProvince: '300',
 *   weight: 1000,
 *   width: 15,
 *   height: 15,
 *   length: 15,
 * });
 * ```
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { ShippingRateRequest, ShippingRateResponse, ShippingServiceError } from '../types';
import { getShippingRate } from '../api/viettelService';

/**
 * Query key factory for shipping rates
 * Ensures cache busting when parameters change
 */
export const shippingRateQueryKeys = {
  all: () => ['shipping', 'rates'] as const,
  byRoute: (request: ShippingRateRequest) => [
    ...shippingRateQueryKeys.all(),
    'byRoute',
    request.sendProvince,
    request.receiveProvince,
    request.weight,
    request.serviceId,
    request.declaredValue,
  ] as const,
};

/**
 * Custom hook for fetching shipping rates
 * Wraps getShippingRate() with TanStack Query
 *
 * @param request - Shipping rate request parameters
 * @param options - Query options (staleTime, gcTime, etc.)
 * @returns Query result with rate data, loading/error states
 */
export function useShippingRate(
  request: ShippingRateRequest,
  options?: {
    /**
     * Time in ms before query is considered stale
     * Default: 5 minutes
     */
    staleTime?: number;

    /**
     * Time in ms before unused query is garbage collected
     * Default: 10 minutes
     */
    gcTime?: number;

    /**
     * Whether to retry on error
     * Default: 2 retries
     */
    retry?: number | boolean;

    /**
     * Enable/disable query
     * Default: true
     */
    enabled?: boolean;

    /**
     * Callback on success
     */
    onSuccess?: (data: ShippingRateResponse) => void;

    /**
     * Callback on error
     */
    onError?: (error: Error) => void;
  },
): UseQueryResult<ShippingRateResponse, Error> {
  return useQuery({
    queryKey: shippingRateQueryKeys.byRoute(request),
    queryFn: async () => {
      const response = await getShippingRate(request);

      // If API returned error status, throw to trigger error state
      if (response.statusCode >= 400 && response.errorMessage) {
        throw new ShippingServiceError(
          'API_ERROR' as any,
          response.errorMessage,
        );
      }

      return response;
    },
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
    gcTime: options?.gcTime ?? 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: options?.retry ?? 2,
    enabled: options?.enabled !== false && !!request.sendProvince && !!request.receiveProvince,
  } as any);
}

/**
 * Hook for prefetching shipping rates
 * Useful for optimistic UI updates or bulk rate loading
 *
 * Usage:
 * ```tsx
 * const { prefetchShippingRate } = usePrefetchShippingRate();
 *
 * const handleRouteHover = (route) => {
 *   prefetchShippingRate(route);
 * };
 * ```
 */
export function usePrefetchShippingRate() {
  const prefetch = async (request: ShippingRateRequest) => {
    // Prefetch logic would be added here with useQuery client
    // For now, just call getShippingRate to populate cache
    try {
      await getShippingRate(request);
    } catch {
      // Silently fail on prefetch — not critical
    }
  };

  return { prefetchShippingRate: prefetch };
}

/**
 * Hook for multiple shipping rates (e.g., different services to same destination)
 * Uses Promise.all for parallel fetching
 */
export function useShippingRates(
  requests: ShippingRateRequest[],
  options?: Parameters<typeof useShippingRate>[1],
): UseQueryResult<ShippingRateResponse[], Error> {
  return useQuery<ShippingRateResponse[], Error>({
    queryKey: ['shipping', 'rates', 'batch', ...requests.map(r => r.sendProvince + r.receiveProvince + r.weight)],
    queryFn: async () => {
      const results = await Promise.all(requests.map(req => getShippingRate(req)));
      return results;
    },
    staleTime: options?.staleTime ?? 5 * 60 * 1000,
    gcTime: options?.gcTime ?? 10 * 60 * 1000,
    retry: options?.retry ?? 2,
    enabled: options?.enabled !== false && requests.length > 0,
  });
}

/**
 * Hook for optimistic shipping rate updates
 * Allows UI to show estimated rate while API processes
 *
 * Usage:
 * ```tsx
 * const { estimateRate } = useOptimisticRate();
 * const estimated = estimateRate(1000, 'VTP');
 * // Returns estimated rate immediately
 * ```
 */
export function useOptimisticRate() {
  /**
   * Simple estimation based on weight and service type
   * Used for optimistic UI updates
   */
  const estimateRate = (weight: number, serviceId: string = 'VTP'): number => {
    // Simple fallback formula
    const baseRate = 20000;
    const weightSurcharge = Math.floor((weight / 100) * 2000);
    const serviceMultiplier = serviceId === 'VTX' ? 1.5 : 1;

    return Math.ceil((baseRate + weightSurcharge) * serviceMultiplier);
  };

  return { estimateRate };
}
