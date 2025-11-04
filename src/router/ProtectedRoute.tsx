// src/router/ProtectedRoute.tsx
import { Spin } from "antd";
import { Navigate, Outlet } from "react-router-dom";

import { useAuthStore } from "@/stores/authStore";

const ProtectedRoute = () => {
  const { session, loading } = useAuthStore();

  if (loading) {
    // Nếu đang kiểm tra session, hiển thị màn hình loading
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!session) {
    // Nếu không có session (chưa đăng nhập), "đá" về trang login
    return <Navigate to="/auth/login" replace />;
  }

  // Nếu đã đăng nhập, cho phép render trang
  return <Outlet />;
};

export default ProtectedRoute;
