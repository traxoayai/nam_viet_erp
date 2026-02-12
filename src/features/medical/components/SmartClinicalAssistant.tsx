// src/features/medical/components/SmartClinicalAssistant.tsx
import React, { useMemo } from 'react';
import { Alert, Button } from 'antd';
import { WarningOutlined, InfoCircleOutlined } from '@ant-design/icons';

interface Props {
  vitals: any;
  clinical: any;
  patientInfo: any;
  age: number;
  onSuggestionClick: (suggestion: string, type: 'test' | 'prescription' | 'diagnosis') => void;
}

export const SmartClinicalAssistant: React.FC<Props> = ({ vitals, clinical, age, onSuggestionClick }) => {
  
  // 1. SUY LUẬN TỪ SINH HIỆU (Vital Signs Logic)
  const vitalAlerts = useMemo(() => {
    const alerts = [];
    
    // Sốt
    if (vitals.temperature >= 38.5) {
      alerts.push({
        type: 'warning',
        msg: 'Sốt cao (>= 38.5°C)',
        action: 'Kê Paracetamol',
        value: 'Paracetamol',
        category: 'prescription' as const
      });
    }

    // Huyết áp (Người lớn)
    if (age > 18 && vitals.bp_systolic >= 140) {
      alerts.push({
        type: 'error',
        msg: `Huyết áp cao (${vitals.bp_systolic} mmHg)`,
        action: 'Chỉ định ECG & Siêu âm tim',
        value: 'Điện tâm đồ (ECG)',
        category: 'test' as const
      });
    }

    // SpO2
    if (vitals.sp02 && vitals.sp02 < 95) {
      alerts.push({
        type: 'error',
        msg: `SpO2 thấp (${vitals.sp02}%)`,
        action: 'Cần hỗ trợ oxy / X-Quang Phổi',
        value: 'X-Quang ngực thẳng',
        category: 'test' as const
      });
    }
    
    return alerts;
  }, [vitals, age]);

  // 2. SUY LUẬN TỪ TRIỆU CHỨNG (Symptom Analysis)
  const symptomSuggestions = useMemo(() => {
    const s = clinical.symptoms?.toLowerCase() || '';
    const suggestions = [];

    if (s.includes('ho') && s.includes('đờm')) {
        suggestions.push({ label: 'Chẩn đoán: Viêm phế quản?', val: 'Viêm phế quản cấp' });
    }
    if (s.includes('đau họng') && s.includes('sốt')) {
        suggestions.push({ label: 'Test cúm A/B?', val: 'Test nhanh Cúm A/B' });
    }
    
    return suggestions;
  }, [clinical.symptoms]);

  if (vitalAlerts.length === 0 && symptomSuggestions.length === 0) return null;

  return (
    <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-md animate-pulse-once">
      <div className="flex items-center gap-2 mb-2 font-bold text-orange-800">
        <WarningOutlined /> TRỢ LÝ Y KHOA PHÁT HIỆN:
      </div>
      
      <div className="flex flex-col gap-2">
        {vitalAlerts.map((alert, idx) => (
          <Alert
            key={idx}
            type={alert.type as any}
            message={
              <div className="flex justify-between items-center w-full">
                <span>{alert.msg}</span>
                <Button 
                    size="small" 
                    type="primary" 
                    danger={alert.type === 'error'}
                    ghost
                    onClick={() => onSuggestionClick(alert.value, alert.category)}
                >
                  {alert.action}
                </Button>
              </div>
            }
            showIcon
          />
        ))}

        {symptomSuggestions.length > 0 && (
            <div className="flex gap-2 items-center text-sm text-gray-600 mt-1">
                <InfoCircleOutlined /> Gợi ý lâm sàng: 
                {symptomSuggestions.map((s, i) => (
                     <Button key={i} size="small" type="dashed" onClick={() => onSuggestionClick(s.val, 'diagnosis')}>
                        {s.label}
                     </Button>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};