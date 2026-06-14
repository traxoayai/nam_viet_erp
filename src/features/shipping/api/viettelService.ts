/**
 * Viettel Post Shipping Service
 * Handles shipping rate calculation, API integration, and caching
 *
 * Architecture:
 * 1. Validate request parameters
 * 2. Check cache first (via safeRpc)
 * 3. If cache miss, call calculate_shipping_rate RPC
 * 4. Return result with cache info
 *
 * All database calls use safeRpc() wrapper for error handling
 */

import { safeRpc } from '@/shared/lib/safeRpc';
import {
  ShippingRateRequest,
  ShippingRateResponse,
  ShippingErrorType,
  ShippingServiceError,
} from '../types';
import {
  WEIGHT_BOUNDARIES,
  DIMENSION_BOUNDARIES,
  INSURANCE_CONFIG,
  SUPABASE_RPC_FUNCTIONS,
  DEFAULT_SERVICE_ID,
  CACHE_TTL,
} from '../constants';

/**
 * Validates shipping request parameters
 * Throws ShippingServiceError if validation fails
 */
export function validateShippingRequest(request: ShippingRateRequest): void {
  // Validate weight
  if (request.weight <= 0) {
    throw new ShippingServiceError(
      ShippingErrorType.INVALID_WEIGHT,
      `Weight must be greater than 0g, received ${request.weight}g`,
    );
  }

  if (request.weight < WEIGHT_BOUNDARIES.MIN) {
    throw new ShippingServiceError(
      ShippingErrorType.INVALID_WEIGHT,
      `Weight must be at least ${WEIGHT_BOUNDARIES.MIN}g, received ${request.weight}g`,
    );
  }

  const serviceId = request.serviceId || DEFAULT_SERVICE_ID;
  const maxWeight = serviceId === 'VTX' ? WEIGHT_BOUNDARIES.MAX_EXPRESS : WEIGHT_BOUNDARIES.MAX_STANDARD;

  if (request.weight > maxWeight) {
    throw new ShippingServiceError(
      ShippingErrorType.INVALID_WEIGHT,
      `Weight exceeds maximum ${maxWeight}g for ${serviceId} service, received ${request.weight}g`,
    );
  }

  // Validate dimensions
  const dimensions = [request.width, request.height, request.length];
  for (const dim of dimensions) {
    if (dim < DIMENSION_BOUNDARIES.MIN || dim > DIMENSION_BOUNDARIES.MAX) {
      throw new ShippingServiceError(
        ShippingErrorType.INVALID_DIMENSIONS,
        `Dimension must be between ${DIMENSION_BOUNDARIES.MIN}cm and ${DIMENSION_BOUNDARIES.MAX}cm, received ${dim}cm`,
      );
    }
  }

  // Validate perimeter
  const perimeter = request.length + 2 * request.width + 2 * request.height;
  if (perimeter > DIMENSION_BOUNDARIES.MAX_PERIMETER) {
    throw new ShippingServiceError(
      ShippingErrorType.INVALID_DIMENSIONS,
      `Perimeter exceeds maximum ${DIMENSION_BOUNDARIES.MAX_PERIMETER}cm, received ${perimeter}cm`,
    );
  }

  // Validate declared value if provided
  if (request.declaredValue !== undefined && request.declaredValue > INSURANCE_CONFIG.MAX_VALUE) {
    throw new ShippingServiceError(
      ShippingErrorType.VALIDATION_ERROR,
      `Declared value exceeds maximum ${INSURANCE_CONFIG.MAX_VALUE}VND, received ${request.declaredValue}VND`,
    );
  }
}

/**
 * Calculates insurance fee based on declared value
 * Formula: max(declaredValue * PERCENTAGE, MIN_FEE)
 */
export function calculateInsuranceFee(declaredValue?: number): number {
  if (!declaredValue || declaredValue <= 0) {
    return 0;
  }

  const insuranceFee = Math.max(
    Math.ceil(declaredValue * INSURANCE_CONFIG.PERCENTAGE),
    INSURANCE_CONFIG.MIN_FEE,
  );

  return insuranceFee;
}

/**
 * Fetches shipping rate from Viettel API via Supabase RPC
 * Caches results for configurable TTL (default 1 hour)
 *
 * Flow:
 * 1. Validate request
 * 2. Call calculate_shipping_rate RPC (which checks cache internally)
 * 3. Parse and return response
 *
 * @throws ShippingServiceError on validation failure
 * @returns ShippingRateResponse with rate or error details
 */
