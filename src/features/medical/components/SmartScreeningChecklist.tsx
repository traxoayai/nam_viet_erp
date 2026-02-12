// src/features/medical/components/SmartScreeningChecklist.tsx
import React, { useState } from 'react';
import { Card, Tag, Radio, Divider, Collapse, Badge, Alert } from 'antd';
import { ShieldAlert, Syringe } from 'lucide-react';
import { CLINICAL_RED_FLAGS, VACCINATION_SCREENING } from '../constants/clinicalKnowledge';

const { Panel } = Collapse;

interface Props {
  age: number;
  clinical: any;
  onChange: (key: string, value: any) => void;
  isVaccinationFlow?: boolean; // Bật true nếu khách đăng ký dịch vụ tiêm chủng
}

export const SmartScreeningChecklist: React.FC<Props> = ({ age, clinical, onChange, isVaccinationFlow = false }) => {
  
  // Lấy các tag cờ đỏ đã chọn từ state (Lưu dưới dạng mảng các ID)
  const selectedRedFlags: string[] = clinical.red_flags || [];
  
  // State lưu kết quả bảng kiểm tiêm chủng (key: vac_id, value: 'yes' | 'no' | 'unknown')
  const vacScreening: Record<string, string> = clinical.vac_screening || {};

  const toggleRedFlag = (id: string) => {
    const nextSelected = selectedRedFlags.includes(id)
      ? selectedRedFlags.filter(t => t !== id)
      : [...selectedRedFlags, id];
    onChange('red_flags', nextSelected);
  };

  const handleVacScreeningChange = (id: string, value: string) => {
      const nextScreening = { ...vacScreening, [id]: value };
      onChange('vac_screening', nextScreening);
  };

  // Logic kiểm tra điều kiện tiêm chủng
  const vacStatus = () => {
      let hasContraindication = false;
      let hasDelay = false;

      VACCINATION_SCREENING.forEach(q => {
          if (vacScreening[q.id] === 'yes') {
              if (q.actionIfYes.includes('CHỐNG CHỈ ĐỊNH')) hasContraindication = true;
              if (q.actionIfYes.includes('TẠM HOÃN')) hasDelay = true;
          }
      });

      if (hasContraindication) return { status: 'error', text: 'KHÔNG ĐỦ ĐIỀU KIỆN TIÊM (CHỐNG CHỈ ĐỊNH)' };
      if (hasDelay) return { status: 'warning', text: 'TẠM HOÃN TIÊM CHỦNG' };
      
      const answeredCount = Object.keys(vacScreening).length;
      const requiredCount = VACCINATION_SCREENING.filter(q => !q.onlyInfant || age <= 1).length;
      
      if (answeredCount === requiredCount) return { status: 'success', text: 'ĐỦ ĐIỀU KIỆN TIÊM CHỦNG' };
      return { status: 'default', text: 'Chưa hoàn thành bảng kiểm' };
  };

  const vacResult = vacStatus();

  return (
    <Card 
        size="small" 
        className="mb-4 border border-blue-100 shadow-sm"
        bodyStyle={{ padding: '8px 12px' }}
    >
        <Collapse ghost defaultActiveKey={['1', isVaccinationFlow ? '2' : '']}>
            
            {/* --- PANEL 1: KHAÍ THÁC BỆNH LÝ (RED FLAGS) --- */}
            <Panel 
                header={<span className="font-bold text-gray-700 flex items-center gap-2"><ShieldAlert size={16} className="text-red-500"/> Khai thác nhanh dấu hiệu cảnh báo (Red Flags)</span>} 
                key="1"
            >
                {Object.entries(CLINICAL_RED_FLAGS).map(([key, category]) => (
                    <div key={key} className="mb-3">
                        <div className="text-xs text-gray-500 mb-1">{category.title}:</div>
                        <div className="flex flex-wrap gap-2">
                            {category.tags.map(tag => {
                                const isSelected = selectedRedFlags.includes(tag.id);
                                return (
                                    <Tag.CheckableTag
                                        key={tag.id}
                                        checked={isSelected}
                                        onChange={() => toggleRedFlag(tag.id)}
                                        className={`border rounded px-2 py-1 transition-all ${
                                            isSelected 
                                                ? (tag.isDanger ? 'bg-red-500 text-white border-red-500' : 'bg-orange-400 text-white border-orange-400')
                                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                                        }`}
                                    >
                                        {tag.label}
                                    </Tag.CheckableTag>
                                );
                            })}
                        </div>
                    </div>
                ))}
                {selectedRedFlags.length > 0 && (
                     <div className="text-xs italic text-red-500 mt-2">
                         * Lưu ý: Các dấu hiệu màu đỏ cần thận trọng khi kê đơn (Đặc biệt với NSAIDs, Corticoid).
                     </div>
                )}
            </Panel>

            {/* --- PANEL 2: BẢNG KIỂM TIÊM CHỦNG (Chỉ mở khi là dịch vụ tiêm) --- */}
            {isVaccinationFlow && (
                <Panel 
                    header={
                        <div className="flex justify-between w-full pr-4">
                            <span className="font-bold text-purple-700 flex items-center gap-2"><Syringe size={16}/> Bảng kiểm trước Tiêm chủng (BYT)</span>
                            <Badge status={vacResult.status as any} text={<span className="font-bold text-xs">{vacResult.text}</span>} />
                        </div>
                    } 
                    key="2"
                    className="bg-purple-50 rounded"
                >
                    <div className="flex flex-col gap-2">
                        {VACCINATION_SCREENING.map(q => {
                            if (q.onlyInfant && age > 1) return null; // Bỏ qua câu hỏi sơ sinh nếu là người lớn

                            const val = vacScreening[q.id];
                            const isWarning = val === 'yes';

                            return (
                                <div key={q.id} className="flex justify-between items-center bg-white p-2 rounded border border-purple-100">
                                    <div className="flex-1 pr-4">
                                        <div className={`text-sm ${isWarning && q.isCritical ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
                                            {q.question}
                                        </div>
                                        {isWarning && (
                                            <div className="text-xs font-bold text-red-500 mt-1">
                                                Hướng xử trí: {q.actionIfYes}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <Radio.Group 
                                            value={val} 
                                            onChange={e => handleVacScreeningChange(q.id, e.target.value)}
                                            size="small"
                                            buttonStyle="solid"
                                        >
                                            <Radio.Button value="yes" className="hover:text-red-500">Có</Radio.Button>
                                            <Radio.Button value="no">Không</Radio.Button>
                                            <Radio.Button value="unknown">Không rõ</Radio.Button>
                                        </Radio.Group>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    {vacResult.status !== 'default' && vacResult.status !== 'success' && (
                        <Alert 
                            message="CẢNH BÁO AN TOÀN TIÊM CHỦNG" 
                            description={vacResult.text} 
                            type={vacResult.status === 'error' ? 'error' : 'warning'} 
                            showIcon 
                            className="mt-3 font-bold"
                        />
                    )}
                </Panel>
            )}
        </Collapse>
    </Card>
  );
};