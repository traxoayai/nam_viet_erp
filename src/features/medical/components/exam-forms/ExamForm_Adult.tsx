// src/features/medical/components/exam-forms/ExamForm_Adult.tsx
import React from 'react';
import { Card, Switch, Row, Col } from 'antd';
import { CoffeeOutlined } from '@ant-design/icons';

interface Props {
  data: any;
  onChange: (key: string, val: any) => void;
  vitals?: any; // Để tính BMI
  historyData?: any[];
  patientDOB?: string;
  readOnly?: boolean;
}

export const ExamForm_Adult: React.FC<Props> = ({ data, onChange, vitals, readOnly }) => {
  // BMI Calc
  const bmi = vitals.weight && vitals.height 
    ? (vitals.weight / ((vitals.height / 100) ** 2)).toFixed(1)
    : null;

  let bmiColor = 'text-green-600';
  if (Number(bmi) < 18.5) bmiColor = 'text-yellow-600';
  if (Number(bmi) >= 25) bmiColor = 'text-red-600';

  return (
    <Card 
        size="small" 
        title={<span className="text-gray-700 font-bold"><CoffeeOutlined /> Khám Người Lớn & Lối sống</span>}
        className="shadow-sm border-gray-200 bg-gray-50"
    >
        <Row gutter={[12, 12]}>
             <Col span={24}>
                <div className="p-2 bg-white rounded border border-gray-200 mb-2 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-500">CHỈ SỐ BMI:</span>
                    {bmi ? (
                        <span className={`font-mono text-lg font-bold ${bmiColor}`}>{bmi}</span>
                    ) : <span className="text-gray-400 text-xs">Chưa có chiều cao/cân nặng</span>}
                </div>
             </Col>
             <Col span={12}>
                <div className="flex justify-between items-center">
                    <label className="text-sm">Hút thuốc lá</label>
                    <Switch 
                        checked={data.lifestyle_smoking}
                        onChange={v => onChange('lifestyle_smoking', v)}
                        disabled={readOnly}
                    />
                </div>
             </Col>
             <Col span={12}>
                <div className="flex justify-between items-center">
                    <label className="text-sm">Uống rượu bia</label>
                    <Switch 
                        checked={data.lifestyle_alcohol}
                        onChange={v => onChange('lifestyle_alcohol', v)}
                        disabled={readOnly}
                    />
                </div>
             </Col>
        </Row>
    </Card>
  );
};
