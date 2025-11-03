// src/components/layouts/MainLayout.tsx
import { Layout } from "antd";
import { Outlet } from "react-router-dom";

const { Header, Sider, Content } = Layout;

const MainLayout = () => {
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={250} style={{ background: "#001529" }}>
        SIDEBAR (MENU CHÍNH)
      </Sider>
      <Layout>
        <Header style={{ background: "#fff", padding: "0 16px" }}>
          HEADER (THÔNG TIN USER, THÔNG BÁO)
        </Header>
        <Content style={{ margin: "16px", padding: 24, background: "#f5f5f5" }}>
          {/* Đây là nơi các trang con (Dashboard, Products...) sẽ được render */}
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
