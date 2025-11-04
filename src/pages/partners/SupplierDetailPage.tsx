// src/pages/partners/SupplierDetailPage.tsx
import {
  InfoCircleOutlined,
  SaveOutlined,
  CloseCircleOutlined,
  EditOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  BankOutlined,
  FileTextOutlined,
  SwapOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import {
  Input,
  Button,
  Card,
  Typography,
  Select,
  Row,
  Col,
  Space,
  InputNumber,
  Divider,
  Affix,
  Form,
  App as AntApp,
  Spin,
  Tabs,
} from "antd";
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useSupplierStore } from "@/stores/supplierStore";

const { Title, Text } = Typography;
const { Option } = Select;

const SupplierDetailPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const { message: antMessage } = AntApp.useApp();

  const handleCancel = () => {
    // (Nếu đang ở chế độ Sửa và Form đang bật) -> Khóa form lại và reset
    if (isEditing && !formDisabled) {
      setFormDisabled(true);
      form.setFieldsValue(currentSupplier);
    } else {
      // (Nếu đang ở chế độ Thêm mới) -> Quay về danh sách
      navigate("/partners");
    }
  };

  const {
    currentSupplier,
    loadingDetails,
    getSupplierDetails,
    addSupplier,
    updateSupplier,
  } = useSupplierStore();

  // Quyết định xem đây là trang "Thêm" (id=undefined) hay "Sửa"
  const isEditing = !!id;
  // State để bật/tắt chế độ chỉnh sửa trên form
  const [formDisabled, setFormDisabled] = useState(isEditing);

  // Tải dữ liệu chi tiết nếu là trang "Sửa"
  useEffect(() => {
    if (isEditing) {
      getSupplierDetails(Number(id));
    }
  }, [isEditing, id, getSupplierDetails]);

  // Điền dữ liệu vào form sau khi tải xong
  useEffect(() => {
    if (isEditing && currentSupplier) {
      form.setFieldsValue(currentSupplier);
    } else {
      form.resetFields();
    }
  }, [isEditing, currentSupplier, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      let success = false;

      if (isEditing) {
        success = await updateSupplier(Number(id), values);
        if (success) antMessage.success("Cập nhật thành công!");
        setFormDisabled(true); // Khóa form lại
      } else {
        const newSupplier = await addSupplier(values);
        if (newSupplier) {
          antMessage.success("Thêm mới thành công!");
          navigate(`/partners/edit/${newSupplier}`); // Chuyển sang trang Sửa
        }
      }

      if (!success) {
        antMessage.error("Thao tác thất bại. Vui lòng thử lại.");
      }
    } catch (info) {
      console.log("Validate Failed:", info);
    }
  };

  return (
    <Spin spinning={loadingDetails} tip="Đang tải dữ liệu...">
      <Card styles={{ body: { padding: 12 } }}>
        {/* Header của trang chi tiết */}
        <Row
          justify="space-between"
          align="middle"
          style={{ marginBottom: 24 }}
        >
          <Col>
            <Title level={4} style={{ margin: 0 }}>
              {isEditing
                ? `Chi tiết NCC: ${currentSupplier?.name || `(ID: ${id})`}`
                : "Thêm Nhà Cung Cấp Mới"}
            </Title>
          </Col>
          <Col>
            <Space>
              <Button type="default" onClick={() => navigate("/partners")}>
                Về danh sách
              </Button>
              {isEditing && formDisabled ? (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => setFormDisabled(false)}
                >
                  Chỉnh sửa
                </Button>
              ) : null}
            </Space>
          </Col>
        </Row>

        <Form
          form={form}
          layout="vertical"
          disabled={formDisabled ? isEditing : undefined}
        >
          <Tabs type="card">
            {/* TAB 1: THÔNG TIN CHUNG (LÁT CẮT 1) */}
            <Tabs.TabPane
              tab={
                <Space>
                  <InfoCircleOutlined /> Thông tin chung
                </Space>
              }
              key="info"
            >
              <Card bordered={false}>
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      name="name"
                      label="Tên Nhà Cung Cấp"
                      rules={[{ required: true }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="tax_code" label="Mã số thuế">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="address" label="Địa chỉ">
                      <Input.TextArea rows={2} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="contact_person" label="Người liên hệ">
                      <Input prefix={<UserOutlined />} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="phone"
                      label="Số điện thoại"
                      rules={[{ required: true }]}
                    >
                      <Input prefix={<PhoneOutlined />} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="email" label="Email">
                      <Input prefix={<MailOutlined />} />
                    </Form.Item>
                  </Col>
                </Row>
                <Divider orientation="left" plain>
                  Thông tin Tài chính & Vận hành
                </Divider>
                <Row gutter={24}>
                  <Col span={8}>
                    <Form.Item name="bank_account" label="Số Tài khoản TT">
                      <Input prefix={<BankOutlined />} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="bank_name" label="Ngân hàng">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="bank_holder" label="Chủ Tài khoản">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="payment_term"
                      label="Điều khoản Thanh toán"
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="delivery_method"
                      label="Hình thức Giao hàng"
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="lead_time"
                      label="Thời gian Giao hàng (ngày)"
                    >
                      <InputNumber
                        min={0}
                        style={{ width: "100%" }}
                        addonAfter="ngày"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="status"
                      label="Trạng thái"
                      rules={[{ required: true }]}
                      initialValue="active"
                    >
                      <Select>
                        <Option value="active">Đang hợp tác</Option>
                        <Option value="inactive">Ngừng hợp tác</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="notes" label="Ghi chú">
                  <Input.TextArea rows={3} />
                </Form.Item>
              </Card>
            </Tabs.TabPane>

            {/* CÁC TAB KHÁC (THEO LỘ TRÌNH TINH GỌN) */}
            <Tabs.TabPane
              tab={
                <Space>
                  <FileTextOutlined /> Hợp đồng & CTKM
                </Space>
              }
              key="contracts"
              disabled
            >
              <Text type="secondary">Tính năng đang được phát triển.</Text>
            </Tabs.TabPane>
            <Tabs.TabPane
              tab={
                <Space>
                  <SwapOutlined /> Ánh xạ Sản phẩm
                </Space>
              }
              key="mapping"
              disabled
            >
              <Text type="secondary">Tính năng đang được phát triển.</Text>
            </Tabs.TabPane>
            <Tabs.TabPane
              tab={
                <Space>
                  <HistoryOutlined /> Lịch sử Nhập hàng
                </Space>
              }
              key="history"
              disabled
            >
              <Text type="secondary">Tính năng đang được phát triển.</Text>
            </Tabs.TabPane>
          </Tabs>

          {/* Thanh Action (Nút bấm) */}
          {!isEditing || (isEditing && !formDisabled) ? (
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
                  <Button icon={<CloseCircleOutlined />} onClick={handleCancel}>
                    Hủy
                  </Button>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={loadingDetails}
                  >
                    Lưu thay đổi
                  </Button>
                </Space>
              </Card>
            </Affix>
          ) : null}
        </Form>
      </Card>
    </Spin>
  );
};

export default SupplierDetailPage;
