// src/pages/auth/RegisterPage.tsx
import { LockOutlined, UserOutlined, MailOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, Typography, message, Spin } from "antd";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Logo from "@/assets/logo.png"; // <-- MỚI: Import logo
import { supabase } from "@/shared/lib/supabaseClient"; // Import "bộ đàm" Supabase

const { Title } = Typography;

const RegisterPage = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // Gọi Supabase để đăng ký
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          // Lưu Họ tên vào metadata của user
          data: {
            full_name: values.fullName,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        message.success(
          "Đăng ký thành công! Vui lòng kiểm tra email để xác thực."
        );
        navigate("/auth/login"); // Chuyển về trang login
      } else {
        throw new Error("Đăng ký không thành công, vui lòng thử lại.");
      }
    } catch (error: any) {
      message.error(error.message || "Đăng ký thất bại. Vui lòng thử lại.");
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
              Tạo tài khoản
            </Title>
            <Typography.Text type="secondary">
              Bắt đầu với Nam Việt EMS
            </Typography.Text>
          </div>

          <Form name="register-form" layout="vertical" onFinish={onFinish}>
            {/* ... Toàn bộ Form.Item giữ nguyên ... */}
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
                {
                  required: true,
                  type: "email",
                  message: "Email không hợp lệ!",
                },
              ]}
            >
              <Input
                prefix={<MailOutlined />}
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
                    return Promise.reject(
                      new Error("Hai mật khẩu không khớp!")
                    );
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
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
              >
                Đăng ký
              </Button>
            </Form.Item>
            <div style={{ textAlign: "center" }}>
              <Typography.Text type="secondary">
                Đã có tài khoản?
              </Typography.Text>{" "}
              <Link to="/auth/login">Đăng nhập ngay!</Link>
            </div>
          </Form>
        </Card>
      </Spin>
    </div>
  );
};

export default RegisterPage;
