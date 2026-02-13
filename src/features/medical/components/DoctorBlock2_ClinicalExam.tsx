// src/features/medical/components/DoctorBlock2_ClinicalExam.tsx
import React from 'react';
import { Card, Input } from 'antd';
import { Activity } from 'lucide-react';
import dayjs from 'dayjs';
import { ExamForm_Infant } from './exam-forms/ExamForm_Infant';
import { ExamForm_Child } from './exam-forms/ExamForm_Child';
import { ExamForm_Adolescent } from './exam-forms/ExamForm_Adolescent';
import { ExamForm_Adult } from './exam-forms/ExamForm_Adult';
import { VitalInput } from './VitalInput';
import { SmartScreeningChecklist } from './SmartScreeningChecklist';

interface Props {
  vitals: any;
  setVitals: (v: any) => void;
  clinical: any;
  setClinical: (v: any) => void;
  patient: any;
  readOnly?: boolean;
  isVaccinationFlow?: boolean;
}

export const DoctorBlock2_ClinicalExam: React.FC<Props> = ({ vitals, setVitals, clinical, setClinical, patient, readOnly, isVaccinationFlow = false }) => {
  const age = patient?.dob ? dayjs().diff(dayjs(patient.dob), 'year') : 20; // Default Adult
  
  const handleClinicalChange = (key: string, val: any) => {
      setClinical({ ...clinical, [key]: val });
  };

  const handleVitalChange = (key: string, val: number | null) => {
      setVitals({ ...vitals, [key]: val });
  };

  // Logic render sub-form
  const renderSpecializedForm = () => {
      if (age < 2) return <ExamForm_Infant data={clinical} onChange={handleClinicalChange} />;
      if (age >= 2 && age < 6) return <ExamForm_Child data={clinical} onChange={handleClinicalChange} />;
      if (age >= 6 && age < 18) return <ExamForm_Adolescent data={clinical} onChange={handleClinicalChange} />;
      return <ExamForm_Adult data={clinical} onChange={handleClinicalChange} vitals={vitals} />;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* COT 1: VITALS */}
        <Card title={<span className="flex items-center gap-2"><Activity size={16}/> Chỉ số sinh tồn</span>} size="small" className="md:col-span-1 shadow-sm">
            <div className="grid grid-cols-2 gap-x-2 gap-y-4">
                <VitalInput 
                    label="Mạch" unit="l/p" 
                    value={vitals.pulse} onChange={v => handleVitalChange('pulse', v)} 
                    history={[{date: '2023-01-01', value: 80}]} 
                />
                <VitalInput 
                    label="Nhiệt độ" unit="°C" 
                    value={vitals.temperature} onChange={v => handleVitalChange('temperature', v)} 
                    history={[{date: '2023-01-01', value: 37}]} warningThreshold={{ min: 35, max: 37.5 }}
                />
                <div className="col-span-2 grid grid-cols-2 gap-2">
                    <VitalInput 
                        label="Huyết áp (Sys)" value={vitals.bp_systolic} 
                        onChange={v => handleVitalChange('bp_systolic', v)} 
                        lowerBetter warningThreshold={{ max: 140 }}
                    />
                    <VitalInput 
                        label="Huyết áp (Dia)" value={vitals.bp_diastolic} 
                        onChange={v => handleVitalChange('bp_diastolic', v)} 
                        lowerBetter warningThreshold={{ max: 90 }}
                    />
                </div>
                <VitalInput 
                    label="SpO2" unit="%" 
                    value={vitals.sp02} onChange={v => handleVitalChange('sp02', v)} 
                    warningThreshold={{ min: 95 }}
                />
                <VitalInput 
                    label="Cân nặng" unit="kg" 
                    value={vitals.weight} onChange={v => handleVitalChange('weight', v)} 
                    history={[{date: '2023-01-01', value: 50}]} 
                />
                <VitalInput 
                    label="Chiều cao" unit="cm" 
                    value={vitals.height} onChange={v => handleVitalChange('height', v)} 
                />
            </div>
        </Card>

        {/* COT 2: CLINICAL GENERAL */}
        <Card title="Khám Lâm Sàng" size="small" className="md:col-span-1 shadow-sm h-full">
            <div className="flex flex-col gap-3 h-full">
                <div>
                    <label className="font-bold text-sm">Lý do khám / Triệu chứng cơ năng</label>
                    <Input.TextArea 
                        rows={2} 
                        placeholder="VD: Ho, sốt 3 ngày nay..." 
                        value={clinical.symptoms} 
                        onChange={e => handleClinicalChange('symptoms', e.target.value)}
                        className="mb-2"
                    />
                    
                    {/* NEW: SMART SCREENING CHECKLIST */}
                    {/* [UPDATE]: Truyền isVaccinationFlow xuống Checklist */}
                    <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                        <SmartScreeningChecklist 
                            age={age}
                            clinical={clinical}
                            onChange={handleClinicalChange}
                            isVaccinationFlow={isVaccinationFlow}
                        />
                    </div>
                </div>
                
                <div className="flex-1">
                    <label className="font-bold text-sm">Tóm tắt quá trình bệnh lý & Thực thể</label>
                    <Input.TextArea 
                        className="h-full"
                        style={{ minHeight: '100px' }}
                        placeholder="Mô tả họng đỏ, phổi có ran..."
                        value={clinical.examination_summary} 
                        onChange={e => handleClinicalChange('examination_summary', e.target.value)}
                    />
                </div>
                <div>
                    <label className="font-bold text-sm text-blue-700">Chẩn đoán sơ bộ</label>
                    <Input 
                        className="font-bold"
                        value={clinical.diagnosis} 
                        onChange={e => handleClinicalChange('diagnosis', e.target.value)}
                    />
                </div>
            </div>
        </Card>

        {/* COT 3: SPECIALIZED */}
        <div className="md:col-span-1 h-full">
            {renderSpecializedForm()}
        </div>
    </div>
  );
};
