// src/router/ProtectedRoute.tsx
// (NÂNG CẤP V400: Đã Sửa Lỗi Vòng lặp)
import { Spin } from "antd";
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthStore } from "@/stores/useAuthStore";

const ProtectedRoute: React.FC = () => {
  const { user, profile, loading, isLoadingProfile } = useAuthStore();
  const location = useLocation();

  // 1. Đang kiểm tra Session (Lần đầu tải App)
  if (loading || isLoadingProfile) {
    return (
      // SỬA LỖI 1: Dùng prop 'fullscreen'
      <Spin
        spinning={true}
        tip="Đang tải phiên làm việc..."
        size="large"
        fullscreen
      />
    );
  }

  // 2. Không có User -> Đá về /login
  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // 3. Đã có User VÀ Profile (Logic Onboarding V400)
  if (profile) {
    // SỬA LỖI VÒNG LẶP: Dùng "if... else if..."

    // BƯỚC 3 & 4: (profile_updated_at IS NULL)
    if (profile.profile_updated_at === null) {
      // Nếu họ cố tình vào App (vd: /dashboard)
      if (
        location.pathname !== "/onboarding/update-password" &&
        location.pathname !== "/onboarding/update-profile" // Cho phép ở trang con
      ) {
        return <Navigate to="/onboarding/update-password" replace />;
      }
    }

    // BƯỚC 5: (status = 'pending_approval')
    // Chỉ kiểm tra nếu Bước 3 đã xong
    else if (profile.status === "pending_approval") {
      if (location.pathname !== "/onboarding/pending-approval") {
        return <Navigate to="/onboarding/pending-approval" replace />;
      }
    }

    // BƯỚC 6: (status = 'active')
    // Nếu User đã được duyệt, nhưng cố tình vào trang Onboarding
    else if (
      profile.status === "active" &&
      location.pathname.startsWith("/onboarding")
    ) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // 4. Mọi thứ OK -> Cho phép vào (MainLayout hoặc OnboardingLayout)
  return <Outlet />;
};

export default ProtectedRoute;
