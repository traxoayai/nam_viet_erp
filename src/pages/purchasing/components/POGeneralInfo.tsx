// src/pages/purchasing/components/POGeneralInfo.tsx
import {
  UserOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  CarOutlined, // [UNCOMMENT] Import thêm icon xe
} from "@ant-design/icons";
import {
  Card,
  Form,
  Select,
  DatePicker,
  Input,
  InputNumber,
  Row,
  Col,
  Typography,
  Space,
  Tag,
} from "antd";
import React from "react";

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

interface Props {
  suppliers: any[];
  supplierInfo: any;
  onSupplierChange: (id: number) => void;
  onShippingFeeChange: (val: number | null) => void;
  shippingPartners?: any[];
  onPartnerChange?: (partnerId: number) => void;
  form?: any;
}

const POGeneralInfo: React.FC<Props> = ({
  suppliers,
  supplierInfo,
  onSupplierChange,
  onShippingFeeChange,
  shippingPartners = [],
  onPartnerChange,
  form,
}) => {
  return (
    <div style={{ marginBottom: 16 }}>
      {/* --- Thông tin NCC (fullwidth) --- */}
      <Card
        title={<span><UserOutlined /> Thông tin NCC</span>}
        size="small"
        styles={{ body: { padding: 12 } }}
        style={{ marginBottom: 12 }}
        id="section-supplier"
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="supplier_id"
              label="Nhà Cung Cấp"
              rules={[{ required: true, message: "Chọn NCC" }]}
              style={{ marginBottom: 0 }}
            >
              <Select
                placeholder="Tìm và chọn NCC..."
                showSearch
                optionFilterProp="children"
                onChange={onSupplierChange}
                allowClear
              >
                {suppliers.map((s) => (
                  <Option key={s.id} value={s.id}>
                    {s.name} - {s.phone}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            {supplierInfo && (
              <div style={{ padding: 8, background: "#f9f9f9", borderRadius: 6, border: "1px solid #f0f0f0", fontSize: 13, height: "100%" }}>
                <Space direction="vertical" size={4} style={{ width: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Text strong><UserOutlined /> {supplierInfo.contact_person || "Chưa có tên LH"}</Text>
                    <Text><PhoneOutlined /> {supplierInfo.phone}</Text>
                  </div>
                  <div>
                    <EnvironmentOutlined /> <Text type="secondary">{supplierInfo.address || "Chưa cập nhật"}</Text>
                  </div>
                  <div style={{ marginTop: 4, borderTop: "1px dashed #ddd", paddingTop: 4 }}>
                    <Space>
                      <Tag color="blue">Công nợ:</Tag>
                      <Text type="danger" strong>{supplierInfo.current_debt ? Number(supplierInfo.current_debt).toLocaleString() : 0} ₫</Text>
                    </Space>
                  </div>
                </Space>
              </div>
            )}
          </Col>
        </Row>
      </Card>

      {/* --- Vận chuyển + Ghi chú (fullwidth, 70/30 split) --- */}
      <Card
        title={<span><CarOutlined /> Vận chuyển</span>}
        size="small"
        styles={{ body: { padding: 12 } }}
        id="section-shipping"
      >
        <Row gutter={16}>
          {/* Bên trái 70%: các trường vận chuyển */}
          <Col xs={24} md={17}>
            <Row gutter={12}>
              <Col xs={24} md={8}>
                <Form.Item name="delivery_method" label="Hình thức giao" style={{ marginBottom: 8 }}>
                  <Select
                    placeholder="Chọn hình thức"
                    onChange={() => form?.setFieldsValue({ shipping_partner_id: undefined })}
                  >
                    <Select.Option value="self_shipping">Tự giao / Xe cá nhân</Select.Option>
                    <Select.Option value="internal">Xe nội bộ</Select.Option>
                    <Select.Option value="app">App Công nghệ</Select.Option>
                    <Select.Option value="coach">Nhà xe / Chành</Select.Option>
                    <Select.Option value="supplier">NCC Giao</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item noStyle shouldUpdate={(prev, curr) => prev.delivery_method !== curr.delivery_method}>
                  {({ getFieldValue }) => {
                    const method = getFieldValue("delivery_method");
                    const filtered = shippingPartners.filter((p) => p.type === method);
                    const isDisabled = method === "internal" || method === "supplier";
                    return (
                      <Form.Item name="shipping_partner_id" label="Đối tác VC" style={{ marginBottom: 8 }}>
                        <Select placeholder="Chọn đối tác..." allowClear disabled={isDisabled} onChange={onPartnerChange}>
                          {filtered.map((p) => (
                            <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    );
                  }}
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="expected_delivery_date" label="Ngày giao dự kiến" style={{ marginBottom: 8 }}>
                  <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" placeholder="Chọn ngày..." />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              <Col xs={12} md={8}>
                <Form.Item name="total_packages" label="Số kiện" style={{ marginBottom: 0 }}>
                  <InputNumber placeholder="SL" style={{ width: "100%" }} min={0} />
                </Form.Item>
              </Col>
              <Col xs={12} md={8}>
                <Form.Item name="shipping_fee" label="Phí VC dự kiến" initialValue={0} style={{ marginBottom: 0 }}>
                  <InputNumber<number>
                    style={{ width: "100%" }}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                    parser={(v) => v!.replace(/\$\s?|(,*)/g, "") as unknown as number}
                    addonAfter="₫"
                    min={0}
                    onChange={onShippingFeeChange}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Col>

          {/* Bên phải 30%: Ghi chú */}
          <Col xs={24} md={7}>
            <Form.Item name="note" label="Ghi chú" style={{ marginBottom: 0, height: "100%" }}>
              <TextArea style={{ height: "100%", minHeight: 100 }} placeholder="Nhập ghi chú cho đơn hàng..." />
            </Form.Item>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default POGeneralInfo;
