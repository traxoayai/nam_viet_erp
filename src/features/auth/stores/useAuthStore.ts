// src/stores/useAuthStore.ts
import { create } from "zustand";

import * as authService from "@/features/auth/api/authService";
import { AuthStoreState } from "@/features/auth/types/auth";
import { supabase } from "@/shared/lib/supabaseClient";

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  // State (Trạng thái)
  // State (Trạng thái)
  user: null,
  profile: null,
  permissions: [], // [NEW] Default rỗng
  loading: true, // Mặc định là true khi app mới load
  isLoadingProfile: true, // --- HÀM NGHIỆP VỤ (Actions) ---
  /**
   * Lấy thông tin hồ sơ (public.users)
   */

  fetchProfile: async () => {
    set({ isLoadingProfile: true });
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        set({ profile: null, permissions: [], isLoadingProfile: false });
        return null;
      }

      // 1. Lấy thông tin user (Code cũ)
      const profile = await authService.getSelfProfile();

      // 2. [NEW] Gọi RPC lấy danh sách quyền
      const { data: perms } = await supabase.rpc("get_my_permissions");

      set({
        profile,
        permissions: perms || [],
        isLoadingProfile: false,
      });
      return profile;
    } catch (error) {
      console.error("Lỗi fetchProfile:", error);
      set({ profile: null, permissions: [], isLoadingProfile: false });
      return null;
    }
  } /**
   * Kiểm tra phiên đăng nhập (Khi tải lại trang)
   */,

  checkUserSession: async () => {
    set({ loading: true, isLoadingProfile: true });
    try {
      const session = await authService.checkUserSession();
      if (session) {
        set({ user: session.user });
        await get().fetchProfile(); // Lấy profile đi kèm
      } else {
        set({ user: null, profile: null, permissions: [] });
      }
    } catch (error) {
      console.error("Lỗi checkUserSession:", error);
      set({ user: null, profile: null, permissions: [] });
    } finally {
      set({ loading: false, isLoadingProfile: false });
    }
  } /**
   * Đăng nhập
   */,

  login: async (values) => {
    set({ loading: true });
    try {
      const { user } = await authService.login(values);
      set({ user });
      await get().fetchProfile(); // Lấy profile ngay sau khi login
      set({ loading: false });
      return { user };
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  } /**
   * Đăng xuất
   */,

  logout: async () => {
    set({ loading: true });
    await authService.logout();
    set({ user: null, profile: null, permissions: [], loading: false });
  } /**
   * (Bước 3 Sếp yêu cầu) Cập nhật Mật khẩu
   */,

  updatePassword: async (newPassword: string) => {
    // Không set loading, để trang tự xử lý
    try {
      await authService.updateSelfPassword(newPassword);
    } catch (error) {
      console.error("Lỗi updatePassword:", error);
      throw error;
    }
  } /**
   * (Bước 4 Sếp yêu cầu) Cập nhật Hồ sơ
   */,

  updateProfile: async (data: any) => {
    try {
      await authService.updateSelfProfile(data); // Cập nhật lại profile trong "bộ não"
      const newProfile = await get().fetchProfile();
      set({ profile: newProfile });
    } catch (error) {
      console.error("Lỗi updateProfile:", error);
      throw error;
    }
  },
}));

// --- Tự động lắng nghe thay đổi Auth của Supabase ---
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    useAuthStore.setState({ user: null, profile: null, permissions: [] });
  } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
    useAuthStore.setState({ user: session?.user ?? null });
  }
});
