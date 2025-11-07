// src/pages/settings/CompanyInfoPage.tsx
import {
  InfoCircleOutlined,
  SaveOutlined,
  UploadOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  GlobalOutlined,
  BookOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import {
  Input,
  Button,
  Card,
  Typography,
  Row,
  Col,
  Space,
  Affix,
  Form,
  App as AntApp,
  Spin,
  Upload,
} from "antd";
import React, { useState, useEffect } from "react";

import type { UploadProps, UploadFile } from "antd";

// --- NÂNG CẤP V400: Import đúng service ---
import { supabase } from "@/lib/supabaseClient";
import { uploadFile } from "@/services/storageService"; // Dùng service chung

// Định nghĩa kiểu dữ liệu cho thông tin công ty
interface CompanyInfo {
  companyName: string;
  taxCode: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  legalRepresentative: string;
  logoUrl: string;
  tamNhin: string;
  suMenh: string;
}

// Key để lưu trong CSDL
const SETTINGS_KEY = "company_info";
// Tên kho (bucket) an toàn cho tài sản hệ thống
const BUCKET_NAME = "system_assets";

const CompanyInfoPage: React.FC = () => {
  const [form] = Form.useForm();
  const { message: antMessage } = AntApp.useApp();
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // 1. Tải dữ liệu khi mở trang (Giữ nguyên)
  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", SETTINGS_KEY)
          .single();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        if (data && data.value) {
          const info = data.value as CompanyInfo;
          form.setFieldsValue(info);
          setLogoPreview(info.logoUrl || null);
          if (info.logoUrl) {
            setFileList([
              {
                uid: "-1",
                name: "logo.png",
                status: "done",
                url: info.logoUrl,
              },
            ]);
          }
        }
      } catch (error: any) {
        antMessage.error(`Lỗi khi tải thông tin: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [form, antMessage]);

  // 2. Xử lý lưu (UPSERT) - ĐÃ NÂNG CẤP
  const onFinish = async (values: CompanyInfo) => {
    setLoading(true);
    antMessage.loading({ content: "Đang lưu...", key: "save" });
    try {
      const finalValues = { ...values, logoUrl: logoPreview || "" };

      // 2a. Nếu người dùng chọn file mới
      if (fileList.length > 0 && fileList[0].originFileObj) {
        antMessage.loading({ content: "Đang tải logo...", key: "upload" });

        // --- NÂNG CẤP V400: Dùng đúng service và đúng bucket ---
        const newLogoUrl = await uploadFile(
          fileList[0].originFileObj as File,
          BUCKET_NAME // Tải lên kho "system_assets"
        );
        // -----------------------------------------------------

        finalValues.logoUrl = newLogoUrl;
        setLogoPreview(newLogoUrl);
        antMessage.success({ content: "Tải logo thành công!", key: "upload" });
      }

      // 2b. Lưu vào Supabase (Upsert)
      const { error } = await supabase
        .from("system_settings")
        .upsert({ key: SETTINGS_KEY, value: finalValues });

      if (error) throw error;

      antMessage.success({ content: "Lưu thông tin thành công!", key: "save" });
    } catch (error: any) {
      antMessage.error({ content: `Lỗi: ${error.message}`, key: "save" });
    } finally {
      setLoading(false);
    }
  };

  // 3. Xử lý Upload của AntD (Giữ nguyên)
  const uploadProps: UploadProps = {
    listType: "picture-card",
    fileList: fileList,
    maxCount: 1,
    beforeUpload: (file) => {
      const isJpgOrPng =
        file.type === "image/jpeg" || file.type === "image/png";
      if (!isJpgOrPng) {
        antMessage.error("Chỉ cho phép file JPG/PNG!");
        return Upload.LIST_IGNORE;
      }
      const isLt2M = file.size / 1024 / 1024 < 2;
      if (!isLt2M) {
        antMessage.error("Ảnh phải nhỏ hơn 2MB!");
        return Upload.LIST_IGNORE;
      }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        setLogoPreview(reader.result as string);
        setFileList([
          {
            uid: file.uid,
            name: file.name,
            status: "done",
            originFileObj: file,
          },
        ]);
      };
      return false;
    },
    onRemove: () => {
      setFileList([]);
      setLogoPreview(null);
      form.setFieldsValue({ logoUrl: null });
    },
  };

  return (
    <Spin spinning={loading} tip="Đang xử lý...">
      <Card styles={{ body: { padding: 0 } }}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          {/* Header của trang */}
          <div
            style={{ padding: "12px 24px", borderBottom: "1px solid #f0f0f0" }}
          >
            {/* SỬA LỖI TRÙNG TÊN "Text" */}
            <Typography.Title level={4} style={{ margin: 0 }}>
              Thông tin Công ty (Cấu hình Chung)
            </Typography.Title>
            <Typography.Text type="secondary">
              Quản lý thông tin pháp lý và liên hệ của doanh nghiệp.
            </Typography.Text>
          </div>

          {/* CARD 1: THÔNG TIN CHUNG */}
          <Card
            bordered={false}
            title={
              <Space>
                <InfoCircleOutlined /> Thông tin Chung
              </Space>
            }
            // Thêm padding đã mất của TabPane
            style={{ padding: "0 24px", marginTop: "16px" }}
          >
            <Row gutter={24}>
              <Col xs={24} md={6} style={{ textAlign: "center" }}>
                <Form.Item name="logoUrl" hidden>
                  <Input />
                </Form.Item>
                <Upload {...uploadProps}>
                  {fileList.length === 0 && (
                    <div>
                      <UploadOutlined />
                      <div style={{ marginTop: 8 }}>Tải Logo</div>
                    </div>
                  )}
                </Upload>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  JPG/PNG. Tối đa 2MB.
                </Typography.Text>
              </Col>

              <Col xs={24} md={18}>
                <Row gutter={16}>
                  <Col xs={24} lg={12}>
                    <Form.Item
                      name="companyName"
                      label="Tên Công ty / Doanh nghiệp"
                      rules={[{ required: true }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item
                      name="taxCode"
                      label="Mã số thuế (MST)"
                      rules={[{ required: true }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item
                      name="legalRepresentative"
                      label="Người đại diện pháp luật"
                    >
                      <Input prefix={<UserOutlined />} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item name="phone" label="Số điện thoại">
                      <Input prefix={<PhoneOutlined />} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item name="email" label="Email">
                      <Input type="email" prefix={<MailOutlined />} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item name="website" label="Website">
                      <Input type="url" prefix={<GlobalOutlined />} />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item
                      name="address"
                      label="Địa chỉ đăng ký kinh doanh"
                    >
                      <Input.TextArea rows={2} />
                    </Form.Item>
                  </Col>
                </Row>
              </Col>
            </Row>
          </Card>

          {/* CARD 2: GIỚI THIỆU */}
          <Card
            bordered={false}
            title={
              <Space>
                <BookOutlined /> Giới thiệu
              </Space>
            }
            // Thêm padding đã mất của TabPane
            style={{ padding: "0 24px", marginTop: "16px" }}
          >
            <Form.Item name="tamNhin" label="Tầm nhìn (Vision)">
              <Input.TextArea
                rows={4}
                placeholder="Nhập tầm nhìn của công ty..."
              />
            </Form.Item>
            <Form.Item name="suMenh" label="Sứ mệnh (Mission)">
              <Input.TextArea
                rows={4}
                placeholder="Nhập sứ mệnh của công ty..."
              />
            </Form.Item>
          </Card>

          {/* --- KẾT THÚC PHẦN BỎ TABS --- */}

          <Affix offsetBottom={0}>
            <Card
              styles={{
                body: {
                  padding: "12px 24px",
                  textAlign: "right",
                  borderTop: "1px solid #f0f0f0",
                  background: "rgba(255,255,255,0.8)",
                  backdropFilter: "blur(5px)",
                },
              }}
            >
              <Space>
                <Button
                  icon={<CloseCircleOutlined />}
                  onClick={() => form.resetFields()}
                >
                  Hủy thay đổi
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={loading}
                >
                  Lưu thay đổi
                </Button>
              </Space>
            </Card>
          </Affix>
        </Form>
      </Card>
    </Spin>
  );
};

export default CompanyInfoPage;
