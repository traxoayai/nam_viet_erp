// src/features/medical/components/exam-forms/ExamForm_Adolescent.tsx
import React from 'react';
import { Card, Input, Row, Col, Select } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';

interface Props {
  data: any;
  onChange: (key: string, val: string) => void;
  vitals?: any;
  historyData?: any[];
  patientDOB?: string;
  readOnly?: boolean;
}

export const ExamForm_Adolescent: React.FC<Props> = ({ data, onChange, readOnly }) => {
  return (
    <Card 
        size="small" 
        title={<span className="text-purple-600 font-bold"><ThunderboltOutlined /> Khám Thiếu Niên (6 - 18 tuổi)</span>}
        className="shadow-sm border-purple-100 bg-purple-50"
    >
        <Row gutter={[12, 12]}>
             <Col span={12}>
                <label className="text-xs text-gray-500">Giai đoạn dậy thì (Tanner)</label>
                <Select 
                    className="w-full"
                    value={data.puberty_stage}
                    onChange={v => onChange('puberty_stage', v)}
                    options={[
                        { value: 'pre_puberty', label: 'Chưa dậy thì' },
                        { value: 'onset', label: 'Bắt đầu dậy thì' },
                        { value: 'completed', label: 'Hoàn thiện' },
                    ]}
                    disabled={readOnly}
                />
             </Col>
             <Col span={12}>
                <label className="text-xs text-gray-500">Cột sống (Cong vẹo)</label>
                <Select 
                    className="w-full"
                    value={data.scoliosis_status}
                    onChange={v => onChange('scoliosis_status', v)}
                    options={[
                        { value: 'normal', label: 'Bình thường' },
                        { value: 'scoliosis', label: 'Cong vẹo' },
                        { value: 'kyphosis', label: 'Gù' },
                    ]}
                    disabled={readOnly}
                />
             </Col>
             <Col span={24}>
                <label className="text-xs text-gray-500">Thị lực (Mắt Trái / Mắt Phải)</label>
                <div className="flex gap-2">
                    <Input 
                        placeholder="MP (10/10)"
                        value={data.visual_acuity_right} 
                        onChange={e => onChange('visual_acuity_right', e.target.value)} 
                        disabled={readOnly}
                    />
                     <Input 
                        placeholder="MT (10/10)"
                        value={data.visual_acuity_left} 
                        onChange={e => onChange('visual_acuity_left', e.target.value)} 
                        disabled={readOnly}
                    />
                </div>
             </Col>
        </Row>
    </Card>
  );
};
