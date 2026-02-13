// src/pages/medical/DoctorPage.tsx
import { useMemo, useState } from 'react';
import { Layout, Spin, Row, Col, Card, Input, Badge, message, Button, Modal, Popover, DatePicker } from 'antd';
import { useDoctorWorkbench } from '@/features/medical/hooks/useDoctorWorkbench';
import dayjs from 'dayjs';
import { FlaskConical, Globe, Activity, Stethoscope, BrainCircuit, Printer as PrinterIcon } from 'lucide-react';
import { CheckCircleOutlined, PrinterOutlined, CalendarOutlined } from '@ant-design/icons';

// Blocks
import { DoctorBlock1_PatientInfo } from '@/features/medical/components/DoctorBlock1_PatientInfo';
import { DoctorBlock3_ServiceOrder } from '@/features/medical/components/DoctorBlock3_ServiceOrder';
import { DoctorBlock4_Prescription } from '@/features/medical/components/DoctorBlock4_Prescription';
import { DoctorBlock5_Actions } from '@/features/medical/components/DoctorBlock5_Actions';
import { SmartClinicalAssistant } from '@/features/medical/components/SmartClinicalAssistant';
import { VitalInput } from '@/features/medical/components/VitalInput';
import { SmartAdviceTags } from '@/features/medical/components/SmartAdviceTags';
import { ParaclinicalResultsDrawer } from '@/features/medical/components/ParaclinicalResultsDrawer';
import { SmartScreeningChecklist } from '@/features/medical/components/SmartScreeningChecklist';
import { PatientHistoryDrawer } from '@/features/medical/components/PatientHistoryDrawer'; 
import { usePatientHistory } from '@/features/medical/hooks/usePatientHistory';

// Hooks
import { useRealtimeLabResults } from '@/features/medical/hooks/useRealtimeLabResults';
import { supabase } from '@/shared/lib/supabaseClient';

// Exam Forms
import { ExamForm_Infant } from '@/features/medical/components/exam-forms/ExamForm_Infant';
import { ExamForm_Child } from '@/features/medical/components/exam-forms/ExamForm_Child';
import { ExamForm_Adolescent } from '@/features/medical/components/exam-forms/ExamForm_Adolescent';
import { ExamForm_Adult } from '@/features/medical/components/exam-forms/ExamForm_Adult';

const { Content } = Layout;
const { TextArea } = Input;

