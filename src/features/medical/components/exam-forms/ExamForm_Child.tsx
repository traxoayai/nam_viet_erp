
// src/features/medical/components/exam-forms/ExamForm_Child.tsx
import React from 'react';
import { Card, Input, Row, Col, Select } from 'antd';
import { RocketOutlined } from '@ant-design/icons';

interface Props {
  data: any;
  onChange: (key: string, val: string) => void;
  vitals?: any;
  historyData?: any[];
  patientDOB?: string;
}

export const ExamForm_Child: React.FC<Props> = ({ data, onChange }) => {
  return (
    <Card 
        size="small" 
        title={<span className="text-blue-600 font-bold"><RocketOutlined /> Khám NHI (2 - 6 tuổi)</span>}
        className="shadow-sm border-blue-100 bg-blue-50"
    >
        <Row gutter={[12, 12]}>
             <Col span={24}>
                <label className="text-xs text-gray-500">Tình trạng Răng hàm mặt</label>
                <Input 
                    value={data.dental_status} 
                    onChange={e => onChange('dental_status', e.target.value)} 
                    placeholder="Sâu răng, sún răng, mọc răng..."
                />
             </Col>
             <Col span={12}>
                <label className="text-xs text-gray-500">Phát triển Vận động</label>
                <Select 
                    className="w-full"
                    value={data.motor_development}
                    onChange={v => onChange('motor_development', v)}
                    options={[
                        { value: 'normal', label: 'Bình thường' },
                        { value: 'delayed', label: 'Chậm phát triển' },
                        { value: 'hyperactive', label: 'Tăng động' },
                    ]}
                />
             </Col>
             <Col span={12}>
                <label className="text-xs text-gray-500">Phát triển Ngôn ngữ</label>
                <Select 
                    className="w-full"
                    value={data.language_development}
                    onChange={v => onChange('language_development', v)}
                    options={[
                        { value: 'normal', label: 'Bình thường' },
                        { value: 'speech_delay', label: 'Chậm nói' },
                        { value: 'stuttering', label: 'Nói lắp' },
                    ]}
                />
             </Col>
        </Row>
    </Card>
  );
};
