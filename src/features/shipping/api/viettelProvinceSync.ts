/**
 * Viettel Post Province Sync Service
 * Syncs Viettel Post provinces list to ERP database
 *
 * Flow:
 * 1. Call Viettel API to fetch provinces (or use mock for testing)
 * 2. Transform to {code, name, delivery_time}
 * 3. Call RPC sync_viettel_provinces() → upsert to DB
 * 4. Track sync results + errors
 */

import { safeRpc } from "@/shared/lib/safeRpc";

export interface ViettelProvinceRawData {
  code: string;
  name: string;
  delivery_time: number;
}

export interface ProvinceSyncResult {
  syncedCount: number; // Newly inserted
  updatedCount: number; // Updated existing
  errorCount: number;
  lastSyncedAt: Date;
  success: boolean;
  message?: string;
  error?: string;
}

export class ViettelProvinceSyncError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "ViettelProvinceSyncError";
  }
}

/**
 * Transforms Viettel API response to sync format
 * Handles both camelCase and snake_case response formats
 */
export function transformViettelProvinceData(
  apiData: Array<Record<string, unknown>>
): ViettelProvinceRawData[] {
  return apiData.map((item) => ({
    code: String(item.code || item.province_code || "").trim(),
    name: String(item.name || item.province_name || "").trim(),
    delivery_time: parseInt(
      String(item.delivery_time || item.delivery_time_std || "1"),
      10
    ),
  }));
}

/**
 * Mocks Viettel Post API provinces response
 * Used for testing when API is unavailable
 */
export function getMockViettelProvinces(): ViettelProvinceRawData[] {
  return [
    { code: "100", name: "Hà Nội", delivery_time: 1 },
    { code: "101", name: "Hải Phòng", delivery_time: 2 },
    { code: "102", name: "Bắc Giang", delivery_time: 3 },
    { code: "103", name: "Bắc Kạn", delivery_time: 3 },
    { code: "104", name: "Cao Bằng", delivery_time: 3 },
    { code: "200", name: "TP. Hồ Chí Minh", delivery_time: 1 },
    { code: "201", name: "Bình Dương", delivery_time: 2 },
    { code: "202", name: "Đồng Nai", delivery_time: 2 },
    { code: "203", name: "Bình Thuận", delivery_time: 3 },
    { code: "204", name: "Cần Thơ", delivery_time: 2 },
  ];
}

/**
 * Calls Viettel API to fetch provinces list
 * TODO: Replace with real Viettel API endpoint
 * For now, returns mock data
 */
export async function fetchViettelProvinces(): Promise<
  ViettelProvinceRawData[]
> {
  try {
    // TODO: Call real Viettel API
    // const response = await fetch('https://viettelpost-api.example.com/provinces', {
    //   headers: { 'Authorization': `Bearer ${VIETTEL_API_KEY}` }
    // });
    // const data = await response.json();
    // return transformViettelProvinceData(data.provinces);

    // For now, return mock
    return getMockViettelProvinces();
  } catch (error) {
    throw new ViettelProvinceSyncError(
      `Failed to fetch provinces from Viettel API: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Syncs Viettel Post provinces to ERP database
 * Upserts to provinces table via sync_viettel_provinces RPC
 *
 * @param useMockData - If true, use mock provinces (for testing)
 * @returns Sync results: {syncedCount, updatedCount, errorCount, lastSyncedAt}
 * @throws ViettelProvinceSyncError on sync failure
 */
export async function syncViettelProvinces(
  useMockData = false
): Promise<ProvinceSyncResult> {
  try {
    // 1. Fetch provinces (mock or real)
    const provinces = useMockData
      ? getMockViettelProvinces()
      : await fetchViettelProvinces();

    if (!provinces || provinces.length === 0) {
      return {
        syncedCount: 0,
        updatedCount: 0,
        errorCount: 0,
        lastSyncedAt: new Date(),
        success: false,
        message: "No provinces to sync",
      };
    }

    // 3. Call RPC to sync
    const { data, error } = await safeRpc("sync_viettel_provinces", {
      p_provinces_data: provinces,
    });

    if (error) {
      throw new ViettelProvinceSyncError(
        `RPC sync_viettel_provinces failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }

    // 4. Parse response (RPC returns array with single row)
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) {
      throw new ViettelProvinceSyncError(
        "No response from sync_viettel_provinces RPC"
      );
    }

    return {
      syncedCount: result.synced_count || 0,
      updatedCount: result.updated_count || 0,
      errorCount: result.error_count || 0,
      lastSyncedAt: result.last_synced_at
        ? new Date(result.last_synced_at)
        : new Date(),
      success: true,
      message: `Synced ${(result.synced_count || 0) + (result.updated_count || 0)} provinces`,
    };
  } catch (error) {
    // If already a ViettelProvinceSyncError, re-throw
    if (error instanceof ViettelProvinceSyncError) {
      throw error;
    }

    // Wrap unexpected errors
    throw new ViettelProvinceSyncError(
      `Unexpected error syncing provinces: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Gets a single province by code
 */
export async function getProvinceByCode(code: string) {
  try {
    const { data, error } = await safeRpc("get_province_by_code", {
      p_code: code,
    });

    if (error) {
      return null;
    }

    const result = Array.isArray(data) ? data[0] : data;
    return result || null;
  } catch {
    return null;
  }
}

/**
 * Lists all provinces (for dropdowns, filters)
 */
export async function listProvinces() {
  try {
    const { data, error } = await safeRpc("get_all_provinces");

    if (error) {
      return [];
    }

    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
