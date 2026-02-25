// src/features/medical/types/reception.types.ts
export interface ReceptionAppointment {
  id: string; // UUID
  appointment_time: string; // [QUAN TRỌNG] Đã đổi tên từ 'time'

  // Thông tin khách
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  customer_code: string;
  customer_gender: string; // 'male' | 'female' | ...
  customer_yob: number; // Năm sinh (VD: 1990)

  // Phòng / Cơ sở (Dùng room_name để hiển thị lên UI)
  room_id: number | null;
  room_name: string;

  // Dịch vụ (Dùng service_names.map(...) để render badges)
  service_ids: number[];
  service_names: string[];
  service_type: string | null;

  // Trạng thái & Phân loại
  priority: "normal" | "emergency" | "vip";
  doctor_name: string; // Đã là tên thật (VD: BS. Hùng)
  status: string; // 'pending', 'confirmed', ...
  contact_status: "pending" | "confirmed" | "failed";
  creator_name: string; // [NEW] Tên nhân viên tạo
  payment_status: string; // [NEW] Trạng thái thanh toán
}

export interface CreateAppointmentPayload {
  customer_id: number;
  appointment_time: string;
  room_id: number | null;
  service_ids: number[];
  service_type: string;
  priority: "normal" | "emergency" | "vip";
  note: string;
  doctor_id: string | null;
}
