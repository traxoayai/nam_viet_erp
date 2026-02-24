// src/features/booking/api/bookingService.ts
import { supabase } from "@/shared/lib/supabaseClient";

export interface BookingPayload {
  customer_id: number;
  doctor_id?: string; // UUID string
  appointment_time: string; // ISO string
  symptoms: any[];
  notes?: string;
  description?: string;
  status?: "confirmed" | "pending";
}

export interface CheckInPayload {
  customer_id: number;
  doctor_id?: string; // UUID string
  priority: "normal" | "urgent";
  symptoms: any[];
  notes?: string;
}

export const bookingService = {
  /**
   * Tạo lịch hẹn mới via RPC
   */
  createBooking: async (payload: BookingPayload) => {
    // Sanitize doctor_id: ensure empty string becomes null
    const doctorId =
      payload.doctor_id && payload.doctor_id.trim() !== ""
        ? payload.doctor_id
        : null;

    const { data, error } = await supabase.rpc("create_appointment_booking", {
      p_customer_id: payload.customer_id,
      p_doctor_id: doctorId,
      p_time: payload.appointment_time,
      p_symptoms: payload.symptoms,
      p_note: payload.notes || "", // Singular 'note'
      p_type: "examination",
      p_status: payload.status || "confirmed",
    });

    if (error) throw error;
    return data; // Returns appointment_id
  },

  /**
   * Check-in ngay vào Clinical Queue via RPC
   */
  checkInNow: async (payload: CheckInPayload) => {
    // Sanitize doctor_id: ensure empty string becomes null
    const doctorId =
      payload.doctor_id && payload.doctor_id.trim() !== ""
        ? payload.doctor_id
        : null;

    const { data, error } = await supabase.rpc("check_in_patient", {
      p_customer_id: payload.customer_id,
      p_doctor_id: doctorId,
      p_priority: payload.priority === "urgent" ? "high" : "normal",
      p_symptoms: payload.symptoms,
      p_notes: payload.notes || "", // Plural 'notes'
    });

    if (error) throw error;
    return data; // Returns queue_number or queue_id
  },
};