const DoctorPage = () => {
    const { 
        loading, 
        patientInfo, 
        visit, 
        vitals, setVitals, 
        clinical, setClinical,
        prescriptionItems, setPrescriptionItems,
        handleSave,
        handlePrint,
        handleScheduleFollowUp,
        medicalVisitId,
        isReadOnly
    } = useDoctorWorkbench();
    
    // History Hook for "Copy Prescription"
    const { onCopyPrescription } = usePatientHistory(patientInfo?.id);

    const handleCopyPrescription = (oldPrescription: any[]) => {
        if (isReadOnly) return message.warning("Phiếu đã hoàn thành, không thể sửa!");
        // Gọi logic copy từ hook usePatientHistory
        onCopyPrescription(oldPrescription, prescriptionItems, setPrescriptionItems);
    };

    // Local state for Lab Results
    const [openLabDrawer, setOpenLabDrawer] = useState(false);
    const [labResults, setLabResults] = useState<any[]>([]);
    const [imagingResults, setImagingResults] = useState('');

    // Fetch Lab Results
    const fetchLabResults = async () => {
        if (!medicalVisitId) return;
        
        try {
            const { data } = await supabase
                .from('clinical_service_requests')
                .select('*')
                .eq('medical_visit_id', medicalVisitId)
                .eq('status', 'completed');

            if (data) {
                const mappedTests = data.filter(d => d.category === 'lab').flatMap(d => {
                     return d.results_json ? (d.results_json as any).tests : [];
                });
                
                const imgRes = data.filter(d => d.category === 'imaging').map(d => d.imaging_result).join('\n\n');
                
                setLabResults(mappedTests);
                setImagingResults(imgRes);
                setOpenLabDrawer(true);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Realtime Listener
    useRealtimeLabResults({
        visitId: medicalVisitId || null, 
        onResultReceived: fetchLabResults
    });

    // 1. Calculate Age & Form Type
    const patientAge = useMemo(() => {
        if (!patientInfo?.dob) return 0;
        return dayjs().diff(patientInfo.dob, 'year');
    }, [patientInfo?.dob]);

    const ExamFormComponent = useMemo(() => {
        if (patientAge < 2) return ExamForm_Infant;
        if (patientAge < 12) return ExamForm_Child;
        if (patientAge < 18) return ExamForm_Adolescent;
        return ExamForm_Adult;
    }, [patientAge]);

    // 2. Smart Vitals Logic
    const bmi = useMemo(() => {
        if (!vitals.weight || !vitals.height) return null;
        const h = vitals.height / 100; // cm -> m
        return (vitals.weight / (h * h)).toFixed(1);
    }, [vitals.weight, vitals.height]);

    const isHighBP = useMemo(() => {
        return (vitals.bp_systolic || 0) > 140 || (vitals.bp_diastolic || 0) > 90;
    }, [vitals.bp_systolic, vitals.bp_diastolic]);
    
    // Handlers
    const handleSuggestionClick = (suggestion: string, type: 'test' | 'prescription' | 'diagnosis') => {
        if (isReadOnly) return;
        message.info(`Đã thêm ${suggestion} vào ${type}`);
        if (type === 'diagnosis') {
            setClinical(prev => ({ ...prev, diagnosis: suggestion }));
        }
    };

    const handleVitalChange = (key: string, val: number | null) => {
        if (isReadOnly) return;
        setVitals((prev: any) => ({ ...prev, [key]: val }));
    };

    const handleClinicalChange = (key: string, val: any) => {
        if (isReadOnly) return;
        setClinical((prev: any) => ({ ...prev, [key]: val }));
    };

    if (loading && !patientInfo) {
        return <div className="h-screen flex items-center justify-center"><Spin size="large" tip="Đang tải dữ liệu..." /></div>
    }

    return (
        <Layout className="min-h-screen bg-gray-50">
            <Content className="w-full p-4">
                
                {/* ROW 1: HEADER (Sticky) */}
                <div className="sticky top-0 z-50 mb-4 flex justify-between items-start gap-4">
                    <div className="flex-1">
                        <DoctorBlock1_PatientInfo 
                            patient={patientInfo} 
                            visitId={medicalVisitId} // Changed from visitId to passing logic? Check component prop.
                            onCopyPrescription={handleCopyPrescription}
                        />
                    </div>
                    {/* LAB RESULTS BUTTON */}
                    <Button 
                        type="primary" 
                        danger 
                        icon={<FlaskConical size={16} />}
                        onClick={() => {
                            fetchLabResults();
                            setOpenLabDrawer(true);
                        }}
                        className="shadow-md animate-pulse"
                    >
                        Xem KQ Xét Nghiệm
                    </Button>
                </div>
                
                {/* 1.5 SMART ASSISTANT */}
                <SmartClinicalAssistant 
                    vitals={vitals} 
                    clinical={clinical} 
                    patientInfo={patientInfo} 
                    age={patientAge} 
                    onSuggestionClick={handleSuggestionClick}
                />

                {/* ROW 2: CLINICAL CONTEXT */}
                <Row gutter={16} className="mb-4">
                    {/* Col 1: Epidemiology (Readonly) */}
                    <Col span={6}>
                        <Card size="small" title={<span className="flex items-center gap-2"><Globe size={16}/> Dịch tễ & Tiền sử</span>} className="h-full border border-gray-200 shadow-sm bg-white rounded-lg">
                            <div className="flex flex-col gap-2">
                                <div className="text-xs text-gray-500 mb-1">Tiền sử bệnh:</div>
                                <div className="font-medium text-sm mb-2">{patientInfo?.medical_history || 'Không'}</div>
                                
                                <div className="text-xs text-gray-500 mb-1">Dị ứng thuốc:</div>
                                <div className="font-bold text-red-600 text-sm mb-2">{patientInfo?.allergies || 'Không'}</div>

                                <div className="flex justify-between border-t pt-2 mt-2">
                                    <span className="text-gray-500 text-xs">Hút thuốc:</span>
                                    <span className="font-medium text-sm">{clinical.lifestyle_smoking ? 'Có' : 'Không'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 text-xs">Rượu bia:</span>
                                    <span className="font-medium text-sm">{clinical.lifestyle_alcohol ? 'Có' : 'Không'}</span>
                                </div>
                            </div>
                        </Card>
                    </Col>

                    {/* Col 2: Smart Vitals */}
                    <Col span={10}>
                        <Card 
                            size="small" 
                            title={
                                <div className="flex justify-between items-center">
                                    <span className="flex items-center gap-2"><Activity size={16}/> Chỉ số sinh tồn</span>
                                    {bmi && <span className={Number(bmi) > 23 ? "text-red-500 font-bold" : "text-green-600"}>BMI: {bmi}</span>}
                                    {isHighBP && <Badge count="Huyết áp cao" color="red" />}
                                </div>
                            } 
                            className="h-full border border-gray-200 shadow-sm bg-white rounded-lg"
                        >
                           <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                <VitalInput 
                                    label="Mạch" unit="l/p" 
                                    value={vitals.pulse} onChange={v => handleVitalChange('pulse', v)} 
                                    history={[{date: '2023-01-01', value: 80}]} 
                                    disabled={isReadOnly}
                                />
                                <VitalInput 
                                    label="Nhiệt độ" unit="°C" 
                                    value={vitals.temperature} onChange={v => handleVitalChange('temperature', v)} 
                                    warningThreshold={{ min: 35, max: 37.5 }}
                                    disabled={isReadOnly}
                                />
                                <VitalInput 
                                    label="SpO2" unit="%" 
                                    value={vitals.sp02} onChange={v => handleVitalChange('sp02', v)} 
                                    warningThreshold={{ min: 95 }}
                                    disabled={isReadOnly}
                                />
                                <VitalInput 
                                    label="Cân nặng" unit="kg" 
                                    value={vitals.weight} onChange={v => handleVitalChange('weight', v)}
                                    disabled={isReadOnly}
                                />
                                <VitalInput 
                                    label="Chiều cao" unit="cm" 
                                    value={vitals.height} onChange={v => handleVitalChange('height', v)}
                                    disabled={isReadOnly}
                                />
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <VitalInput 
                                            label="HA (Sys)" value={vitals.bp_systolic} 
                                            onChange={v => handleVitalChange('bp_systolic', v)} 
                                            lowerBetter warningThreshold={{ max: 130 }}
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <VitalInput 
                                            label="HA (Dia)" value={vitals.bp_diastolic} 
                                            onChange={v => handleVitalChange('bp_diastolic', v)} 
                                            lowerBetter warningThreshold={{ max: 85 }}
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                </div>
                           </div>
                        </Card>
                    </Col>

                    {/* Col 3: Symptoms */}
                    <Col span={8}>
                        <Card size="small" title={<span className="flex items-center gap-2"><Stethoscope size={16}/> Triệu chứng cơ năng</span>} className="h-full border border-gray-200 shadow-sm bg-white rounded-lg">
                            <TextArea 
                                value={clinical.symptoms} 
                                onChange={e => handleClinicalChange('symptoms', e.target.value)}
                                placeholder="Mô tả triệu chứng cơ năng..."
                                autoSize={{ minRows: 3, maxRows: 5 }}
                                disabled={isReadOnly}
                            />
                            
                            <div className={isReadOnly ? 'pointer-events-none opacity-60' : ''}>
                            <SmartScreeningChecklist 
                                age={patientAge}
                                clinical={clinical}
                                onChange={handleClinicalChange}
                                isVaccinationFlow={patientAge < 6}
                            />
                            </div>
                        </Card>
                    </Col>
                </Row>

                {/* ROW 3: DEEP EXAM (Dynamic) */}
                <div className="mb-4">
                    <ExamFormComponent 
                        data={clinical} 
                        onChange={handleClinicalChange}
                        vitals={vitals}
                        patientDOB={patientInfo?.dob}
                        readOnly={isReadOnly}
                    />
                </div>

                {/* ROW 4: INDICATION & CONCLUSION */}
                <Row gutter={16} className="mb-16">
                    {/* Part A: Service Order */}
                    <Col span={8} className="flex flex-col gap-4">
                         <DoctorBlock3_ServiceOrder readOnly={isReadOnly} />
                    </Col>

                    {/* Part B: Prescription & Conclusion */}
                    <Col span={16} className="flex flex-col gap-4">
                         <Card title={<span className="flex items-center gap-2"><BrainCircuit size={16}/> Chẩn đoán & Lời dặn</span>} size="small" className="border border-gray-200 shadow-sm bg-white rounded-lg">
                            <div className="flex flex-col gap-4">
                                <div>
                                    <div className="text-xs text-blue-600 font-bold mb-1">CHẨN ĐOÁN XÁC ĐỊNH</div>
                                    <Input 
                                        size="large"
                                        className="font-bold text-blue-900" 
                                        value={clinical.diagnosis}
                                        onChange={e => handleClinicalChange('diagnosis', e.target.value)}
                                        placeholder="Nhập chẩn đoán..."
                                        disabled={isReadOnly}
                                    />
                                </div>
                                
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">LỜI DẶN CỦA BÁC SĨ</div>
                                    <TextArea 
                                        placeholder="Lời dặn bác sĩ / Kết luận điều trị..."
                                        value={clinical.doctor_notes}
                                        onChange={e => handleClinicalChange('doctor_notes', e.target.value)}
                                        rows={4}
                                        disabled={isReadOnly}
                                    />
                                    
                                    {!isReadOnly && (
                                        <SmartAdviceTags 
                                            diagnosis={clinical.diagnosis} 
                                            currentNotes={clinical.doctor_notes}
                                            onAddNote={(newNote) => handleClinicalChange('doctor_notes', newNote)}
                                        />
                                    )}
                                </div>
                            </div>
                         </Card>

                         <DoctorBlock4_Prescription 
                            items={prescriptionItems}
                            setItems={setPrescriptionItems}
                            patientAllergies={patientInfo?.allergies}
                            readOnly={isReadOnly}
                         />
                    </Col>
                </Row>

                {/* ACTION BAR (Sticky Bottom) */}
                {!isReadOnly ? (
                    <DoctorBlock5_Actions 
                        onSave={handleSave} 
                        onPrint={handlePrint}
                        onScheduleFollowUp={handleScheduleFollowUp}
                        loading={loading}
                    />
                ) : (
                     <div className="bg-white p-4 border-t border-gray-200 mt-4 flex justify-between items-center sticky bottom-0 z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                        <div className="flex gap-2">
                             <div className="text-green-600 font-bold flex items-center px-4 bg-green-50 rounded border border-green-200">
                                 <CheckCircleOutlined className="mr-2"/> ĐÃ HOÀN THÀNH
                             </div>
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                icon={<PrinterOutlined />} 
                                onClick={handlePrint}
                                className="border-blue-500 text-blue-600 hover:text-blue-700 hover:border-blue-600"
                            >
                                In Phiếu & Đơn Thuốc
                            </Button>
                            <Popover
                                title="Chọn ngày tái khám"
                                trigger="click"
                                content={(
                                    <div className="flex gap-2">
                                        <DatePicker onChange={(d) => d && handleScheduleFollowUp(d.toISOString())} />
                                    </div>
                                )}
                            >
                                 <Button icon={<CalendarOutlined />}>Hẹn Tái Khám</Button>
                            </Popover>
                        </div>
                    </div>
                )}
                
                {/* REALTIME LAB DRAWER */}
                <ParaclinicalResultsDrawer 
                    open={openLabDrawer}
                    onClose={() => setOpenLabDrawer(false)}
                    patientName={patientInfo?.name || 'Bệnh nhân'}
                    bloodTests={labResults}
                    imagingResults={imagingResults}
                />
            </Content>
        </Layout>
    );
};
export default DoctorPage;
