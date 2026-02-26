// src/features/medical/api/receptionService.ts
import { CreateAppointmentPayload } from "../types/reception.types";

import { supabase } from "@/shared/lib/supabaseClient";

export const receptionService = {
  // 1. Lấy danh sách (Gọi RPC mới)
  getQueue: async (date: string, search: string) => {
    const { data, error } = await supabase.rpc("get_reception_queue", {
      p_date: date,
      p_search: search,
    });
    if (error) throw error;
    return data || [];
  },

  // 2. Tạo lịch hẹn (Insert ID chuẩn)
  createAppointment: async (payload: CreateAppointmentPayload) => {
    // [CRITICAL FIX] Validate Customer ID
    if (!payload.customer_id) throw new Error("Missing Customer ID");

    const { error } = await supabase.from("appointments").insert({
      customer_id: payload.customer_id,
      appointment_time: payload.appointment_time,
      room_id: payload.room_id,
      service_ids: payload.service_ids,
      service_type: payload.service_type,
      priority: payload.priority || "normal",
      note: payload.note,
      doctor_id: payload.doctor_id,
      status: "pending",
      contact_status: "pending",
    });
    if (error) throw error;
  },

  // 3. Lấy danh sách Phòng (Để nạp vào Dropdown)
  getRooms: async () => {
    const { data } = await supabase
      .from("warehouses")
      .select("id, name")
      .eq("status", "active"); // Hoặc lọc theo type nếu có
    return data || [];
  },

  // 4. Lấy danh sách Dịch vụ (Để nạp vào Grid Button)
  getServices: async () => {
    const { data } = await supabase
      .from("service_packages")
      .select("id, name, price")
      .eq("status", "active");
    return data || [];
  },

  // 5. Tìm kiếm khách hàng (RPC POS) [NEW]
  searchCustomers: async (keyword: string) => {
    const { data, error } = await supabase.rpc("search_customers_pos", {
      p_keyword: keyword,
    });
    if (error) throw error;
    return data || [];
  },

  // 6. Lấy danh sách Nhân viên (Users) để lọc
  getStaffs: async () => {
    // Lấy từ bảng users/staffs hoặc view_users (nếu DB auth không cho fetch)
    // Tạm gọi bảng user_profiles hoặc bảng profiles (nếu có mapping). Ta dùng rpc hoặc query cơ bản.
    // Nếu ứng dụng đang dùng sys_users hoặc profiles:
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email");
    return data || [];
  },

  // 7. Cập nhật trạng thái (Check-in / Hủy)
  updateStatus: async (id: string, status: string, cancelReason?: string) => {
    const payload: any = { status, updated_at: new Date().toISOString() };
    if (cancelReason) payload.note = `[Hủy: ${cancelReason}]`; // Hoặc lưu vào cột cancel_reason nếu có

    const { error } = await supabase
      .from("appointments")
      .update(payload)
      .eq("id", id);

    if (error) throw error;
  },
};

export const getMedicalPackages = async (keyword?: string) => {
  const query = supabase
    .from("service_packages")
    .select(`
      id, name, price, status, clinical_category,
      service_package_items(item_id, products(name), quantity)
    `)
    .eq("status", "active")
    .eq("type", "bundle")
    .neq("clinical_category", "vaccination") // Tuyệt đối không lôi Vắc-xin vào đây
    .ilike("name", `%${keyword || ""}%`)
    .limit(20);

  const { data, error } = await query;
  if (error) throw error;
  return data;
};
