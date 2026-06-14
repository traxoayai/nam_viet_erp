/**
 * Viettel Post Shipping Constants
 * Configuration, defaults, and static mappings
 */

/**
 * Viettel Post API Configuration
 * Loaded from environment variables at runtime
 */
export const VIETTEL_API_CONFIG = {
  /**
   * Base URL for Viettel Post API
   * Loaded from VITE_VIETTEL_API_URL env var
   * Default: "https://api.viettelpost.vn" (staging)
   */
  baseUrl: import.meta.env.VITE_VIETTEL_API_URL || 'https://api.viettelpost.vn',

  /**
   * API Key for authentication
   * Loaded from VITE_VIETTEL_API_KEY env var
   * MUST be set before runtime
   */
  apiKey: import.meta.env.VITE_VIETTEL_API_KEY || '',

  /**
   * API timeout in milliseconds
   */
  timeout: 5000,

  /**
   * Endpoint for calculating shipping rates
   */
  rateEndpoint: '/v1/shipping/rates',

  /**
   * Endpoint for getting province codes
   */
  provinceEndpoint: '/v1/provinces',
};

/**
 * Default service ID
 * Standard shipping service
 */
export const DEFAULT_SERVICE_ID = 'VTP';

/**
 * Service types supported by Viettel Post
 */
export const VIETTEL_SERVICE_TYPES = {
  /**
   * Standard shipping (2-3 days)
   */
  STANDARD: {
    id: 'VTP',
    label: 'Vận chuyển tiêu chuẩn',
    estimatedDays: 3,
  },

  /**
   * Express shipping (next day)
   */
  EXPRESS: {
    id: 'VTX',
    label: 'Vận chuyển nhanh',
    estimatedDays: 1,
  },

  /**
   * Parcel locker service
   */
  LOCKER: {
    id: 'VTL',
    label: 'Vận chuyển tủ quỹ',
    estimatedDays: 2,
  },
} as const;

/**
 * Cache TTL (Time To Live) in seconds
 * Shipping rates are cached for 1 hour by default
 * Can be customized per rate type
 */
export const CACHE_TTL = {
  /**
   * Standard rate cache (60 minutes)
   */
  RATE: 3600,

  /**
   * Province list cache (24 hours)
   */
  PROVINCES: 86400,

  /**
   * Service type cache (7 days)
   */
  SERVICES: 604800,
} as const;

/**
 * Weight boundaries for rate calculation
 */
export const WEIGHT_BOUNDARIES = {
  /**
   * Minimum package weight (grams)
   */
  MIN: 100,

  /**
   * Maximum package weight for standard service (grams)
   */
  MAX_STANDARD: 30000,

  /**
   * Maximum package weight for express service (grams)
   */
  MAX_EXPRESS: 20000,
} as const;

/**
 * Dimension boundaries for rate calculation
 */
export const DIMENSION_BOUNDARIES = {
  /**
   * Minimum dimension (cm)
   */
  MIN: 5,

  /**
   * Maximum dimension (cm)
   */
  MAX: 200,

  /**
   * Maximum perimeter (length + width + height)
   */
  MAX_PERIMETER: 300,
} as const;

/**
 * Insurance configuration
 * Used for calculating insurance fees
 */
export const INSURANCE_CONFIG = {
  /**
   * Insurance fee percentage (1% of declared value)
   */
  PERCENTAGE: 0.01,

  /**
   * Minimum insurance fee (VND)
   */
  MIN_FEE: 5000,

  /**
   * Maximum insurable value (VND)
   */
  MAX_VALUE: 50000000,
} as const;

/**
 * API error codes and their meanings
 */
export const VIETTEL_ERROR_CODES = {
  /**
   * Invalid request format
   */
  INVALID_REQUEST: '400',

  /**
   * Unauthorized API key
   */
  UNAUTHORIZED: '401',

  /**
   * Resource not found (e.g., province)
   */
  NOT_FOUND: '404',

  /**
   * Rate not available for this route
   */
  RATE_NOT_AVAILABLE: '4041',

  /**
   * Server error
   */
  SERVER_ERROR: '500',

  /**
   * Service unavailable
   */
  SERVICE_UNAVAILABLE: '503',
} as const;

/**
 * RPC function names for Supabase
 * Must match migration definitions
 */
export const SUPABASE_RPC_FUNCTIONS = {
  /**
   * Calculate shipping rate with caching
   */
  CALCULATE_SHIPPING_RATE: 'calculate_shipping_rate',

  /**
   * Get cached rate if available
   */
  GET_CACHED_SHIPPING_RATE: 'get_cached_shipping_rate',

  /**
   * Save new rate to cache
   */
  SAVE_SHIPPING_RATE_CACHE: 'save_shipping_rate_cache',

  /**
   * Clear old cache entries
   */
  CLEANUP_SHIPPING_CACHE: 'cleanup_shipping_cache',
} as const;

/**
 * Common province codes in Vietnam
 * Used for quick reference and validation
 */
export const VIETNAM_PROVINCES = {
  // Northern region
  HANOI: '100',
  HAI_PHONG: '102',
  QUANG_NINH: '103',

  // Central region
  DA_NANG: '203',
  HUE: '204',

  // Southern region
  HCM: '300',
  CAN_THO: '400',

  // Delta region
  MEKONG_DELTA: '700',
} as const;

/**
 * Rate calculation factors
 * Used for fallback rate estimation if API is down
 */
export const RATE_FACTORS = {
  /**
   * Base rate per km (VND)
   */
  BASE_RATE_PER_KM: 500,

  /**
   * Weight surcharge per 100g (VND)
   */
  WEIGHT_SURCHARGE_PER_100G: 2000,

  /**
   * Dimension surcharge per dimension point (VND)
   * Dimension point = (length + 2 * width + 2 * height) / 10
   */
  DIMENSION_SURCHARGE_PER_POINT: 1000,

  /**
   * Same-province discount (percentage)
   */
  SAME_PROVINCE_DISCOUNT: 0.15,

  /**
   * Express service surcharge (percentage)
   */
  EXPRESS_SURCHARGE: 0.5,
} as const;

/**
 * Feature flags for gradual rollout
 */
export const SHIPPING_FEATURES = {
  /**
   * Enable Viettel API rate calculation
   */
  ENABLE_VIETTEL_INTEGRATION: true,

  /**
   * Enable rate caching
   */
  ENABLE_CACHING: true,

  /**
   * Enable rate estimation fallback
   */
  ENABLE_FALLBACK_ESTIMATION: true,

  /**
   * Enable insurance calculations
   */
  ENABLE_INSURANCE: true,

  /**
   * Enable rate history tracking
   */
  ENABLE_HISTORY_TRACKING: true,
} as const;

/**
 * Logging levels for debugging
 */
export const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
} as const;
