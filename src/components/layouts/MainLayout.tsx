// src/components/layouts/MainLayout.tsx
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  UserOutlined,
} from "@ant-design/icons"; // Import icons
import { Layout, Button, Typography, Menu } from "antd"; // Import thêm
import React, { useState } from "react";
import { Outlet } from "react-router-dom";

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const MainLayout: React.FC = () => {
  // Bộ não điều khiển việc gập/mở menu
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        trigger={null} // Tắt trigger mặc định
        collapsible
        collapsed={collapsed}
        collapsedWidth={70} // "Rất mỏng" khi gập (theo yêu cầu)
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
            fontSize: 16,
          }}
        >
          {collapsed ? "NVE" : "NAM VIỆT EMS"}
        </div>

        {/* Menu điều hướng chính (Em sẽ thêm các mục menu ở đây sau) */}
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
          {" "}
          {/* Dùng class CSS tùy chỉnh */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="menu-trigger-btn"
            />
            {/* Tiêu đề trang bên trái (theo yêu cầu) */}
            <Title level={4} style={{ marginBottom: 0, marginLeft: 16 }}>
              Dashboard
            </Title>
            {/* (SENKO: Sau này em sẽ làm tiêu đề này tự động thay đổi) */}
          </div>
          {/* Em sẽ thêm Avatar và Thông báo ở đây sau */}
        </Header>
        <Content className="app-content-layout">
          <Outlet />{" "}
          {/* Nơi các trang con (Dashboard, Products...) được render */}
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
