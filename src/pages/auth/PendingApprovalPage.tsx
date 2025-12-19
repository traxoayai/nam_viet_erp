// src/pages/auth/PendingApprovalPage.tsx
import { ClockCircleOutlined, LogoutOutlined } from "@ant-design/icons";
import { Button, Card, Layout, Result, Typography } from "antd";
import React from "react";

import { useAuthStore } from "@/features/auth/stores/useAuthStore";

const { Content } = Layout;
const { Title, Paragraph } = Typography;

const PendingApprovalPage: React.FC = () => {
  const { logout, profile } = useAuthStore();

  return (
    <Layout
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f0f2f5",
      }}
    >
      <Content>
        <Card
          style={{
            width: 450,
            border: "1.5px solid #d0d7de",
            textAlign: "center",
          }}
        >
          <Result
            icon={<ClockCircleOutlined />}
            title={<Title level={3}>Hồ sơ Đang Chờ Duyệt</Title>}
            subTitle={
              <Paragraph type="secondary">
                Cảm ơn Sếp {profile?.full_name || profile?.email} đã cập nhật hồ
                sơ.
                <br />
                Tài khoản của Sếp đang chờ Quản trị viên (Admin) phê duyệt.
                <br />
                Vui lòng liên hệ Admin (SDT: 0965.63.77.88) hoặc thử đăng nhập
                lại sau.
              </Paragraph>
            }
            extra={
              <Button
                type="primary"
                icon={<LogoutOutlined />}
                onClick={logout}
                danger
                ghost
              >
                Đăng xuất
              </Button>
            }
          />
        </Card>
      </Content>
    </Layout>
  );
};

export default PendingApprovalPage;
