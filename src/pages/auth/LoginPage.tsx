// src/pages/auth/LoginPage.tsx
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, Typography } from "antd";
import { Link } from "react-router-dom"; // Dùng để liên kết sang trang Đăng ký

const { Title } = Typography;

const LoginPage = () => {
  const onFinish = (values: any) => {
    console.log("Received values of form: ", values);
    // SENKO: Em sẽ kết nối logic Supabase Auth ở đây
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "#f0f2f5",
      }}
    >
      <Card style={{ width: 400, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={2}>NAM VIỆT EMS</Title>
          <Typography.Text type="secondary">
            Đăng nhập để vào hệ thống
          </Typography.Text>
        </div>

        <Form name="login-form" layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="email"
            rules={[{ required: true, message: "Vui lòng nhập Email!" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Email" size="large" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: "Vui lòng nhập Mật khẩu!" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Mật khẩu"
              size="large"
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large">
              Đăng nhập
            </Button>
          </Form.Item>
          <div style={{ textAlign: "center" }}>
            <Typography.Text type="secondary">
              Chưa có tài khoản?
            </Typography.Text>{" "}
            <Link to="/auth/register">Đăng ký ngay!</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
