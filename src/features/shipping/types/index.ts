/**
 * Viettel Post Shipping Types
 * API integration types for real-time shipping rate calculation
 */

export interface ShippingRateRequest {
  /**
   * Sender's province code (Viettel Post format)
   * Example: "100" for Hanoi
   */
  sendProvince: string;

  /**
   * Receiver's province code (Viettel Post format)
   * Example: "100" for Hanoi
   */
  receiveProvince: string;

  /**
   * Package weight in grams
   * Must be > 0
   */
  weight: number;

  /**
   * Package width in cm
   */
  width: number;

  /**
   * Package height in cm
   */
  height: number;

  /**
   * Package length in cm
   */
  length: number;

  /**
   * Service type code (standard, express, etc.)
   * Default: VTP (standard)
   */
  serviceId?: string;

  /**
   * Declared value for insurance (VND)
   * Optional — only if customer wants insurance
   */
  declaredValue?: number;

  /**
   * Customer code with Viettel Post
   * Required for customer-specific rates
   */
  customerCode?: string;
}

export interface ShippingRateResponse {
  /**
   * Unique request ID from Viettel API
   */
  requestId: string;

  /**
   * Calculated shipping fee (VND)
   * If rate cannot be calculated, returns 0
   */
  shippingFee: number;

  /**
   * Insurance fee if declaredValue was provided (VND)
   */
  insuranceFee: number;

  /**
   * Total fee = shippingFee + insuranceFee (VND)
   */
  totalFee: number;

  /**
   * Estimated delivery time (days)
   * null if not available
   */
  estimatedDays: number | null;

  /**
   * Service name (Vietnamese)
   * Example: "Nhanh hàng ngày"
   */
  serviceName: string;

  /**
   * API response status code from Viettel
   */
  statusCode: number;

  /**
   * Error message if rate calculation failed
   * Empty string if success
   */
  errorMessage: string;

  /**
   * Timestamp when rate was fetched
   */
  fetchedAt: Date;

  /**
   * Cache TTL in seconds (for client-side caching)
   */
  cacheTtl: number;
}

export interface ViettelApiResponse {
  /**
   * Viettel response status code
   */
  status: number;

  /**
   * Response message
   */
  message: string;

  /**
   * API request ID
   */
  requestId: string;

  /**
   * API response data
   */
  data?: {
    /**
     * Shipping fee from API
     */
    shippingFee?: number;

    /**
     * Insurance fee from API
     */
    insuranceFee?: number;

    /**
     * Estimated delivery days
     */
    estimatedDays?: number;

    /**
     * Service name
     */
    serviceName?: string;
  };
}

/**
 * Cached rate record in Supabase
 * Used for rate limiting + quick lookups
 */
export interface ShippingRateCache {
  id: string;
  sendProvince: string;
  receiveProvince: string;
  weight: number;
  serviceId: string;
  shippingFee: number;
  insuranceFee: number;
  totalFee: number;
  estimatedDays: number | null;
  serviceName: string;
  fetchedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Service error types for proper error handling
 */
export enum ShippingErrorType {
  INVALID_PROVINCE = 'INVALID_PROVINCE',
  INVALID_WEIGHT = 'INVALID_WEIGHT',
  INVALID_DIMENSIONS = 'INVALID_DIMENSIONS',
  API_ERROR = 'API_ERROR',
  RATE_NOT_AVAILABLE = 'RATE_NOT_AVAILABLE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
}

export class ShippingServiceError extends Error {
  constructor(
    public readonly type: ShippingErrorType,
    message: string,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = 'ShippingServiceError';
  }
}
