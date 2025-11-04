// src/router/index.tsx
import { Navigate, type RouteObject } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute"; // <-- MỚI: Import "Bảo vệ"

import BlankLayout from "@/components/layouts/BlankLayout";
import MainLayout from "@/components/layouts/MainLayout";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import ProductFormPage from "@/pages/inventory/ProductFormPage";
import ProductListPage from "@/pages/inventory/ProductListPage";

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
            index: true, // Đây là /
            element: <div>TRANG DASHBOARD CHÍNH (Trang chủ)</div>,
          },
          {
            path: "store", // /store
            element: <div>Chức năng Cửa Hàng đang được phát triển</div>,
          },
          {
            path: "medical", // /medical
            element: <div>Chức năng Nghiệp vụ Y Tế đang được phát triển</div>,
          },
          {
            path: "b2b", // /b2b
            element: <div>Chức năng Bán buôn đang được phát triển</div>,
          },
          {
            path: "inventory", // /inventory
            element: <ProductListPage />,
          },
          {
            path: "inventory/new", // Trang "Thêm"
            element: <ProductFormPage />,
          },
          {
            path: "inventory/edit/:id", // Trang "Sửa"
            element: <ProductFormPage />,
          },
          {
            path: "partners", // /partners
            element: <div>Chức năng Đối tác đang được phát triển</div>,
          },
          {
            path: "crm", // /crm
            element: (
              <div>Chức năng Quản lý Khách hàng đang được phát triển</div>
            ),
          },
          {
            path: "marketing", // /marketing
            element: (
              <div>Chức năng Quản lý Marketing đang được phát triển</div>
            ),
          },
          {
            path: "hr", // /hr
            element: <div>Chức năng Quản lý Nhân sự đang được phát triển</div>,
          },
          {
            path: "finance", // /finance
            element: (
              <div>Chức năng Tài Chính & Kế Toán đang được phát triển</div>
            ),
          },
          {
            path: "reports", // /reports
            element: <div>Chức năng Báo Cáo đang được phát triển</div>,
          },
          {
            path: "settings", // /settings
            element: (
              <div>Chức năng Cấu hình hệ thống đang được phát triển</div>
            ),
          },
          {
            path: "products", // (Vẫn giữ link /products cũ Sếp đã tạo)
            element: <div>TRANG QUẢN LÝ SẢN PHẨM</div>,
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
