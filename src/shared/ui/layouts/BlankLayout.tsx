// src/components/layouts/BlankLayout.tsx
import { Outlet } from "react-router-dom";

const BlankLayout = () => {
  // Chỉ render trang con, không có gì bọc ngoài
  return <Outlet />;
};

export default BlankLayout;
