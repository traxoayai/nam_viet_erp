// src/features/inventory/components/LocationInput.tsx
import React, { useState, useEffect } from 'react';
import { Input } from 'antd';
import { CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';

interface LocationInputProps {
  productId: number;
  warehouseId?: number; // Make optional if not used strictly here yet
  initialLocation: {
    cabinet?: string;
    row?: string;
    slot?: string;
  };
  onSave: (productId: number, location: { cabinet: string; row: string; slot: string }) => Promise<void>;
}

export const LocationInput: React.FC<LocationInputProps> = ({ productId, initialLocation, onSave }) => {
  const [cabinet, setCabinet] = useState(initialLocation.cabinet || '');
  const [row, setRow] = useState(initialLocation.row || '');
  const [slot, setSlot] = useState(initialLocation.slot || '');
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Sync with props if they change externally
  useEffect(() => {
    setCabinet(initialLocation.cabinet || '');
    setRow(initialLocation.row || '');
    setSlot(initialLocation.slot || '');
  }, [initialLocation.cabinet, initialLocation.row, initialLocation.slot]);

  const handleSave = async () => {
    // Only save if there's a change (simple check, or rely on parent logic)
    // Here we just trigger save on blur/enter
    if (loading) return;

    setLoading(true);
    setSuccess(false);
    try {
      await onSave(productId, { cabinet, row, slot });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000); // Hide success icon after 2s
    } catch (error) {
      // message handled by parent or global error handler usually, but we can show visual cue
      console.error("Failed to save location", error);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
      // Optional: Focus next input logic could go here if needed
    }
  };

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <Input
        placeholder="Tủ"
        value={cabinet}
        onChange={e => setCabinet(e.target.value)}
        onBlur={handleSave}
        onKeyDown={onKeyDown}
        style={{ width: 50, padding: '4px 8px', textAlign: 'center' }}
      />
      <span style={{color: '#ccc'}}>-</span>
      <Input
        placeholder="Tầng"
        value={row}
        onChange={e => setRow(e.target.value)}
        onBlur={handleSave}
        onKeyDown={onKeyDown}
        style={{ width: 50, padding: '4px 8px', textAlign: 'center' }}
      />
      <span style={{color: '#ccc'}}>-</span>
      <Input
        placeholder="Ô"
        value={slot}
        onChange={e => setSlot(e.target.value)}
        onBlur={handleSave}
        onKeyDown={onKeyDown}
        style={{ width: 50, padding: '4px 8px', textAlign: 'center' }}
      />

      {/* Status Icons */}
      <div style={{ width: 20, display: 'flex', justifyContent: 'center' }}>
        {loading && <LoadingOutlined style={{ color: '#1890ff' }} />}
        {!loading && success && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
      </div>
    </div>
  );
};
