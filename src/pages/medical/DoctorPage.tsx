// src/pages/medical/DoctorPage.tsx
import { useMemo, useState } from 'react';
import { Layout, Spin, Row, Col, Card, Input, Badge, message, Button } from 'antd';
import { useDoctorWorkbench } from '@/features/medical/hooks/useDoctorWorkbench';
import dayjs from 'dayjs';
import { FlaskConical } from 'lucide-react';

// Blocks
import { DoctorBlock1_PatientInfo } from '@/features/medical/components/DoctorBlock1_PatientInfo';
import { DoctorBlock3_ServiceOrder } from '@/features/medical/components/DoctorBlock3_ServiceOrder';
import { DoctorBlock4_Prescription } from '@/features/medical/components/DoctorBlock4_Prescription';
import { DoctorBlock5_Actions } from '@/features/medical/components/DoctorBlock5_Actions';
import { SmartClinicalAssistant } from '@/features/medical/components/SmartClinicalAssistant';
import { VitalInput } from '@/features/medical/components/VitalInput';
import { SmartAdviceTags } from '@/features/medical/components/SmartAdviceTags';
import { ParaclinicalResultsDrawer } from '@/features/medical/components/ParaclinicalResultsDrawer';

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
        vitals, setVitals, 
        clinical, setClinical,
        prescriptionItems, setPrescriptionItems,
        handleSave,
        handlePrint,
        handleScheduleFollowUp,
        medicalVisitId // Need this from hook if available, otherwise assume we have logic to get it or pass it
    } = useDoctorWorkbench();
    
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
                // Map results for simple display (Mock logic for now as structure varies)
                // Assuming result_json has standard structure or we parse it
                const mappedTests = data.filter(d => d.category === 'lab').flatMap(d => {
                     // Mock parsing logic - in real app parse d.results_json
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
    
    // Handler cho Smart Assistant
    const handleSuggestionClick = (suggestion: string, type: 'test' | 'prescription' | 'diagnosis') => {
        message.info(`Đã thêm ${suggestion} vào ${type}`);
        // Logic thực tế sẽ add vào list chỉ định hoặc đơn thuốc
        if (type === 'diagnosis') {
            setClinical(prev => ({ ...prev, diagnosis: suggestion }));
        }
    };

    // [NEW LOGIC]: Xử lý khi bấm nút "Tái kê đơn"
    const handleCopyPrescription = (oldItems: any[]) => {
        // Map lại để xóa ID cũ (tạo ID mới khi lưu)
        const newItems = oldItems.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            product_unit_id: item.product_unit_id || 1, // Fallback nếu thiếu
            unit_name: item.unit_name,
            quantity: item.quantity,
            usage_note: item.usage_note || '',
            stock_quantity: 999 // Tạm thời bypass check tồn kho hoặc cần check lại API
        }));
        
        // Gộp vào danh sách hiện tại (hoặc thay thế tùy ý, ở đây là Append)
        setPrescriptionItems([...prescriptionItems, ...newItems]);
        message.success(`Đã thêm ${newItems.length} thuốc vào đơn hiện tại.`);
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

                {/* ROW 2: CLINICAL CONTEXT (3 Columns) */}
                <Row gutter={16} className="mb-4">
                    {/* Col 1: Epidemiology (Readonly) */}
                    <Col span={6}>
                        <Card size="small" title="Dịch tễ & Cơ địa" className="h-full border border-gray-200 shadow-sm bg-white rounded-lg">
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Tiền sử:</span>
                                    <span className="font-medium">{patientInfo?.medical_history || 'Không'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Dị ứng:</span>
                                    <span className="font-medium text-red-500">{patientInfo?.allergies || 'Không'}</span>
                                </div>
                                <div className="flex justify-between mt-2 pt-2 border-t">
                                    <span className="text-gray-500">Hút thuốc:</span>
                                    <span className="font-medium">{clinical.lifestyle_smoking ? 'Có' : 'Không'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Rượu bia:</span>
                                    <span className="font-medium">{clinical.lifestyle_alcohol ? 'Có' : 'Không'}</span>
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
                                    <span>Sinh hiệu</span>
                                    {bmi && <span className={Number(bmi) > 23 ? "text-red-500 font-bold" : "text-green-600"}>BMI: {bmi}</span>}
                                    {isHighBP && <Badge count="Huyết áp cao" color="red" />}
                                </div>
                            } 
                            className="h-full border border-gray-200 shadow-sm bg-white rounded-lg"
                        >
                           <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                <VitalInput 
                                    label="Mạch" 
                                    unit="l/p" 
                                    value={vitals.pulse} 
                                    onChange={v => setVitals({...vitals, pulse: v})} 
                                    history={[{date: '2023-01-01', value: 80}]} 
                                />
                                <VitalInput 
                                    label="Nhiệt độ" 
                                    unit="°C" 
                                    value={vitals.temperature} 
                                    onChange={v => setVitals({...vitals, temperature: v})} 
                                    history={[{date: '2023-01-01', value: 37}]} 
                                    warningThreshold={{ min: 35, max: 37.5 }}
                                />
                                <VitalInput 
                                    label="SpO2" 
                                    unit="%" 
                                    value={vitals.sp02} 
                                    onChange={v => setVitals({...vitals, sp02: v})} 
                                    warningThreshold={{ min: 95 }}
                                />
                                <VitalInput 
                                    label="Cân nặng" 
                                    unit="kg" 
                                    value={vitals.weight} 
                                    onChange={v => setVitals({...vitals, weight: v})} 
                                />
                                <VitalInput 
                                    label="Chiều cao" 
                                    unit="cm" 
                                    value={vitals.height} 
                                    onChange={v => setVitals({...vitals, height: v})} 
                                />
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <VitalInput 
                                            label="HA (Sys)" 
                                            value={vitals.bp_systolic} 
                                            onChange={v => setVitals({...vitals, bp_systolic: v})} 
                                            lowerBetter
                                            warningThreshold={{ max: 130 }}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <VitalInput 
                                            label="HA (Dia)" 
                                            value={vitals.bp_diastolic} 
                                            onChange={v => setVitals({...vitals, bp_diastolic: v})} 
                                            lowerBetter
                                            warningThreshold={{ max: 85 }}
                                        />
                                    </div>
                                </div>
                           </div>
                        </Card>
                    </Col>

                    {/* Col 3: Symptoms */}
                    <Col span={8}>
                        <Card size="small" title="Lý do khám / Triệu chứng" className="h-full border border-gray-200 shadow-sm bg-white rounded-lg">
                            <TextArea 
                                value={clinical.symptoms} 
                                onChange={e => setClinical({...clinical, symptoms: e.target.value})}
                                placeholder="Mô tả triệu chứng cơ năng..."
                                autoSize={{ minRows: 3, maxRows: 5 }}
                            />
                        </Card>
                    </Col>
                </Row>

                {/* ROW 3: DEEP EXAM (Dynamic) */}
                <div className="mb-4">
                    <ExamFormComponent 
                        data={clinical} 
                        onChange={(key: string, val: any) => setClinical(prev => ({ ...prev, [key]: val }))}
                        vitals={vitals}
                        patientDOB={patientInfo?.dob}
                    />
                </div>

                {/* ROW 4: INDICATION & CONCLUSION */}
                <Row gutter={16} className="mb-16">
                    {/* Part A: Service Order */}
                    <Col span={8} className="flex flex-col gap-4">
                         <DoctorBlock3_ServiceOrder />
                    </Col>

                    {/* Part B: Prescription & Conclusion */}
                    <Col span={16} className="flex flex-col gap-4">
                         <Card size="small" title="Chẩn đoán & Kết luận" className="border border-gray-200 shadow-sm bg-white rounded-lg">
                            <div className="flex flex-col gap-4">
                                <Input 
                                    addonBefore="Chẩn đoán" 
                                    value={clinical.diagnosis}
                                    onChange={e => setClinical({...clinical, diagnosis: e.target.value})}
                                />
                                
                                <div>
                                    <TextArea 
                                        placeholder="Lời dặn bác sĩ / Kết luận điều trị..."
                                        value={clinical.doctor_notes}
                                        onChange={e => setClinical({...clinical, doctor_notes: e.target.value})}
                                        rows={4}
                                    />
                                    {/* NEW: SMART ADVICE TAGS */}
                                    <SmartAdviceTags 
                                        diagnosis={clinical.diagnosis} 
                                        currentNotes={clinical.doctor_notes}
                                        onAddNote={(newNote) => setClinical(prev => ({ ...prev, doctor_notes: newNote }))}
                                    />
                                </div>
                            </div>
                         </Card>

                         <DoctorBlock4_Prescription 
                            items={prescriptionItems}
                            setItems={setPrescriptionItems}
                            patientAllergies={patientInfo?.allergies}
                         />
                    </Col>
                </Row>

                {/* ACTION BAR (Sticky Bottom) */}
                <DoctorBlock5_Actions 
                    onSave={handleSave} 
                    onPrint={handlePrint}
                    onScheduleFollowUp={handleScheduleFollowUp}
                    loading={loading}
                />

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
