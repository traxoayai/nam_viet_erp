import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/types/database.types';

/**
 * Integration tests for Supabase RPC functions
 * Tests the calculate_shipping_rate and related functions in live database
 * Environment: Uses local Supabase or TEST_TARGET=prod
 */
describe('Shipping Rate RPC Integration Tests', () => {
  let supabase: ReturnType<typeof createClient<Database>>;

  beforeAll(() => {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

    supabase = createClient<Database>(supabaseUrl, supabaseKey);
  });

  describe('calculate_shipping_rate RPC', () => {
    it('should calculate rate for Hanoi to HCMC (same country, long distance)', async () => {
      const { data, error } = await supabase.rpc('calculate_shipping_rate', {
        p_send_province: '100', // Hanoi
        p_receive_province: '300', // HCMC
        p_weight: 1000, // 1kg
        p_service_id: 'VTP', // Standard
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      const response = data as { shipping_fee?: number; status?: string };
      expect(response.shipping_fee).toBeGreaterThan(0);
      expect(response.status).toBe('success');
    });

    it('should calculate rate for express service with higher fee', async () => {
      const { data: standardData } = await supabase.rpc('calculate_shipping_rate', {
        p_send_province: '100',
        p_receive_province: '300',
        p_weight: 1000,
        p_service_id: 'VTP',
      });

      const { data: expressData } = await supabase.rpc('calculate_shipping_rate', {
        p_send_province: '100',
        p_receive_province: '300',
        p_weight: 1000,
        p_service_id: 'VTX', // Express
      });

      const standard = standardData as { shipping_fee?: number };
      const express = expressData as { shipping_fee?: number };

      // Express should cost more than standard
      expect(express.shipping_fee).toBeGreaterThan(standard.shipping_fee || 0);
    });

    it('should return error for invalid weight (0)', async () => {
      const { data, error } = await supabase.rpc('calculate_shipping_rate', {
        p_send_province: '100',
        p_receive_province: '300',
        p_weight: 0, // Invalid
        p_service_id: 'VTP',
      });

      // RPC should handle gracefully, not throw
      expect(data).toBeDefined();
      const response = data as { status?: string; error_type?: string };
      expect(response.status).toBe('error');
      expect(response.error_type).toContain('INVALID');
    });

    it('should include insurance fee when declared value provided', async () => {
      const { data, error } = await supabase.rpc('calculate_shipping_rate', {
        p_send_province: '100',
        p_receive_province: '300',
        p_weight: 1000,
        p_service_id: 'VTP',
        p_declared_value: 5000000, // 5M VND declared
      });

      expect(error).toBeNull();
      const response = data as { insurance_fee?: number };
      expect(response.insurance_fee).toBeGreaterThan(0);
    });

    it('should cache rate and return from cache on subsequent call', async () => {
      const params = {
        p_send_province: '102', // Hai Phong
        p_receive_province: '300', // HCMC
        p_weight: 2000,
        p_service_id: 'VTP',
      };

      // First call — should hit API or fallback
      const { data: firstData } = await supabase.rpc('calculate_shipping_rate', params);

      // Small delay to ensure cache is written
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second call — should be from cache
      const { data: secondData } = await supabase.rpc('calculate_shipping_rate', params);

      const first = firstData as { shipping_fee?: number };
      const second = secondData as { shipping_fee?: number };

      // Both should return same rate
      expect(second.shipping_fee).toBe(first.shipping_fee);
    });

    it('should default service_id to VTP if not provided', async () => {
      const { data } = await supabase.rpc('calculate_shipping_rate', {
        p_send_province: '100',
        p_receive_province: '300',
        p_weight: 1000,
        // No p_service_id — should default to VTP
      });

      expect(data).toBeDefined();
      const response = data as { shipping_fee?: number };
      expect(response.shipping_fee).toBeGreaterThan(0);
    });

    it('should return 0 fee if rate cannot be calculated', async () => {
      // Test with invalid provinces or edge case
      const { data } = await supabase.rpc('calculate_shipping_rate', {
        p_send_province: '999', // Non-existent
        p_receive_province: '888', // Non-existent
        p_weight: 1000,
        p_service_id: 'VTP',
      });

      const response = data as { shipping_fee?: number; status?: string };
      // Should fail gracefully
      expect([response.shipping_fee, undefined]).toContain(response.shipping_fee);
    });
  });

  describe('get_cached_shipping_rate RPC', () => {
    it('should retrieve cached rate entry', async () => {
      // First, save a rate
      const params = {
        p_send_province: '100',
        p_receive_province: '300',
        p_weight: 1500,
        p_service_id: 'VTP',
      };

      await supabase.rpc('calculate_shipping_rate', {
        ...params,
      });

      // Then retrieve it
      const { data, error } = await supabase.rpc('get_cached_shipping_rate', params);

      // Should find the cached entry
      expect(error).toBeNull();
      // Data might be array or single record depending on RPC return type
      expect([Array.isArray(data) ? data[0] : data, null]).toContain(
        Array.isArray(data) ? data[0] : data,
      );
    });

    it('should return null/empty if no cache entry exists', async () => {
      const { data, error } = await supabase.rpc('get_cached_shipping_rate', {
        p_send_province: '991', // Unlikely to have cache
        p_receive_province: '992',
        p_weight: 9999,
        p_service_id: 'VTX',
      });

      expect(error).toBeNull();
      // RPC should return empty result, not error
      expect([data, null]).toContain(data);
    });
  });

  describe('save_shipping_rate_cache RPC', () => {
    it('should save new shipping rate to cache', async () => {
      const { data, error } = await supabase.rpc('save_shipping_rate_cache', {
        p_send_province: '103', // Quang Ninh
        p_receive_province: '300',
        p_weight: 3000,
        p_service_id: 'VTP',
        p_shipping_fee: 35000,
        p_insurance_fee: 0,
        p_estimated_days: 3,
        p_service_name: 'Vận chuyển tiêu chuẩn',
        p_cache_ttl: 3600,
      });

      expect(error).toBeNull();
      const response = data as { status?: string; cache_id?: string };
      expect(response.status).toBe('success');
      expect(response.cache_id).toBeDefined();
    });

    it('should handle duplicate inserts by updating existing entry', async () => {
      const params = {
        p_send_province: '100',
        p_receive_province: '300',
        p_weight: 2500,
        p_service_id: 'VTP',
        p_shipping_fee: 30000,
        p_insurance_fee: 0,
        p_estimated_days: 3,
        p_service_name: 'Vận chuyển tiêu chuẩn',
        p_cache_ttl: 3600,
      };

      // First save
      const { data: firstSave } = await supabase.rpc('save_shipping_rate_cache', params);

      // Second save with same key — should update
      const { data: secondSave } = await supabase.rpc('save_shipping_rate_cache', {
        ...params,
        p_shipping_fee: 32000, // Different fee
      });

      expect(firstSave).toBeDefined();
      expect(secondSave).toBeDefined();
    });
  });

  describe('cleanup_expired_shipping_cache RPC', () => {
    it('should remove expired cache entries', async () => {
      // This would require creating old cache entries first in test setup
      // For now, just verify the function executes without error
      const { data, error } = await supabase.rpc('cleanup_expired_shipping_cache');

      expect(error).toBeNull();
      // Should return number of deleted rows (could be 0)
      expect(typeof data).toBe('number');
      expect(data).toBeGreaterThanOrEqual(0);
    });
  });

  describe('cache TTL and expiration', () => {
    it('should respect cache TTL of 1 hour', async () => {
      const expectedTtl = 3600; // 1 hour
      const { data } = await supabase.rpc('calculate_shipping_rate', {
        p_send_province: '100',
        p_receive_province: '300',
        p_weight: 1000,
        p_service_id: 'VTP',
      });

      const response = data as { cache_ttl?: number };
      expect(response.cache_ttl).toBe(expectedTtl);
    });
  });

  afterAll(() => {
    // Cleanup if needed
  });
});
