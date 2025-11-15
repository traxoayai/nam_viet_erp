// src/App.tsx
import { ConfigProvider, App as AntApp } from "antd"; // <-- SỬA LỖI: Thêm AntApp
import viVN from "antd/locale/vi_VN"; // (Sếp đã có file này)
import { useEffect } from "react";
import { useRoutes } from "react-router-dom";

import routes from "./router";
import { useAuthStore } from "./stores/useAuthStore";

import theme from "@/theme"; // (Sếp đã có file này)

// Xóa: import { supabase } from "@/lib/supabaseClient";
// (Vì App.tsx không cần gọi Supabase trực tiếp nữa)

function App() {
  const element = useRoutes(routes);
  const checkUserSession = useAuthStore((state) => state.checkUserSession);

  useEffect(() => {
    // 1. Chỉ gọi 1 lần duy nhất khi App tải
    checkUserSession(); // SỬA LỖI 2: Thêm mảng dependencies rỗng
  }, []); // SỬA LỖI 1: Xóa toàn bộ logic 'supabase.auth.onAuthStateChange'
  // (Vì nó đã được chuyển vào bên trong 'useAuthStore.ts' ở [Mục 124])
  // SỬA LỖI 3: (Từ [Mục 126]) Bọc AntApp và ConfigProvider

  return (
    <ConfigProvider locale={viVN} theme={theme}>
      <AntApp>{element}</AntApp>   
    </ConfigProvider>
  );
}

export default App;
