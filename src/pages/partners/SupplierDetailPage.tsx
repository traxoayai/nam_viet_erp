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

import { useSupplierStore } from "@/features/purchasing/stores/supplierStore";
import { useBankStore } from "@/features/finance/stores/useBankStore"; // <-- MỚI: Import Bank Store

const { Title, Text } = Typography;
const { Option } = Select;

const SupplierDetailPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const { message: antMessage } = AntApp.useApp();

  // Lấy dữ liệu từ Supplier Store
  const {
    currentSupplier,
    loadingDetails,
    getSupplierDetails,
    addSupplier,
    updateSupplier,
  } = useSupplierStore();

  // Lấy dữ liệu từ Bank Store (MỚI)
  const { banks, fetchBanks } = useBankStore();

  // Quyết định xem đây là trang "Thêm" (id=undefined) hay "Sửa"
  const isEditing = !!id;
  // State để bật/tắt chế độ chỉnh sửa trên form
  const [formDisabled, setFormDisabled] = useState(isEditing);

  // Danh sách chuẩn hóa các hình thức giao hàng
  const DELIVERY_METHODS = [
    {
      value: "Xe khách/Chành xe",
      label: "Xe khách / Chành xe (Cần ra bến lấy)",
    },
    { value: "NCC tự giao", label: "NCC tự giao hàng (Freeship)" },
    {
      value: "Dịch vụ vận chuyển",
      label: "Dịch vụ vận chuyển (Viettel/GHTK...)",
    },
    { value: "Xe nhà (Tự lấy)", label: "Xe công ty đi lấy (Tự lấy)" },
  ];

  // 1. Tải danh sách Ngân hàng ngay khi vào trang (MỚI)
  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  // 2. Tải dữ liệu chi tiết nếu là trang "Sửa"
  useEffect(() => {
    if (isEditing) {
      getSupplierDetails(Number(id));
    }
  }, [isEditing, id, getSupplierDetails]);

  // 3. Điền dữ liệu vào form sau khi tải xong
  useEffect(() => {
    if (isEditing && currentSupplier) {
      form.setFieldsValue(currentSupplier);
    } else {
      form.resetFields();
      form.setFieldsValue({
        status: "active",
        lead_time: 0,
        payment_term: "Thanh toán ngay",
      });
    }
  }, [isEditing, currentSupplier, form]);

  const handleCancel = () => {
    if (isEditing && !formDisabled) {
      setFormDisabled(true);
      form.setFieldsValue(currentSupplier);
    } else {
      navigate("/partners");
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      let success = false;

      if (isEditing) {
        success = await updateSupplier(Number(id), values);
        if (success) antMessage.success("Cập nhật thành công!");
        setFormDisabled(true);
      } else {
        const newSupplier = await addSupplier(values);
        if (newSupplier) {
          antMessage.success("Thêm mới thành công!");
          navigate(`/partners/edit/${newSupplier}`);
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
        {/* Header */}
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
            {/* TAB 1: THÔNG TIN CHUNG */}
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
                  {/* --- CẬP NHẬT: CHỌN NGÂN HÀNG TỪ DANH SÁCH --- */}
                  <Col span={8}>
                    <Form.Item
                      name="bank_name"
                      label="Ngân hàng (Thụ hưởng)"
                      tooltip="Chọn đúng ngân hàng để hỗ trợ tạo mã QR thanh toán sau này."
                    >
                      <Select
                        showSearch
                        placeholder="Chọn ngân hàng..."
                        optionFilterProp="children"
                        filterOption={(input, option) =>
                          (option?.label ?? "")
                            .toLowerCase()
                            .includes(input.toLowerCase())
                        }
                        options={banks.map((bank) => ({
                          value: bank.short_name, // Lưu tên viết tắt (VD: VCB)
                          label: `${bank.short_name} - ${bank.name}`, // Hiển thị đầy đủ
                        }))}
                        allowClear
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="bank_account" label="Số Tài khoản TT">
                      <Input prefix={<BankOutlined />} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="bank_holder" label="Chủ Tài khoản">
                      <Input />
                    </Form.Item>
                  </Col>
                  {/* --------------------------------------------- */}

                  <Col span={8}>
                    <Form.Item
                      name="payment_term"
                      label="Điều khoản Thanh toán"
                    >
                      <Input placeholder="VD: Công nợ 30 ngày" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="delivery_method"
                      label="Hình thức Giao hàng Mặc định"
                      tooltip="Hệ thống sẽ dùng thông tin này để tự động tính toán phương án vận chuyển khi tạo đơn hàng."
                    >
                      <Select
                        placeholder="Chọn hình thức..."
                        options={DELIVERY_METHODS}
                        allowClear
                      />
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

            {/* CÁC TAB KHÁC */}
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

          {/* Thanh Action */}
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
