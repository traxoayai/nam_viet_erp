// src/pages/auth/LoginPage.tsx
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Form,
  Input,
  Typography,
  Spin,
  App as AntApp,
} from "antd";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import Logo from "@/assets/logo.png"; // <-- MỚI: Import logo
// import { supabase } from "@/lib/supabaseClient"; // Import "bộ đàm" Supabase
import { useAuthStore } from "@/features/auth/stores/useAuthStore"; // SỬA LỖI: Import đúng "bộ não"

const { Title } = Typography;

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  // SỬA LỖI: Lấy hàm 'login' từ "Bộ não"
  const login = useAuthStore((state) => state.login);
  const user = useAuthStore((state) => state.user);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // SỬA LỖI: Gọi hàm login (đã bao gồm fetchProfile)
      await login(values);
      message.success("Đăng nhập thành công!"); // (Không cần navigate, Gatekeeper sẽ tự điều hướng)
      // navigate("/");
    } catch (error: any) {
      // Sửa lỗi hiển thị (Bad Request là 'Invalid login credentials')
      let errorMessage = error.message;
      if (error.message.includes("400")) {
        errorMessage = "Sai email hoặc mật khẩu. Vui lòng thử lại.";
      }
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      // Đã đăng nhập, đẩy về trang chủ (Gatekeeper sẽ xử lý tiếp)
      navigate("/");
    }
  }, [user, navigate]);

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
      <Spin spinning={loading}>
        <Card style={{ width: 400, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            {/* --- MỚI: Hiển thị Logo --- */}
            <img
              src={Logo}
              alt="Logo Dược Nam Việt"
              style={{ width: 100, marginBottom: 16 }}
            />

            <Title level={2} style={{ margin: 0 }}>
              NAM VIỆT EMS
            </Title>
            <Typography.Text type="secondary">
              Đăng nhập để vào hệ thống
            </Typography.Text>
          </div>

          <Form name="login-form" layout="vertical" onFinish={onFinish}>
            {/* ... Form.Item Email và Password giữ nguyên ... */}
            <Form.Item
              name="email"
              rules={[{ required: true, message: "Vui lòng nhập Email!" }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Email"
                size="large"
              />
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
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
              >
                Đăng nhập
              </Button>
            </Form.Item>
            {/* <div style={{ textAlign: "center" }}>
              <Typography.Text type="secondary">
                Chưa có tài khoản?
              </Typography.Text>{" "}
              <Link to="/auth/register">Đăng ký ngay!</Link>
            </div> */}
          </Form>
        </Card>
      </Spin>
    </div>
  );
};

export default LoginPage;
