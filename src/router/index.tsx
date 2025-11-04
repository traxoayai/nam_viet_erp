// src/router/index.tsx
import { Navigate, type RouteObject } from "react-router-dom";

// Import 2 loại layout của chúng ta
import BlankLayout from "@/components/layouts/BlankLayout"; //Khi cần mở 1 giao diện không cần có MenuBar và HeaderBar
import MainLayout from "@/components/layouts/MainLayout"; //Giao diện có MenuBar và HeaderBar
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";

// Import các trang (chúng ta sẽ tạo sau)
// import DashboardPage from "@/pages/DashboardPage";
// import PosPage from "@/pages/PosPage";
// import LoginPage from "@/pages/LoginPage";

const routes: RouteObject[] = [
  // === Layout Chính (Có Sidebar/Header) ===
  // Tất cả các trang con bên trong sẽ được "bọc" bởi MainLayout
  {
    path: "/",
    element: <MainLayout />,
    children: [
      {
        index: true,
        // element: <DashboardPage />,
        element: <div>TRANG DASHBOARD CHÍNH</div>, // Tạm thời
      },
      {
        path: "products",
        element: <div>TRANG QUẢN LÝ SẢN PHẨM</div>, // Tạm thời
      },
      // Thêm các trang dùng layout chính khác ở đây
    ],
  },

  // === Layout Tràn Màn hình (Không Sidebar/Header) ===
  // Dùng cho các trang cần sự tập trung tuyệt đối
  {
    path: "/blank", // Sếp có thể đổi tên (ví dụ: /fullscreen)
    element: <BlankLayout />,
    children: [
      {
        path: "pos",
        // element: <PosPage />,
        element: <div>TRANG BÁN HÀNG POS (TRÀN MÀN HÌNH)</div>, // Tạm thời
      },
    ],
  },

  // === Layout Xác thực (Login/Register) ===
  {
    path: "/auth",
    element: <BlankLayout />, // Dùng layout trống
    children: [
      {
        path: "login",
        element: <LoginPage />, // Trang thật
      },
      {
        path: "register",
        element: <RegisterPage />, // Trang thật
      },
    ],
  },

  // Chuyển hướng khi gõ sai đường dẫn
  {
    path: "*",
    element: <Navigate to="/auth/login" replace />, //Mặc định vào trang Login
  },
];

export default routes;
