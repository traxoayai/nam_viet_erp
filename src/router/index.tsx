// src/router/index.tsx
import { Navigate, type RouteObject } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute"; // <-- MỚI: Import "Bảo vệ"

import BlankLayout from "@/components/layouts/BlankLayout";
import MainLayout from "@/components/layouts/MainLayout";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";

const routes: RouteObject[] = [
  // === Layout Chính (ĐƯỢC BẢO VỆ) ===
  {
    path: "/",
    element: <ProtectedRoute />, // <-- MỚI: Bọc bằng "Bảo vệ"
    children: [
      {
        element: <MainLayout />, // Layout lồng bên trong
        children: [
          {
            index: true,
            element: <div>TRANG DASHBOARD CHÍNH (ĐÃ ĐƯỢC BẢO VỆ)</div>,
          },
          {
            path: "products",
            element: <div>TRANG QUẢN LÝ SẢN PHẨM (ĐÃ ĐƯỢC BẢO VỆ)</div>,
          },
        ],
      },
    ],
  },

  // === Layout Tràn Màn hình (POS - CŨNG PHẢI ĐƯỢC BẢO VỆ) ===
  {
    path: "/blank",
    element: <ProtectedRoute />, // <-- MỚI: Bọc bằng "Bảo vệ"
    children: [
      {
        element: <BlankLayout />, // Layout lồng bên trong
        children: [
          {
            path: "pos",
            element: <div>TRANG BÁN HÀNG POS (ĐÃ ĐƯỢC BẢO VỆ)</div>,
          },
        ],
      },
    ],
  },

  // === Layout Xác thực (Login/Register) ===
  {
    path: "/auth",
    element: <BlankLayout />,
    children: [
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "register",
        element: <RegisterPage />,
      },
    ],
  },

  // Chuyển hướng khi gõ sai
  {
    path: "*",
    element: <Navigate to="/" replace />, // Mặc định vào trang Dashboard (sẽ bị "Bảo vệ" chặn nếu chưa login)
  },
];

export default routes;
