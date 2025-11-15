// src/services/userService.ts
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // <-- SỬA: Import "Bộ đàm Admin"
import { supabase } from "@/lib/supabaseClient";
import { UserAssignment } from "@/types/user";

// 1. Lấy danh sách Users (Giữ nguyên)
export const fetchUsersWithRoles = async () => {
  const { data, error } = await supabase.rpc("get_users_with_roles");
  if (error) throw error;
  return data;
};

// 2. SỬA LỖI 400: Tạo User Mới (Dùng Admin API, không dùng RPC)
export const createNewUser = async (values: {
  name: string;
  email: string;
  password: string;
}) => {
  // Gọi hàm 'admin.createUser' từ "Bộ đàm Admin"
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: values.email,
    password: values.password,
    user_metadata: {
      full_name: values.name,
    },
    email_confirm: true, // Tự động xác thực email (vì Sếp đã tắt)
  });

  if (error) {
    console.error("Lỗi Admin API:", error.message);
    throw error;
  }
  return data.user; // Trả về user mới
};

// 3. Cập nhật Quyền (Giữ nguyên)
export const updateUserAssignments = async (
  userId: string,
  assignments: Partial<UserAssignment>[]
) => {
  const { error } = await supabase.rpc("update_user_assignments", {
    p_user_id: userId,
    p_assignments: assignments,
  });
  if (error) throw error;
  return true;
};

// 4. Xóa User (Sẽ nâng cấp sau)
export const deleteUser = async (userId: string) => {
  // (Tạm thời chưa làm)
  console.log("Yêu cầu xóa:", userId);
  return true;
};

/**
 * 5. (MỚI) Admin Duyệt User
 */
export const approveUser = async (userId: string): Promise<boolean> => {
  const { error } = await supabase.rpc("approve_user", {
    p_user_id: userId,
  });
  if (error) throw error;
  return true;
};
/**
 * 6. (MỚI) Admin Cập nhật Trạng thái (Tạm dừng, Kích hoạt lại)
 */
export const updateUserStatus = async (
  userId: string,
  status: string
): Promise<boolean> => {
  const { error } = await supabase.rpc("update_user_status", {
    p_user_id: userId,
    p_status: status,
  });
  if (error) throw error;
  return true;
};
