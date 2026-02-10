// src/features/medical/api/receptionService.ts
import { supabase } from '@/shared/lib/supabaseClient';
import { CreateAppointmentPayload } from '../types/reception.types';

export const receptionService = {
  // 1. Lấy danh sách (Gọi RPC mới)
  getQueue: async (date: string, search: string) => {
    const { data, error } = await supabase.rpc('get_reception_queue', {
      p_date: date,
      p_search: search
    });
    if (error) throw error;
    return data || [];
  },

  // 2. Tạo lịch hẹn (Insert ID chuẩn)
  createAppointment: async (payload: CreateAppointmentPayload) => {
    // [CRITICAL FIX] Validate Customer ID
    if (!payload.customer_id) throw new Error("Missing Customer ID");

    const { error } = await supabase.from('appointments').insert({
      customer_id: payload.customer_id,
      appointment_time: payload.appointment_time,
      room_id: payload.room_id,
      service_ids: payload.service_ids, 
      priority: payload.priority || 'normal',
      note: payload.note,
      doctor_id: payload.doctor_id,
      status: 'pending',
      contact_status: 'pending'
    });
    if (error) throw error;
  },

  // 3. Lấy danh sách Phòng (Để nạp vào Dropdown)
  getRooms: async () => {
    const { data } = await supabase.from('warehouses')
      .select('id, name')
      .eq('status', 'active'); // Hoặc lọc theo type nếu có
    return data || [];
  },

  // 4. Lấy danh sách Dịch vụ (Để nạp vào Grid Button)
  getServices: async () => {
    const { data } = await supabase.from('service_packages')
      .select('id, name, price')
      .eq('status', 'active');
    return data || [];
  },

  // 5. Tìm kiếm khách hàng (RPC POS) [NEW]
  searchCustomers: async (keyword: string) => {
    const { data, error } = await supabase.rpc('search_customers_pos', {
      p_keyword: keyword
    });
    if (error) throw error;
    return data || [];
  }
};