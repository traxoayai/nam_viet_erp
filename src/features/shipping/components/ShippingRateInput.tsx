/**
 * ShippingRateInput Component
 * React component for calculating and displaying shipping rates
 *
 * Features:
 * - Real-time rate calculation
 * - Dimension input with validation
 * - Service type selector (Standard, Express, etc.)
 * - Insurance option
 * - Loading and error states
 *
 * Usage:
 * ```tsx
 * <ShippingRateInput
 *   onRateChange={(rate) => console.log(rate)}
 *   defaultProvince="300"
 * />
 * ```
 */

import React, { useState, useCallback } from 'react';
import { useShippingRate, useOptimisticRate } from '../hooks/useShippingRate';
import { ShippingRateRequest, ShippingRateResponse } from '../types';
import { VIETTEL_SERVICE_TYPES } from '../constants';

interface ShippingRateInputProps {
  /**
   * Sender's province code
   * Default: '100' (Hanoi)
   */
  sendProvince?: string;

  /**
   * Receiver's province code
   * Required for calculation
   */
  receiveProvince?: string;

  /**
   * Callback when rate changes
   */
  onRateChange?: (rate: ShippingRateResponse | null) => void;

  /**
   * Callback when error occurs
   */
  onError?: (error: Error) => void;

  /**
   * Show insurance option
   * Default: false
   */
  showInsurance?: boolean;

  /**
   * Disabled state
   */
  disabled?: boolean;

  /**
   * Class name for styling
   */
  className?: string;
}

export const ShippingRateInput: React.FC<ShippingRateInputProps> = ({
  sendProvince = '100',
  receiveProvince,
  onRateChange,
  onError,
  showInsurance = false,
  disabled = false,
  className,
}) => {
  // Form state
  const [weight, setWeight] = useState(1000);
  const [width, setWidth] = useState(15);
  const [height, setHeight] = useState(15);
  const [length, setLength] = useState(15);
  const [serviceId, setServiceId] = useState('VTP');
  const [declaredValue, setDeclaredValue] = useState<number | undefined>();

  // Optimistic rate calculation
  const { estimateRate } = useOptimisticRate();

  // Build request for RPC
  const request: ShippingRateRequest = {
    sendProvince,
    receiveProvince: receiveProvince || sendProvince,
    weight,
    width,
    height,
    length,
    serviceId,
    declaredValue: showInsurance && declaredValue ? declaredValue : undefined,
  };

  // Fetch rate
  const { data: rate, isLoading, error } = useShippingRate(request);

  // Update parent when rate changes
  React.useEffect(() => {
    onRateChange?.(rate || null);
  }, [rate, onRateChange]);

  // Report errors
  React.useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);

  const estimatedRate = estimateRate(weight, serviceId);

  return (
    <div className={className}>
      <div style={{ marginBottom: '16px' }}>
        <label htmlFor="weight" style={{ display: 'block', marginBottom: '4px' }}>
          Trọng lượng (g)
        </label>
        <input
          id="weight"
          type="number"
          min="100"
          max="30000"
          value={weight}
          onChange={e => setWeight(Number(e.target.value))}
          disabled={disabled}
          style={{ width: '100%', padding: '8px' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        <div>
          <label htmlFor="width" style={{ display: 'block', marginBottom: '4px' }}>
            Rộng (cm)
          </label>
          <input
            id="width"
            type="number"
            min="5"
            max="200"
            value={width}
            onChange={e => setWidth(Number(e.target.value))}
            disabled={disabled}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div>
          <label htmlFor="height" style={{ display: 'block', marginBottom: '4px' }}>
            Cao (cm)
          </label>
          <input
            id="height"
            type="number"
            min="5"
            max="200"
            value={height}
            onChange={e => setHeight(Number(e.target.value))}
            disabled={disabled}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div>
          <label htmlFor="length" style={{ display: 'block', marginBottom: '4px' }}>
            Dài (cm)
          </label>
          <input
            id="length"
            type="number"
            min="5"
            max="200"
            value={length}
            onChange={e => setLength(Number(e.target.value))}
            disabled={disabled}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label htmlFor="service" style={{ display: 'block', marginBottom: '4px' }}>
          Loại dịch vụ
        </label>
        <select
          id="service"
          value={serviceId}
          onChange={e => setServiceId(e.target.value)}
          disabled={disabled}
          style={{ width: '100%', padding: '8px' }}
        >
          {Object.entries(VIETTEL_SERVICE_TYPES).map(([key, service]) => (
            <option key={key} value={service.id}>
              {service.label} ({service.estimatedDays} ngày)
            </option>
          ))}
        </select>
      </div>

      {showInsurance && (
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="declared" style={{ display: 'block', marginBottom: '4px' }}>
            Giá trị khai báo (₫) - tùy chọn
          </label>
          <input
            id="declared"
            type="number"
            min="0"
            max="50000000"
            value={declaredValue ?? ''}
            onChange={e => setDeclaredValue(e.target.value ? Number(e.target.value) : undefined)}
            placeholder="Để trống nếu không bảo hiểm"
            disabled={disabled}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
      )}

      {/* Result display */}
      <div
        style={{
          padding: '12px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          border: '1px solid #e0e0e0',
        }}
      >
        {isLoading ? (
          <div>Đang tính phí...</div>
        ) : error ? (
          <div style={{ color: '#d32f2f' }}>Lỗi: {error.message}</div>
        ) : rate ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#666' }}>Phí vận chuyển</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                  {rate.shippingFee.toLocaleString('vi-VN')}₫
                </div>
              </div>
              {rate.insuranceFee > 0 && (
                <div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Phí bảo hiểm</div>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>
                    {rate.insuranceFee.toLocaleString('vi-VN')}₫
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e0e0e0' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Tổng cộng</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1976d2' }}>
                {rate.totalFee.toLocaleString('vi-VN')}₫
              </div>
            </div>
            {rate.estimatedDays && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                Dự kiến: {rate.estimatedDays} ngày
              </div>
            )}
            {rate.cacheTtl > 0 && (
              <div style={{ marginTop: '8px', fontSize: '10px', color: '#999' }}>
                (Tính từ cache)
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: '#999' }}>Nhập thông tin kiện hàng để tính phí</div>
        )}

        {/* Optimistic estimate */}
        {isLoading && (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '12px', color: '#999' }}>
              Ước tính: {estimatedRate.toLocaleString('vi-VN')}₫
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShippingRateInput;
