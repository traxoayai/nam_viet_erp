// src/main.tsx
import "@ant-design/v5-patch-for-react-19";
import { ConfigProvider, App as AntApp } from "antd";
import viVN from "antd/locale/vi_VN";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.tsx";
import "antd/dist/reset.css";
import "./styles/globals.css";
import "dayjs/locale/vi";

// --- MỚI: Import Context ---
import { AuthProvider } from "@/contexts/AuthProvider";
import { NotificationProvider } from "@/contexts/NotificationContext";

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
            <AntApp>
              <App />
            </AntApp>
          </NotificationProvider>
        </ConfigProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
