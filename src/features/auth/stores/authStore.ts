// src/stores/authStore.ts
import { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";

// Định nghĩa "khuôn mẫu" cho kho
interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

// Tạo kho auth
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true, // Bắt đầu ở trạng thái loading
  setSession: (session) => set({ session }),
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
}));
