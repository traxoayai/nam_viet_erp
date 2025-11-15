// src/services/authService.ts
import { supabase } from "@/lib/supabaseClient";
import { UserProfile } from "@/types/auth"; // Import "khuôn mẫu" Sếp vừa tạo

/**
 * 1. Đăng nhập
 */
export const login = async (values: any) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: values.email,
    password: values.password,
  });
  if (error) throw error;
  return data;
};

/**
 * 2. Đăng xuất
 */
export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

/**
 * 3. Kiểm tra phiên đăng nhập (Session)
 */
export const checkUserSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

// --- CÁC HÀM MỚI CHO ONBOARDING (Sếp vừa tạo RPC) ---

/**
 * 4. Lấy hồ sơ public.users của chính user đang đăng nhập
 */
export const getSelfProfile = async (): Promise<UserProfile | null> => {
  const { data, error } = await supabase.rpc("get_self_profile");

  if (error) {
    console.error("Lỗi get_self_profile:", error);
    throw error;
  } // RPC trả về 1 mảng, ta chỉ lấy phần tử đầu tiên (hoặc null)
  return (data?.[0] as UserProfile) || null;
};

/**
 * 5. User tự cập nhật mật khẩu
 */
export const updateSelfPassword = async (newPassword: string) => {
  // SỬA LỖI: Không dùng RPC. Dùng hàm client-side chuẩn của Supabase
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    console.error("Lỗi Supabase auth.updateUser:", error);
    throw error;
  }
  return data;
};

/**
 * 6. User tự cập nhật hồ sơ (Trang Canvas)
 */
export const updateSelfProfile = async (profileData: any) => {
  const { error } = await supabase.rpc("update_self_profile", {
    p_profile_data: profileData,
  });
  if (error) throw error;
};
