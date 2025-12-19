// src/features/auth/api/userService.ts
// --- BẢO MẬT: Đã xóa import supabaseAdmin để tránh lộ Service Key ---
import { UserAssignment } from "@/features/auth/types/user";
import { supabase } from "@/shared/lib/supabaseClient";

// 1. Lấy danh sách Users (Giữ nguyên)
export const fetchUsersWithRoles = async () => {
  const { data, error } = await supabase.rpc("get_users_with_roles");
  if (error) throw error;
  return data;
};

// 2. TẠO USER MỚI (ĐÃ NÂNG CẤP - Gọi Edge Function)
// 2. TẠO USER MỚI (CORE DEBUG VERSION)
export const createNewUser = async (values: {
  name: string;
  email: string;
  password: string;
  roleId?: number;
  branchId?: number;
}) => {
  console.log("🚀 Đang gọi Edge Function 'create-user'...");

  const { data, error } = await supabase.functions.invoke("create-user", {
    body: {
      email: values.email,
      password: values.password,
      fullName: values.name,
      roleId: values.roleId,
      branchId: values.branchId,
    },
  });

  // BẮT LỖI CHI TIẾT
  if (error) {
    // Thử đọc body response nếu có để xem lỗi cụ thể từ server
    let serverMessage = "Lỗi kết nối Edge Function";

    if (error instanceof Error) {
      serverMessage = error.message;
    }

    // Nếu lỗi là do FunctionsHttpError (Supabase return non-2xx)
    // Chúng ta cần check xem status code là gì
    // Note: Supabase JS Client đôi khi giấu response body trong property context
    console.error("❌ Lỗi Edge Function Chi tiết:", error);

    // Nếu lỗi là 403 -> Bị chặn quyền
    // Nếu lỗi là 500 -> Code server sai
    // Nếu lỗi là 404 -> Chưa deploy function

    throw new Error(serverMessage);
  }

  // Kiểm tra logic lỗi trả về từ code của CORE (như Email trùng)
  if (data && data.error) {
    console.error("❌ Lỗi Logic từ Server:", data.message);
    throw new Error(data.message || data.error);
  }

  console.log("✅ Tạo user thành công:", data);
  return data.user;
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

// 4. Xóa User
export const deleteUser = async (_userId: string) => {
  // Lưu ý: Hiện tại chưa có API xóa an toàn từ Client.
  // Nếu cần, Sếp hãy yêu cầu CORE viết thêm Edge Function 'delete-user'.
  console.warn("Chức năng xóa chưa được tích hợp API an toàn.");
  // const { error } = await supabase.rpc("delete_user_soft", { p_user_id: userId });
  return true;
};

/**
 * 5. Admin Duyệt User
 */
export const approveUser = async (userId: string): Promise<boolean> => {
  const { error } = await supabase.rpc("approve_user", {
    p_user_id: userId,
  });
  if (error) throw error;
  return true;
};

/**
 * 6. Admin Cập nhật Trạng thái (Tạm dừng, Kích hoạt lại)
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
