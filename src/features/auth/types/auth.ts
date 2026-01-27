// src/types/auth.ts
import { User } from "@supabase/supabase-js";

// 1. TẠO "KHUÔN MẪU" CHO HỒ SƠ PUBLIC (public.users)
// (Đây là phiên bản rút gọn Sếp cần cho Gatekeeper - Luồng Onboarding)
export interface UserProfile {
  id: string; // UUID
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  status: "pending_approval" | "active" | "inactive";
  profile_updated_at: string | null; // Cột kiểm soát Onboarding
  phone: string | null; // (Các trường HCNS đầy đủ sẽ được dùng ở trang Profile)
  warehouse_id?: number | null; // [NEW] Kho làm việc
  branch_id?: number | null; // [NEW] Chi nhánh
}

// 2. NÂNG CẤP "KHUÔN MẪU" BỘ NÃO
export interface AuthStoreState {
  user: User | null; // Từ auth.users (Bảo mật)
  profile: UserProfile | null; // Từ public.users (Nghiệp vụ)
  loading: boolean; // Dùng cho Login/Logout
  isLoadingProfile: boolean; // Dùng cho Gatekeeper (kiểm tra profile)
  permissions: string[]; // [NEW] Danh sách quyền hạn
  // Hàm cơ bản

  login: (values: any) => Promise<any>;
  logout: () => Promise<void>;
  checkUserSession: () => Promise<void>;
  fetchProfile: () => Promise<UserProfile | null>; // Hàm mới
  // Hàm nghiệp vụ Onboarding (Sếp yêu cầu)
  updatePassword: (newPassword: string) => Promise<void>;
  updateProfile: (data: any) => Promise<void>;
}
