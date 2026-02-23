// src/features/medical/api/paraclinicalService.ts
import { supabase } from '@/shared/lib/supabaseClient';

export const paraclinicalService = {
  // Lấy danh sách hàng đợi (Chỉ lấy ca đã thanh toán / có payment_order_id)
  async getParaclinicalQueue() {
    const { data, error } = await supabase
      .from('clinical_service_requests')
      .select(`
        *,
        medical_visit:medical_visits(id, diagnosis, doctor_notes),
        patient:customers!patient_id(id, name, phone, gender, dob) 
      `)
      // Lưu ý: bảng customers map qua khóa ngoại patient_id của bảng clinical_service_requests
      .in('status', ['waiting', 'examining', 'processing'])
      .not('payment_order_id', 'is', null)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    return data || [];
  },

  // Lấy danh sách mẫu (Template) của Hình ảnh / Nội soi ... theo Dịch vụ
  async getTemplates(servicePackageId: number) {
    const { data, error } = await supabase
      .from('paraclinical_templates')
      .select('*')
      .eq('service_package_id', servicePackageId)
      .eq('status', 'active');
      
    if (error) throw error;
    return data || [];
  },

  // Lấy danh sách chỉ số cấu hình Xét nghiệm
  async getLabConfig(servicePackageId: number) {
    const { data, error } = await supabase
      .from('lab_indicators_config')
      .select('*')
      .eq('service_package_id', servicePackageId)
      .eq('status', 'active')
      .order('display_order', { ascending: true });
      
    if (error) throw error;
    return data || [];
  },

  // Gọi RPC đẩy kết quả
  async submitResult(payload: {
    request_id: number;
    results_json?: any;
    imaging_result?: string;
    status: 'draft' | 'completed';
  }) {
    const { data, error } = await supabase.rpc('submit_paraclinical_result', {
      p_request_id: payload.request_id,
      p_results_json: payload.results_json || null,
      p_imaging_result: payload.imaging_result || null,
      p_status: payload.status
    });

    if (error) throw error;
    return data;
  }
};
