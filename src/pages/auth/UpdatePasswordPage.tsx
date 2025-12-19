// src/pages/auth/UpdatePasswordPage.tsx
import { LockOutlined, SaveOutlined } from "@ant-design/icons";
import {
  Form,
  Input,
  Button,
  Card,
  Layout,
  Typography,
  App as AntApp,
} from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "@/features/auth/stores/useAuthStore";

const { Title, Paragraph } = Typography;
const { Content } = Layout;

const UpdatePasswordPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { message: antMessage } = AntApp.useApp();
  const { updatePassword, user } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const handleFinish = async (values: any) => {
    setLoading(true);
    const msgKey = "update_pass";
    antMessage.loading({ content: "Đang cập nhật...", key: msgKey });

    try {
      await updatePassword(values.newPassword);
      antMessage.success({
        content: "Đổi mật khẩu thành công! Vui lòng cập nhật hồ sơ.",
        key: msgKey,
      });

      // BƯỚC 4: Chuyển sang Cập nhật Profile
      navigate("/onboarding/update-profile", { replace: true });
    } catch (error: any) {
      console.error("Lỗi đổi mật khẩu:", error);
      antMessage.error({ content: `Lỗi: ${error.message}`, key: msgKey });
      setLoading(false);
    }
  };

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
        <Card style={{ width: 450, border: "1.5px solid #d0d7de" }}>
          <Title level={3} style={{ textAlign: "center" }}>
            Cập nhật Mật khẩu Mới
          </Title>
          <Paragraph
            type="secondary"
            style={{ textAlign: "center", marginBottom: 24 }}
          >
            Chào mừng {user?.email}.<br />
            Đây là lần đăng nhập đầu tiên, Sếp vui lòng tạo mật khẩu mới.
          </Paragraph>
          <Form form={form} layout="vertical" onFinish={handleFinish}>
            <Form.Item
              name="newPassword"
              label="Mật khẩu mới"
              rules={[
                { required: true, message: "Vui lòng nhập mật khẩu!" },
                { min: 6, message: "Mật khẩu phải có ít nhất 6 ký tự!" },
              ]}
              hasFeedback
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Ít nhất 6 ký tự"
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="Xác nhận Mật khẩu mới"
              dependencies={["newPassword"]}
              hasFeedback
              rules={[
                { required: true, message: "Vui lòng xác nhận mật khẩu!" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("newPassword") === value) {
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
                placeholder="Nhập lại mật khẩu mới"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<SaveOutlined />}
                block
              >
                Lưu Mật khẩu và Tiếp tục
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Content>
    </Layout>
  );
};

export default UpdatePasswordPage;
