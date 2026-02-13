import React from 'react';
import { Card, Tag, Radio, Collapse, Badge } from 'antd';
import { ShieldAlert, Syringe } from 'lucide-react';
import { CLINICAL_RED_FLAGS, VACCINATION_SCREENING } from '../constants/clinicalKnowledge';

interface Props {
  age: number;
  clinical: any;
  onChange: (key: string, value: any) => void;
  isVaccinationFlow?: boolean;
}

export const SmartScreeningChecklist: React.FC<Props> = ({ age, clinical, onChange, isVaccinationFlow = false }) => {
  const selectedRedFlags: string[] = clinical.red_flags || [];
  const vacScreening: Record<string, string> = clinical.vac_screening || {};

  // Debug xem dữ liệu có vào không
  // console.log('Knowledge Data:', CLINICAL_RED_FLAGS); 

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

  const vacResult = (() => {
      let hasContraindication = false;
      let hasDelay = false;
      VACCINATION_SCREENING.forEach(q => {
          if (vacScreening[q.id] === 'yes') {
              if (q.actionIfYes.includes('CHỐNG CHỈ ĐỊNH')) hasContraindication = true;
              if (q.actionIfYes.includes('TẠM HOÃN')) hasDelay = true;
          }
      });
      if (hasContraindication) return { status: 'error', text: 'CHỐNG CHỈ ĐỊNH' };
      if (hasDelay) return { status: 'warning', text: 'TẠM HOÃN' };
      return { status: 'default', text: 'Đang kiểm tra' };
  })();

  const collapseItems = [
    {
      key: '1',
      label: (
        <span className="font-bold text-gray-700 flex items-center gap-2">
          <ShieldAlert size={16} className="text-red-500"/> Sàng lọc nhanh (Red Flags)
        </span>
      ),
      children: (
        <>
            {Object.entries(CLINICAL_RED_FLAGS).map(([key, category]) => (
                <div key={key} className="mb-3 border-b border-dashed border-gray-200 pb-2 last:border-0">
                    <div className="text-xs text-gray-500 mb-1 font-bold uppercase">{category.title}:</div>
                    <div className="flex flex-wrap gap-2">
                        {category.tags.map(tag => {
                            const isSelected = selectedRedFlags.includes(tag.id);
                            return (
                                <Tag.CheckableTag
                                    key={tag.id}
                                    checked={isSelected}
                                    onChange={() => toggleRedFlag(tag.id)}
                                    className={`cursor-pointer border rounded px-2 py-1 transition-all ${
                                        isSelected 
                                            ? (tag.isDanger ? 'bg-red-600 text-white border-red-600' : 'bg-orange-500 text-white border-orange-500')
                                            : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                                    }`}
                                >
                                    {tag.label}
                                </Tag.CheckableTag>
                            );
                        })}
                    </div>
                </div>
            ))}
        </>
      )
    }
  ];

  if (isVaccinationFlow) {
      collapseItems.push({
        key: '2',
        label: (
            <div className="flex justify-between w-full pr-4">
                <span className="font-bold text-purple-700 flex items-center gap-2"><Syringe size={16}/> Tiêm chủng</span>
                <Badge status={vacResult.status as any} text={vacResult.text} />
            </div>
        ),
        children: (
            <div className="flex flex-col gap-2">
                {VACCINATION_SCREENING.map(q => {
                    if (q.onlyInfant && age > 2) return null;
                    const val = vacScreening[q.id];
                    return (
                        <div key={q.id} className="flex justify-between items-center bg-white p-2 rounded border border-gray-200">
                            <div className="text-sm flex-1 mr-2">{q.question}</div>
                            <Radio.Group value={val} onChange={e => handleVacScreeningChange(q.id, e.target.value)} size="small">
                                <Radio.Button value="yes" className="!text-red-500">Có</Radio.Button>
                                <Radio.Button value="no" className="!text-green-600">Không</Radio.Button>
                            </Radio.Group>
                        </div>
                    )
                })}
            </div>
        )
      });
  }

  return (
    <Card 
        size="small" 
        className="mb-4 border border-orange-100 shadow-sm bg-orange-50/30" 
        styles={{ body: { padding: '8px 12px' } }}
    >
        <Collapse ghost defaultActiveKey={['1']} items={collapseItems} />
    </Card>
  );
};