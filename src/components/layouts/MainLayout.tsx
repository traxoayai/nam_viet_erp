// src/components/layouts/MainLayout.tsx
import {
  HomeOutlined,
  ShopOutlined,
  HeartOutlined,
  ShoppingCartOutlined,
  DropboxOutlined,
  ContactsOutlined,
  BulbOutlined,
  AuditOutlined,
  AccountBookOutlined,
  LineChartOutlined,
  SettingOutlined,
  BellOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
} from "@ant-design/icons";
import { Layout, Button, Menu, Avatar, Badge, Dropdown, message } from "antd";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Outlet } from "react-router-dom";

import Logo from "@/assets/logo.png";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/stores/authStore";

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

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
              key: "dashboard",
              icon: <HomeOutlined />,
              label: <Link to="/">Trang chủ</Link>,
            },
            {
              key: "store",
              icon: <ShopOutlined />,
              label: <Link to="/store">Cửa Hàng</Link>,
            },
            {
              key: "medical",
              icon: <HeartOutlined />,
              label: <Link to="/medical">Nghiệp vụ Y Tế</Link>,
            },
            {
              key: "crm",
              icon: <UserOutlined />,
              label: <Link to="/crm">Quản lý Khách hàng</Link>,
            },
            {
              key: "b2b",
              icon: <ShoppingCartOutlined />,
              label: <Link to="/b2b">Bán buôn</Link>,
            },
            {
              key: "inventory",
              icon: <DropboxOutlined />,
              label: <Link to="/inventory">Kho - Sản phẩm</Link>,
            },
            {
              key: "partners",
              icon: <ContactsOutlined />,
              label: <Link to="/partners">Đối tác</Link>,
            },

            {
              key: "marketing",
              icon: <BulbOutlined />,
              label: <Link to="/marketing">Quản lý Marketing</Link>,
            },
            {
              key: "hr",
              icon: <AuditOutlined />,
              label: <Link to="/hr">Quản lý Nhân sự</Link>,
            },
            {
              key: "finance",
              icon: <AccountBookOutlined />,
              label: <Link to="/finance">Tài Chính & Kế Toán</Link>,
            },
            {
              key: "reports",
              icon: <LineChartOutlined />,
              label: <Link to="/reports">Báo Cáo</Link>,
            },
            {
              key: "settings",
              icon: <SettingOutlined />,
              label: <Link to="/settings">Cấu hình hệ thống</Link>,
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
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            {/* --- MỚI: Nút Thông báo --- */}
            <Button
              type="text"
              shape="circle"
              icon={
                <Badge dot>
                  <BellOutlined />
                </Badge>
              }
              style={{ marginRight: 8 }}
            />
            {/* --- MỚI: Nút Avatar và Đăng Xuất --- */}
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
