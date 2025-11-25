// src/App.tsx
import { ConfigProvider, App as AntApp } from "antd";
import viVN from "antd/locale/vi_VN";
import { useEffect } from "react";
import { useRoutes } from "react-router-dom";

import routes from "./router";
import { useAuthStore } from "./stores/useAuthStore";

import { SystemSetupModal } from "@/components/common/SystemSetupModal";
import { NotificationProvider } from "@/contexts/NotificationContext";
import theme from "@/theme";

// --- MỚI: Import SystemSetupModal ---

function App() {
  const element = useRoutes(routes);
  const checkUserSession = useAuthStore((state) => state.checkUserSession);

  useEffect(() => {
    checkUserSession();
  }, []);

  return (
    <ConfigProvider locale={viVN} theme={theme}>
      <NotificationProvider>
        <AntApp>
          {/* Đặt ở đây để nó luôn kiểm tra đè lên mọi giao diện */}
          <SystemSetupModal />
          {element}
        </AntApp>
      </NotificationProvider>
    </ConfigProvider>
  );
}

export default App;
