// src/components/layouts/MainLayout.tsx
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  UserOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import {
  Layout,
  Button,
  Typography,
  Menu,
  Avatar,
  Dropdown,
  message,
} from "antd";
import React, { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";

import Logo from "@/assets/logo.png";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/stores/authStore";

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  const { user, setSession, setUser } = useAuthStore();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      message.error("Đăng xuất thất bại: " + error.message);
    } else {
      setSession(null);
      setUser(null);
      message.success("Đã đăng xuất!");
      // ProtectedRoute sẽ tự động xử lý việc chuyển hướng
    }
  };

  const menuItems = [
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Đăng xuất",
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        collapsedWidth={65}
        width={250}
        style={{ background: "#001529" }}
      >
        <div
          style={{
            height: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 600,
            fontSize: 25,
            overflow: "hidden",
          }}
        >
          {collapsed ? (
            <img
              src={Logo}
              alt="Logo"
              style={{ width: 40, height: 40, objectFit: "contain" }}
            />
          ) : (
            "Dược Nam Việt"
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={["1"]}
          items={[
            {
              key: "1",
              icon: <DashboardOutlined />,
              label: "Dashboard",
            },
            {
              key: "2",
              icon: <UserOutlined />,
              label: "Khách hàng",
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <div style={{ display: "flex", alignItems: "center", flexGrow: 1 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="menu-trigger-btn"
            />
            <Title level={4} style={{ marginBottom: 0, marginLeft: 16 }}>
              Dashboard
            </Title>
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            {/* === ĐÂY LÀ DÒNG SỬA LỖI B === */}
            {/* Thay thế <a> bằng <Button> để chuẩn jsx-a11y */}
            <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
              <Button type="text" style={{ height: "auto", padding: "0 8px" }}>
                <Avatar icon={<UserOutlined />} />
                <span style={{ marginLeft: 8, fontWeight: 500, color: "#333" }}>
                  {user?.email || "User"}
                </span>
              </Button>
            </Dropdown>
            {/* ------------------------------------------- */}
          </div>
        </Header>
        <Content className="app-content-layout">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
