// src/services/userService.ts
import { supabase } from "@/lib/supabaseClient";
import { UserRoleInfo } from "@/types/user";

// 1. Tải danh sách User (gọi RPC Sếp đã tạo)
export const fetchUsersWithRoles = async (): Promise<UserRoleInfo[]> => {
  const { data, error } = await supabase.rpc("get_users_with_roles");
  if (error) throw error;
  return data || [];
};

// 2. Mời User mới (gọi RPC Sếp vừa tạo)
export const createNewUser = async (values: {
  name: string;
  email: string;
  password: string; // <-- Thêm mật khẩu
}) => {
  const { data, error } = await supabase.rpc("create_new_auth_user", {
    p_email: values.email,
    p_password: values.password, // <-- Gửi mật khẩu
    p_full_name: values.name,
  });
  if (error) throw error;
  return data; // Trả về ID user mới
};

// 3. Cập nhật phân quyền (gọi RPC Sếp vừa tạo)
export const updateUserAssignments = async (
  userId: string,
  assignments: any[]
) => {
  // Chỉ giữ lại 2 trường cần thiết
  const cleanAssignments = assignments.map((a) => ({
    branchId: a.branchId,
    roleId: a.roleId,
  }));

  const { error } = await supabase.rpc("update_user_assignments", {
    p_user_id: userId,
    p_assignments: cleanAssignments,
  });
  if (error) throw error;
  return true;
};

// 4. Xóa User (gọi RPC Sếp vừa tạo)
export const deleteAuthUser = async (userId: string) => {
  const { error } = await supabase.rpc("delete_auth_user", {
    p_user_id: userId,
  });
  if (error) throw error;
  return true;
};

// 5. Cập nhật trạng thái (SENKO: Sẽ làm khi Sếp có bảng `employees`)
export const updateUserStatus = async (userId: string, status: string) => {
  console.log("Đang cập nhật trạng thái (chưa code):", userId, status);
  // Tạm thời trả về thành công
  await new Promise((res) => setTimeout(res, 500));
  return true;
};
