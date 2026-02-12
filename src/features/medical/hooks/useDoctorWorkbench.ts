// src/features/medical/hooks/useDoctorWorkbench.ts
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { 
    MedicalVisitRow, 
    ClinicalPrescriptionItem 
} from '../types/medical.types';
import { supabase } from '@/shared/lib/supabaseClient';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import dayjs from 'dayjs';
import { receptionService } from '@/features/medical/api/receptionService';
import { printMedicalVisit } from '@/shared/utils/printTemplates';

export const useDoctorWorkbench = () => {
    const { id: appointmentId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    
    // --- STATE ---
    const [loading, setLoading] = useState(false);
    const [visit, setVisit] = useState<Partial<MedicalVisitRow>>({});
    
    // Khám lâm sàng
    const [vitals, setVitals] = useState({
        pulse: null as number | null,
        temperature: null as number | null,
        sp02: null as number | null,
        bp_systolic: null as number | null,
        bp_diastolic: null as number | null,
        weight: null as number | null,
        height: null as number | null,
    });
    
    const [clinical, setClinical] = useState({
        symptoms: '',
        diagnosis: '',
        icd_code: '',
        doctor_notes: '',
        examination_summary: '', // Tóm tắt khám
        
        // SPECIALIZED FIELDS
        fontanelle: null, reflexes: null, jaundice: null, feeding_status: null,
        dental_status: null, motor_development: null, language_development: null,
        puberty_stage: null, scoliosis_status: null, visual_acuity_left: null, visual_acuity_right: null,
        lifestyle_alcohol: false, lifestyle_smoking: false,
        
        // NEW INTELLIGENCE FIELDS
        red_flags: [] as string[],
        vac_screening: {} as Record<string, string>
    });

    // Kê đơn
    const [prescriptionItems, setPrescriptionItems] = useState<ClinicalPrescriptionItem[]>([]);
    
    // Chỉ định CLS
    const [serviceOrders, setServiceOrders] = useState<any[]>([]);

    // Patient Info
    const [patientInfo, setPatientInfo] = useState<any>(null);

    // --- LOADING ---
    useEffect(() => {
        if (appointmentId) {
            fetchAppointmentData(appointmentId);
        }
    }, [appointmentId]);

    const fetchAppointmentData = async (apptId: string) => {
        setLoading(true);
        try {
            // 1. Get Appointment Info & Patient
            const { data: appt, error: apptError } = await supabase
                .from('appointments')
                .select(`
                    *,
                    patient:customers!customer_id(*)
                `)
                .eq('id', apptId)
                .single();
            
            if (apptError) throw apptError;
            setPatientInfo(appt.patient);

            // 2. Get Medical Visit
            const { data: visitData, error: _visitError } = await supabase
                .from('medical_visits')
                .select('*')
                .eq('appointment_id', apptId)
                .maybeSingle();
            
            if (visitData) {
                setVisit(visitData);
                // Fill state
                setVitals({
                    pulse: visitData.pulse,
                    temperature: visitData.temperature,
                    sp02: visitData.sp02,
                    bp_systolic: visitData.bp_systolic,
                    bp_diastolic: visitData.bp_diastolic,
                    weight: visitData.weight,
                    height: visitData.height
                });
                setClinical({
                    symptoms: visitData.symptoms || '',
                    diagnosis: visitData.diagnosis || '',
                    icd_code: visitData.icd_code || '',
                    doctor_notes: visitData.doctor_notes || '',
                    examination_summary: visitData.examination_summary || '',
                    // Map generic fields
                    fontanelle: visitData.fontanelle,
                    reflexes: visitData.reflexes,
                    jaundice: visitData.jaundice,
                    feeding_status: visitData.feeding_status,
                    dental_status: visitData.dental_status,
                    motor_development: visitData.motor_development,
                    language_development: visitData.language_development,
                    puberty_stage: visitData.puberty_stage,
                    scoliosis_status: visitData.scoliosis_status,
                    visual_acuity_left: visitData.visual_acuity_left,
                    visual_acuity_right: visitData.visual_acuity_right,
                    lifestyle_alcohol: visitData.lifestyle_alcohol,
                    lifestyle_smoking: visitData.lifestyle_smoking,
                    
                    // Map new fields (Ensure they exist or default)
                    red_flags: visitData.red_flags || [],
                    vac_screening: visitData.vac_screening || {}
                });
            }

        } catch (err: any) {
            console.error(err);
            message.error("Không thể tải dữ liệu khám!");
        } finally {
            setLoading(false);
        }
    };

    // --- ACTIONS ---
    const handleSave = async (status: 'in_progress' | 'finished') => {
        if (!user || !user.id) {
            message.error("Lỗi phiên đăng nhập! Vui lòng tải lại trang.");
            return;
        }

        setLoading(true);
        try {
            // Chuẩn bị Payload phẳng
            const flatPayload = {
                // Vitals
                ...vitals,
                // Clinical
                ...clinical,
                // Meta
                status: status,
                updated_at: new Date().toISOString()
            };

            let resultData;
            
            if (visit?.id) {
                // UPDATE RPC
                const { data, error } = await supabase.rpc('update_medical_visit', {
                    p_visit_id: visit.id,
                    p_doctor_id: user.id,
                    p_data: flatPayload
                });
                if (error) throw error;
                resultData = data;
            } else {
                // CREATE RPC
                const { data, error } = await supabase.rpc('create_medical_visit', {
                    p_appointment_id: appointmentId,
                    p_customer_id: patientInfo?.id,
                    p_data: flatPayload
                });
                if (error) throw error;
                resultData = data;
            }

            // Update local state id if created
            if (resultData && !visit.id) {
                 // Gỉa sử RPC trả về ID hoặc object chứa ID. 
                 // Nếu RPC trả về void hoặc boolean, cần check lại. 
                 // Nhưng theo spec, RPC create thường trả về ID hoặc Record.
                 // Ta tạm set như vậy.
                 setVisit(prev => ({ ...prev, id: resultData }));
            }

            message.success(status === 'finished' ? "Đã hoàn thành phiếu khám!" : "Đã lưu nháp!");
            
            if (status === 'finished') {
                navigate('/medical/reception');
            } else {
                // Reload data to ensure sync?
                fetchAppointmentData(appointmentId!);
            }

        } catch (err: any) {
            console.error("Save Error:", err);
            message.error("Lỗi lưu: " + (err.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    // 5. In phiếu khám
    const handlePrint = () => {
        if (!patientInfo) return;
        
        // Gom dữ liệu từ các State lẻ tẻ thành 1 object hoàn chỉnh để in
        const printData = {
            patientInfo: {
                ...patientInfo,
                // Format lại giới tính/ngày sinh nếu cần hiển thị đẹp
            },
            vitals: vitals,
            clinical: clinical,
            prescriptionItems: prescriptionItems,
            doctorName: user?.user_metadata?.full_name || user?.email || "Bác sĩ chỉ định",
            visitDate: visit?.created_at || new Date().toISOString()
        };
        printMedicalVisit(printData);
    };

    // 6. Hẹn tái khám
    const handleScheduleFollowUp = async (dateStr: string) => {
        if (!patientInfo?.id) return message.error("Chưa có thông tin bệnh nhân!");
        
        setLoading(true);
        try {
            // Tạo lịch hẹn tái khám (Mặc định 8:00 sáng ngày chọn)
            const appointmentData = {
                customer_id: patientInfo.id,
                appointment_time: dayjs(dateStr).set('hour', 8).set('minute', 0).format('YYYY-MM-DDTHH:mm'),
                note: `Tái khám theo chỉ định của BS (Mã phiếu: ${visit?.id || 'N/A'})`,
                priority: 'normal',
                service_ids: [], // Có thể để trống hoặc thêm dịch vụ khám
                room_id: null,    // Để lễ tân xếp lại
                doctor_id: typeof user?.id === 'string' ? user.id : undefined // Ensure doctor_id is string or undefined
            };
            await receptionService.createAppointment(appointmentData as any);
            message.success(`Đã đặt lịch tái khám ngày ${dayjs(dateStr).format('DD/MM/YYYY')}`);
        } catch (e: any) {
            message.error("Lỗi đặt lịch: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        patientInfo,
        visit,
        vitals, setVitals,
        clinical, setClinical,
        prescriptionItems, setPrescriptionItems,
        serviceOrders, setServiceOrders,
        handleSave,
        handlePrint,
        handleScheduleFollowUp,
        medicalVisitId: visit.id
    };
};
