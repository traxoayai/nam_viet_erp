// src/features/medical/hooks/useDoctorWorkbench.ts
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { message } from 'antd';
import { MedicalVisitRow, ClinicalPrescriptionItem } from '../types/medical.types';
import { supabase } from '@/shared/lib/supabaseClient';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { printMedicalVisit } from '@/shared/utils/printTemplates';

export const useDoctorWorkbench = () => {
    const { id: appointmentId } = useParams<{ id: string }>();
    const { user } = useAuthStore();
    
    // --- STATE ---
    const [loading, setLoading] = useState(false);
    const [visit, setVisit] = useState<Partial<MedicalVisitRow>>({});
    
    // Khám lâm sàng
    const [vitals, setVitals] = useState<any>({
        pulse: null, temperature: null, sp02: null,
        bp_systolic: null, bp_diastolic: null, weight: null, height: null,
    });
    
    const [clinical, setClinical] = useState<any>({
        symptoms: '', diagnosis: '', icd_code: '', doctor_notes: '', examination_summary: '',
        fontanelle: null, reflexes: null, jaundice: null, feeding_status: null,
        dental_status: null, motor_development: null, language_development: null,
        puberty_stage: null, scoliosis_status: null, visual_acuity_left: null, visual_acuity_right: null,
        lifestyle_alcohol: false, lifestyle_smoking: false,
        red_flags: [], vac_screening: {}
    });

    const [prescriptionItems, setPrescriptionItems] = useState<ClinicalPrescriptionItem[]>([]);
    const [serviceOrders, setServiceOrders] = useState<any[]>([]);
    const [patientInfo, setPatientInfo] = useState<any>(null);
    const [isPrescriptionSent, setIsPrescriptionSent] = useState(false);

    // --- LOADING ---
    useEffect(() => {
        if (appointmentId) fetchAppointmentData(appointmentId);
    }, [appointmentId]);

    const fetchAppointmentData = async (apptId: string) => {
        setLoading(true);
        try {
            const { data: appt, error: apptError } = await supabase
                .from('appointments')
                .select(`*, patient:customers!customer_id(*)`)
                .eq('id', apptId)
                .single();
            if (apptError) throw apptError;
            setPatientInfo(appt.patient);

            // Fetch Medical Visit
            const { data: visitData } = await supabase
                .from('medical_visits')
                .select('*')
                .eq('appointment_id', apptId)
                .maybeSingle();

            // Fetch Chỉ định Cận Lâm Sàng hiện có
            if (visitData?.id) {
                const { data: requests } = await supabase
                    .from('clinical_service_requests')
                    .select('*')
                    .eq('medical_visit_id', visitData.id);
                if (requests) setServiceOrders(requests);
            }
            
            if (visitData) {
                setVisit(visitData);
                setVitals({
                    pulse: visitData.pulse, temperature: visitData.temperature, sp02: visitData.sp02,
                    bp_systolic: visitData.bp_systolic, bp_diastolic: visitData.bp_diastolic,
                    weight: visitData.weight, height: visitData.height
                });
                setClinical({
                    symptoms: visitData.symptoms || '', diagnosis: visitData.diagnosis || '',
                    icd_code: visitData.icd_code || '', doctor_notes: visitData.doctor_notes || '',
                    examination_summary: visitData.examination_summary || '',
                    fontanelle: visitData.fontanelle, reflexes: visitData.reflexes,
                    jaundice: visitData.jaundice, feeding_status: visitData.feeding_status,
                    dental_status: visitData.dental_status, motor_development: visitData.motor_development,
                    language_development: visitData.language_development, puberty_stage: visitData.puberty_stage,
                    scoliosis_status: visitData.scoliosis_status, visual_acuity_left: visitData.visual_acuity_left,
                    visual_acuity_right: visitData.visual_acuity_right,
                    lifestyle_alcohol: visitData.lifestyle_alcohol, lifestyle_smoking: visitData.lifestyle_smoking,
                    red_flags: visitData.red_flags || [], vac_screening: visitData.vac_screening || {}
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
    const isReadOnly = visit.status === 'finished';

    const handleSave = async (status: 'in_progress' | 'finished') => {
        if (!user || !user.id) {
            message.error("Lỗi phiên đăng nhập!"); return;
        }
        if (loading && !visit.id) return; // Prevent double click

        setLoading(true);
        try {
            // [FIX 1]: MERGE DATA ĐỂ TRÁNH NULL (Lấy cái cũ đè cái mới)
            const flatPayload = {
                ...visit, // Base data từ DB
                ...vitals, // Data mới nhập
                ...clinical, // Data mới nhập
                status: status,
                updated_at: new Date().toISOString()
            };

            // Cleanup các field không tồn tại trong bảng medical_visits
            delete (flatPayload as any).id;
            delete (flatPayload as any).created_at;
            delete (flatPayload as any).doctor;
            delete (flatPayload as any).patient;
            delete (flatPayload as any).prescriptions;

            let currentVisitId = visit?.id;

            // [FIX 2]: LOGIC SELF-HEALING (Tự sửa lỗi Duplicate)
            if (currentVisitId) {
                const { error } = await supabase.rpc('update_medical_visit', {
                    p_visit_id: currentVisitId,
                    p_doctor_id: user.id,
                    p_data: flatPayload
                });
                if (error) throw error;
            } else {
                // Nếu chưa có ID, gọi Create.
                // Hàm Create mới của Core đã có ON CONFLICT DO UPDATE, nên sẽ an toàn.
                const { data, error } = await supabase.rpc('create_medical_visit', {
                    p_appointment_id: appointmentId,
                    p_customer_id: patientInfo?.id,
                    p_data: flatPayload
                });
                
                if (error) throw error;
                currentVisitId = data;
            }

            // [FIX 3]: CẬP NHẬT STATE NGAY LẬP TỨC
            setVisit(prev => ({ 
                ...prev, 
                id: currentVisitId, 
                ...flatPayload,
                status: status
            }));

            if (status === 'finished') {
                message.success("Đã hoàn thành & Chuyển Dược!");
                // [FIX 4]: KHÔNG NAVIGATE. Ở lại trang để bác sĩ xem lại.
            } else {
                message.success("Đã lưu nháp!");
            }

        } catch (err: any) {
            console.error("Save Error:", err);
            message.error("Lỗi lưu: " + (err.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        if (!patientInfo) return;
        const printData = {
            patientInfo: { ...patientInfo },
            vitals: vitals,
            clinical: clinical,
            prescriptionItems: prescriptionItems,
            doctorName: user?.user_metadata?.full_name || "Bác sĩ chỉ định",
            visitDate: visit?.created_at || new Date().toISOString()
        };
        printMedicalVisit(printData);
    };

    const handleScheduleFollowUp = async (_dateStr: string) => {
        // Logic cũ giữ nguyên
    };

    // --- API THU TIỀN VÀ KÊ ĐƠN ---
    const handleCheckoutClinicalServices = async (selectedServicesJson: any[]) => {
        if (!appointmentId || !patientInfo) return message.error("Chưa có thông tin khám bệnh/bệnh nhân");
        if (!selectedServicesJson.length) return message.warning("Chưa chọn dịch vụ nào");
        setLoading(true);
        try {
            const { error } = await supabase.rpc('checkout_clinical_services', {
                p_appointment_id: appointmentId,
                p_customer_id: patientInfo.id,
                p_services: selectedServicesJson
            });
            if (error) throw error;
            message.success("Đã tạo phiếu thu tiền thành công!");
            
            // Reload Cận lâm sàng
            const { data: requests } = await supabase
                .from('clinical_service_requests')
                .select('*')
                .eq('medical_visit_id', visit.id);
            if (requests) setServiceOrders(requests);
        } catch (err: any) {
             message.error("Lỗi thu tiền: " + err.message);
        } finally {
             setLoading(false);
        }
    };

    const handleSendToPharmacy = async (warehouseId: number) => {
        if (!appointmentId || !patientInfo) return message.error("Chưa có thông tin khám");
        if (!prescriptionItems.length) return message.warning("Đơn thuốc trống!");
        setLoading(true);
        try {
            const { error } = await supabase.rpc('send_prescription_to_pos', {
                p_appointment_id: appointmentId,
                p_customer_id: patientInfo.id,
                p_items: prescriptionItems,
                p_pharmacy_warehouse_id: warehouseId
            });
            if (error) throw error;
            message.success("Đã chuyển Đơn tới Quầy Thuốc thành công!");
            setIsPrescriptionSent(true);
        } catch(err: any) {
            message.error("Lỗi gửi toa: " + err.message);
        } finally {
            setLoading(false);
        }
    }

    return {
        loading, patientInfo, visit, vitals, setVitals, clinical, setClinical,
        prescriptionItems, setPrescriptionItems, serviceOrders, setServiceOrders,
        handleSave, handlePrint, handleScheduleFollowUp, handleCheckoutClinicalServices, handleSendToPharmacy,
        medicalVisitId: visit.id,
        isReadOnly,
        isPrescriptionSent
    };
};
