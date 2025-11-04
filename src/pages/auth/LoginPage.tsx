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
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Logo from "@/assets/logo.png"; // <-- MỚI: Import logo
import { supabase } from "@/lib/supabaseClient"; // Import "bộ đàm" Supabase
import { useAuthStore } from "@/stores/authStore"; // Import "kho" auth

const { Title } = Typography;

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const { setSession, setUser } = useAuthStore(); // Lấy hàm để set session

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // Gọi Supabase để đăng nhập
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        throw error;
      }

      if (data.session && data.user) {
        // Lưu session vào "kho" Zustand
        setSession(data.session);
        setUser(data.user);

        message.success("Đăng nhập thành công!");
        navigate("/"); // Chuyển hướng đến Dashboard
      } else {
        throw new Error("Không nhận được thông tin session.");
      }
    } catch (error: any) {
      message.error(error.message || "Đăng nhập thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
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
            <div style={{ textAlign: "center" }}>
              <Typography.Text type="secondary">
                Chưa có tài khoản?
              </Typography.Text>{" "}
              <Link to="/auth/register">Đăng ký ngay!</Link>
            </div>
          </Form>
        </Card>
      </Spin>
    </div>
  );
};

export default LoginPage;
