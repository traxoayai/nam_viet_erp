// src/pages/auth/RegisterPage.tsx
import { LockOutlined, UserOutlined, MailOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, Typography } from "antd";
import { Link } from "react-router-dom";

const { Title } = Typography;

const RegisterPage = () => {
  const onFinish = (values: any) => {
    console.log("Received values of form: ", values);
    // SENKO: Em sẽ kết nối logic Supabase Auth (Sign Up) ở đây
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
          <Title level={2}>Tạo tài khoản</Title>
          <Typography.Text type="secondary">
            Bắt đầu với Nam Việt EMS
          </Typography.Text>
        </div>

        <Form name="register-form" layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="fullName"
            rules={[{ required: true, message: "Vui lòng nhập Họ tên!" }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Họ và Tên"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="email"
            rules={[
              { required: true, type: "email", message: "Email không hợp lệ!" },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="Email" size="large" />
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

          <Form.Item
            name="confirmPassword"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Vui lòng xác nhận Mật khẩu!" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Hai mật khẩu không khớp!"));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Xác nhận Mật khẩu"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large">
              Đăng ký
            </Button>
          </Form.Item>
          <div style={{ textAlign: "center" }}>
            <Typography.Text type="secondary">Đã có tài khoản?</Typography.Text>{" "}
            <Link to="/auth/login">Đăng nhập ngay!</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default RegisterPage;
