//src/features/pos/components/modals/CustomerFormModal.tsx
import {
  UserOutlined,
  PhoneOutlined,
  HomeOutlined,
  IdcardOutlined,
  GiftOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import {
  Modal,
  Form,
  Input,
  DatePicker,
  Radio,
  Row,
  Col,
  message,
  Divider,
  Typography,
  Space,
} from "antd";
import dayjs from "dayjs";
import React, { useEffect, useState } from "react";

import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { supabase } from "@/shared/lib/supabaseClient";

const { Text } = Typography;

interface Props {
  visible: boolean;
  onCancel: () => void;
  customerToEdit?: any; // Nếu null -> Chế độ Thêm mới
  onSuccess: (customer: any) => void;
}

export const CustomerFormModal: React.FC<Props> = ({
  visible,
  onCancel,
  customerToEdit,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // [NEW] Lấy user hiện tại
  const { user } = useAuthStore();

  // [NEW] Biến theo dõi ngày sinh để tính tuổi Realtime
  const dobValue = Form.useWatch("dob", form);
  const [ageString, setAgeString] = useState("");

  // [NEW] Hàm tính tuổi chi tiết
  useEffect(() => {
    if (dobValue) {
      const now = dayjs();
      const birth = dayjs(dobValue);
      if (birth.isValid() && birth.isBefore(now)) {
        const years = now.diff(birth, "year");
        const months = now.diff(birth.add(years, "year"), "month");
        const days = now.diff(
          birth.add(years, "year").add(months, "month"),
          "day"
        );
        setAgeString(`${years} tuổi ${months} tháng ${days} ngày`);
      } else {
        setAgeString("");
      }
    } else {
      setAgeString("");
    }
  }, [dobValue]);

  // Reset hoặc Fill dữ liệu khi mở Modal
  useEffect(() => {
    if (visible) {
      if (customerToEdit) {
        form.setFieldsValue({
          ...customerToEdit,
          dob: customerToEdit.dob ? dayjs(customerToEdit.dob) : null,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ gender: "Nu", type: "CaNhan" }); // Mặc định Nữ (khách nhà thuốc đa số là nữ)
      }
    }
  }, [visible, customerToEdit, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      let data, error;

      // Narrow payload to match DB schema
      const dbPayload = {
        name: values.name as string,
        phone: values.phone as string,
        address: (values.address as string) ?? null,
        email: (values.email as string) ?? null,
        gender: (values.gender as "Nam" | "Nữ" | "Khác") ?? null,
        cccd: (values.cccd as string) ?? null,
        dob: values.dob ? (values.dob as { format: (f: string) => string }).format("YYYY-MM-DD") : null,
        allergies: (values.allergies as string) ?? null,
        medical_history: (values.medical_history as string) ?? null,
        type: "CaNhan" as const,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      };

      if (customerToEdit) {
        // UPDATE
        const res = await supabase
          .from("customers")
          .update(dbPayload)
          .eq("id", customerToEdit.id)
          .select()
          .single();
        data = res.data;
        error = res.error;
      } else {
        // INSERT
        const res = await supabase
          .from("customers")
          .insert([dbPayload])
          .select()
          .single();
        data = res.data;
        error = res.error;
      }

      if (error) throw error;

      message.success(
        customerToEdit
          ? "Cập nhật hồ sơ thành công!"
          : "Đã thêm khách hàng mới!"
      );
      onSuccess(data); // Callback ra ngoài để cập nhật UI
      onCancel();
    } catch (err: any) {
      console.error(err);
      if (err.code === "23505") {
        // Lỗi trùng unique (SĐT)
        message.error("Số điện thoại này đã tồn tại trong hệ thống!");
      } else {
        message.error("Lỗi lưu dữ liệu: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <UserOutlined style={{ color: "#1890ff" }} />
          <span>
            {customerToEdit
              ? "Cập nhật Hồ sơ Khách hàng"
              : "Thêm Khách hàng Mới"}
          </span>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      width={750}
      okText="Lưu Hồ Sơ"
      cancelText="Hủy bỏ"
      maskClosable={false}
    >
      <Form form={form} layout="vertical">
        {/* PHẦN 1: THÔNG TIN LIÊN HỆ CƠ BẢN */}
        <div style={{ marginBottom: 16 }}>
          <Text strong type="secondary" style={{ fontSize: 12 }}>
            I. THÔNG TIN ĐỊNH DANH
          </Text>
          <Divider style={{ margin: "8px 0 16px 0" }} />

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="Số điện thoại (Bắt buộc)"
                rules={[
                  { required: true, message: "Cần SĐT để tích điểm & tra cứu" },
                ]}
              >
                <Input
                  prefix={<PhoneOutlined className="text-gray-400" />}
                  placeholder="09..."
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Họ và Tên khách hàng"
                rules={[{ required: true, message: "Vui lòng nhập tên khách" }]}
              >
                <Input
                  prefix={<UserOutlined className="text-gray-400" />}
                  placeholder="VD: Nguyễn Văn A"
                  size="large"
                  style={{ textTransform: "capitalize" }}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item name="gender" label="Giới tính">
                <Radio.Group buttonStyle="solid">
                  <Radio.Button value="Nam">Nam</Radio.Button>
                  <Radio.Button value="Nu">Nữ</Radio.Button>
                  <Radio.Button value="Khac">Khác</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="dob"
                label={
                  <Space>
                    <GiftOutlined /> Ngày sinh
                  </Space>
                }
                help={
                  ageString ? (
                    <span style={{ color: "#096dd9", fontWeight: 600 }}>
                      👉 {ageString}
                    </span>
                  ) : null
                } // [NEW] Hiển thị tuổi ở đây
              >
                <DatePicker
                  style={{ width: "100%" }}
                  format="DD/MM/YYYY"
                  placeholder="Chọn ngày sinh"
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item name="address" label="Địa chỉ">
                <Input
                  prefix={<HomeOutlined className="text-gray-400" />}
                  placeholder="Số nhà, Phường/Xã... Gửi quà tặng khi có dịp sinh nhật"
                />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* PHẦN 2: THÔNG TIN PHÁP LÝ & Y TẾ (QUAN TRỌNG) */}
        <div
          style={{
            backgroundColor: "#f9f9f9",
            padding: 16,
            borderRadius: 8,
            border: "1px dashed #d9d9d9",
          }}
        >
          <Text strong type="secondary" style={{ fontSize: 12 }}>
            II. THÔNG TIN Y TẾ & PHÁP LÝ (CRM)
          </Text>
          <Divider style={{ margin: "8px 0 16px 0" }} />

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="cccd"
                label={
                  <Space>
                    <IdcardOutlined /> Số CCCD / MST
                  </Space>
                }
                extra={
                  <span style={{ fontSize: 11, color: "#888" }}>
                    👉 Dùng khi khách cần xuất hóa đơn đỏ (VAT) hoặc làm hồ sơ
                    BHXH.
                  </span>
                }
              >
                <Input placeholder="Nhập số CCCD..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email (Nhận hóa đơn điện tử)">
                <Input placeholder="khachhang@email.com" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="allergies"
                label={
                  <Space>
                    <SafetyCertificateOutlined style={{ color: "red" }} />{" "}
                    <span style={{ color: "red" }}>Dị ứng thuốc/thực phẩm</span>
                  </Space>
                }
                extra="⚠️ Rất quan trọng! Hỏi kỹ để tránh sốc phản vệ."
              >
                <Input.TextArea
                  rows={2}
                  placeholder="VD: Dị ứng Penicillin, Tôm, Phấn hoa..."
                  style={{ backgroundColor: "#fff1f0", borderColor: "#ffa39e" }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="medical_history"
                label="Bệnh nền / Mãn tính"
                extra="Hỗ trợ tư vấn thuốc phù hợp thể trạng."
              >
                <Input.TextArea
                  rows={2}
                  placeholder="VD: Cao huyết áp, Tiểu đường tuýp 2, Dạ dày..."
                />
              </Form.Item>
            </Col>
          </Row>
        </div>
      </Form>
    </Modal>
  );
};
