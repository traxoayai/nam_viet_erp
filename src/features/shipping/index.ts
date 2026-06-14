/**
 * Viettel Post Shipping Feature
 * Central export for all shipping-related functionality
 *
 * Usage:
 * ```ts
 * // Service
 * import { getShippingRate, getCachedRate } from '@/features/shipping';
 *
 * // Hook
 * import { useShippingRate } from '@/features/shipping';
 *
 * // Component
 * import { ShippingRateInput } from '@/features/shipping';
 *
 * // Types
 * import type { ShippingRateRequest, ShippingRateResponse } from '@/features/shipping';
 *
 * // Constants
 * import { VIETTEL_SERVICE_TYPES, CACHE_TTL } from '@/features/shipping';
 * ```
 */

// --- API/Service Layer ---
export {
  getShippingRate,
  getCachedRate,
  saveCachedRate,
  cleanupExpiredCache,
  validateShippingRequest,
  calculateInsuranceFee,
} from './api/viettelService';

// --- React Hooks ---
export {
  useShippingRate,
  usePrefetchShippingRate,
  useShippingRates,
  useOptimisticRate,
  shippingRateQueryKeys,
} from './hooks/useShippingRate';

// --- React Components ---
export { ShippingRateInput } from './components/ShippingRateInput';

// --- Types ---
export type {
  ShippingRateRequest,
  ShippingRateResponse,
  ShippingRateCache,
  ViettelApiResponse,
} from './types';

export {
  ShippingErrorType,
  ShippingServiceError,
} from './types';

// --- Constants ---
export {
  VIETTEL_API_CONFIG,
  DEFAULT_SERVICE_ID,
  VIETTEL_SERVICE_TYPES,
  CACHE_TTL,
  WEIGHT_BOUNDARIES,
  DIMENSION_BOUNDARIES,
  INSURANCE_CONFIG,
  VIETTEL_ERROR_CODES,
  SUPABASE_RPC_FUNCTIONS,
  VIETNAM_PROVINCES,
  RATE_FACTORS,
  SHIPPING_FEATURES,
  LOG_LEVELS,
} from './constants';
