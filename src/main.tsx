// src/main.tsx
import 'regenerator-runtime/runtime'; // <--- [BẮT BUỘC] THÊM DÒNG NÀY ĐẦU TIÊN
import "@ant-design/v5-patch-for-react-19";
import { ConfigProvider, App as AntApp } from "antd";
import viVN from "antd/locale/vi_VN";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.tsx";
import "antd/dist/reset.css";
import "./app/styles/globals.css";
import "dayjs/locale/vi";

// --- MỚI: Import Context ---
import { AuthProvider } from "@/app/contexts/AuthProvider";
import { NotificationProvider } from "@/app/contexts/NotificationContext";
import { PermissionGate } from "@/app/providers/PermissionGate";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* Bọc AuthProvider ở đây để quản lý phiên đăng nhập toàn cục */}
      <AuthProvider>
        <ConfigProvider
          locale={viVN}
          theme={{
            token: {
              colorPrimary: "#00b96b",
              borderRadius: 4,
            },
          }}
        >
          {/* Bọc NotificationProvider trong ConfigProvider để ăn theo Theme */}
          <NotificationProvider>
          <PermissionGate>
            <AntApp>
              <App />
            </AntApp>
          </PermissionGate>
          </NotificationProvider>
        </ConfigProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