export async function getShippingRate(request: ShippingRateRequest): Promise<ShippingRateResponse> {
  try {
    // Validate request
    validateShippingRequest(request);

    // Call RPC function via safeRpc wrapper
    const { data, error } = await safeRpc(
      SUPABASE_RPC_FUNCTIONS.CALCULATE_SHIPPING_RATE,
      {
        p_send_province: request.sendProvince,
        p_receive_province: request.receiveProvince,
        p_weight: request.weight,
        p_service_id: request.serviceId || DEFAULT_SERVICE_ID,
        p_declared_value: request.declaredValue,
        p_customer_code: request.customerCode,
      },
    );

    if (error) {
      throw new ShippingServiceError(
        ShippingErrorType.API_ERROR,
        `Failed to calculate shipping rate: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    // Parse response
    if (!data) {
      return {
        requestId: '',
        shippingFee: 0,
        insuranceFee: 0,
        totalFee: 0,
        estimatedDays: null,
        serviceName: '',
        statusCode: 503,
        errorMessage: 'No response from server',
        fetchedAt: new Date(),
        cacheTtl: 0,
      };
    }

    // Parse JSON response from RPC
    const rpcResponse = typeof data === 'string' ? JSON.parse(data) : data;

    // Map RPC response to ShippingRateResponse
    const response: ShippingRateResponse = {
      requestId: rpcResponse.requestId || rpcResponse.request_id || '',
      shippingFee: rpcResponse.shipping_fee || 0,
      insuranceFee: rpcResponse.insurance_fee || 0,
      totalFee: rpcResponse.total_fee || (rpcResponse.shipping_fee || 0) + (rpcResponse.insurance_fee || 0),
      estimatedDays: rpcResponse.estimated_days || null,
      serviceName: rpcResponse.service_name || '',
      statusCode: rpcResponse.status_code || (rpcResponse.status === 'success' ? 200 : 400),
      errorMessage: rpcResponse.error_message || '',
      fetchedAt: new Date(rpcResponse.fetched_at || Date.now()),
      cacheTtl: rpcResponse.cache_ttl || CACHE_TTL.RATE,
    };

    return response;
  } catch (error) {
    // If validation error, re-throw as-is
    if (error instanceof ShippingServiceError) {
      throw error;
    }

    // Unexpected error — wrap it
    throw new ShippingServiceError(
      ShippingErrorType.API_ERROR,
      `Unexpected error calculating shipping rate: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Gets a cached shipping rate if available
 * Returns null if not found or expired
 */
export async function getCachedRate(
  sendProvince: string,
  receiveProvince: string,
  weight: number,
  serviceId: string = DEFAULT_SERVICE_ID,
): Promise<ShippingRateResponse | null> {
  try {
    const { data, error } = await safeRpc(SUPABASE_RPC_FUNCTIONS.GET_CACHED_SHIPPING_RATE, {
      p_send_province: sendProvince,
      p_receive_province: receiveProvince,
      p_weight: weight,
      p_service_id: serviceId,
    });

    if (error) {
      return null;
    }

    if (!data) {
      return null;
    }

    // Handle array response from RPC
    const cached = Array.isArray(data) ? data[0] : data;
    if (!cached) {
      return null;
    }

    return {
      requestId: cached.id || '',
      shippingFee: cached.shipping_fee || 0,
      insuranceFee: cached.insurance_fee || 0,
      totalFee: cached.total_fee || 0,
      estimatedDays: cached.estimated_days || null,
      serviceName: cached.service_name || '',
      statusCode: 200,
      errorMessage: '',
      fetchedAt: new Date(cached.fetched_at),
      cacheTtl: cached.cache_ttl || CACHE_TTL.RATE,
    };
  } catch {
    // If cache lookup fails, return null (not fatal)
    return null;
  }
}

/**
 * Manually saves a shipping rate to cache
 * Useful for bulk operations or external rate imports
 */
export async function saveCachedRate(
  sendProvince: string,
  receiveProvince: string,
  weight: number,
  serviceId: string,
  shippingFee: number,
  insuranceFee: number,
  estimatedDays: number | null,
  serviceName: string,
): Promise<{ success: boolean; cacheId?: string; error?: string }> {
  try {
    const { data, error } = await safeRpc(SUPABASE_RPC_FUNCTIONS.SAVE_SHIPPING_RATE_CACHE, {
      p_send_province: sendProvince,
      p_receive_province: receiveProvince,
      p_weight: weight,
      p_service_id: serviceId,
      p_shipping_fee: shippingFee,
      p_insurance_fee: insuranceFee,
      p_estimated_days: estimatedDays,
      p_service_name: serviceName,
      p_cache_ttl: CACHE_TTL.RATE,
    });

    if (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    const result = typeof data === 'string' ? JSON.parse(data) : data;

    return {
      success: result?.status === 'success',
      cacheId: result?.cache_id,
      error: result?.message,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Cleans up expired cache entries from database
 * Should be called periodically (e.g., via cron job)
 */
export async function cleanupExpiredCache(): Promise<{ deleted: number; error?: string }> {
  try {
    const { data, error } = await safeRpc(SUPABASE_RPC_FUNCTIONS.CLEANUP_SHIPPING_CACHE);

    if (error) {
      return {
        deleted: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    return {
      deleted: typeof data === 'number' ? data : 0,
    };
  } catch (error) {
    return {
      deleted: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
