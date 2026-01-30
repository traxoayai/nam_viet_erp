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
  TimePicker, // [UNCOMMENT] [QUAN TRỌNG] Nhớ import cái này
  Input,
  InputNumber, // [UNCOMMENT] [QUAN TRỌNG] Nhớ import cái này
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
  suppliers: any[]; // Danh sách NCC để đổ vào Select
  supplierInfo: any; // Thông tin chi tiết NCC đang chọn
  onSupplierChange: (id: number) => void; // Hàm xử lý khi chọn
  onShippingFeeChange: (val: number | null) => void; // [NEW] Callback khi sửa phí ship
}

const POGeneralInfo: React.FC<Props> = ({
  suppliers,
  supplierInfo,
  onSupplierChange,
  onShippingFeeChange,
}) => {
  return (
    <Card
      title="Thông tin chung"
      style={{ marginBottom: 16 }}
      styles={{ body: { padding: 16 } }}
    >
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name="supplier_id"
            label="Nhà Cung Cấp"
            rules={[{ required: true, message: "Chọn NCC" }]}
          >
            <Select
              placeholder="Tìm và chọn NCC..."
              showSearch
              optionFilterProp="children"
              onChange={onSupplierChange} // Gọi hàm khi chọn
              allowClear
            >
              {suppliers.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.name} - {s.phone}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* --- PHẦN HIỂN THỊ THÔNG TIN CHI TIẾT NCC --- */}
          {supplierInfo ? (
            <div
              style={{
                marginTop: -12,
                marginBottom: 16,
                padding: 12,
                background: "#f9f9f9",
                borderRadius: 6,
                border: "1px solid #f0f0f0",
                fontSize: 13,
              }}
            >
              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <Text strong>
                    <UserOutlined />{" "}
                    {supplierInfo.contact_person || "Chưa có tên LH"}
                  </Text>
                  <Text>
                    <PhoneOutlined /> {supplierInfo.phone}
                  </Text>
                </div>
                <div>
                  <EnvironmentOutlined />{" "}
                  <Text type="secondary">
                    {supplierInfo.address || "Chưa cập nhật địa chỉ"}
                  </Text>
                </div>
                <div
                  style={{
                    marginTop: 4,
                    borderTop: "1px dashed #ddd",
                    paddingTop: 4,
                  }}
                >
                  <Space>
                    <Tag color="blue">Công nợ hiện tại:</Tag>
                    <Text type="danger" strong>
                      {supplierInfo.current_debt
                        ? Number(supplierInfo.current_debt).toLocaleString()
                        : 0}{" "}
                      ₫
                    </Text>
                  </Space>
                </div>
              </Space>
            </div>
          ) : null}
        </Col>

        <Col xs={24} md={12}>
          <Form.Item name="expected_delivery_date" label="Ngày giao dự kiến">
            <DatePicker
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              placeholder="Chọn ngày..."
            />
          </Form.Item>
        </Col>

         {/* --- [NEW] LOGISTICS INFO (ĐÃ UNCOMMENT & CHỈNH SỬA) --- */}
         <Col span={24}>
           <div style={{ marginBottom: 16, borderTop: '1px dashed #eee', paddingTop: 16 }}>
              <Typography.Text strong style={{ display: 'block', marginBottom: 12, color: '#1677ff' }}>
                <CarOutlined /> Thông tin Vận chuyển (Logistics)
              </Typography.Text>
              <Row gutter={16}>
                  <Col xs={24} md={8}>
                      <Form.Item name="carrier_name" label="Đơn vị vận chuyển">
                         <Input placeholder="Ví dụ: Viettel Post, Nhà xe..." prefix={<EnvironmentOutlined style={{color: '#bfbfbf'}}/>} />
                      </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                      <Form.Item name="carrier_phone" label="SĐT Liên hệ">
                         <Input placeholder="Số điện thoại shipper/nhà xe" prefix={<PhoneOutlined style={{color: '#bfbfbf'}}/>} />
                      </Form.Item>
                  </Col>
                  <Col xs={12} md={4}>
                      <Form.Item name="total_packages" label="Số kiện hàng">
                          <InputNumber placeholder="SL" style={{ width: '100%' }} min={0} />
                      </Form.Item>
                  </Col>
                   <Col xs={12} md={4}>
                      <Form.Item name="expected_delivery_time" label="Giờ dự kiến">
                          <TimePicker format="HH:mm" style={{ width: '100%' }} placeholder="HH:mm" />
                      </Form.Item>
                  </Col>

                  {/* [NEW] Move Shipping Fee Here */}
                  <Col xs={12} md={8}>
                    <Form.Item name="shipping_fee" label="Phí vận chuyển" initialValue={0}>
                        <InputNumber<number>
                            style={{ width: '100%' }} 
                            // formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={value => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
                            addonAfter="₫"
                            min={0}
                            // [QUAN TRỌNG] Khi sửa ship -> Gọi callback tính lại tiền ngay
                            onChange={onShippingFeeChange} 
                        />
                    </Form.Item>
                </Col>
              </Row>
           </div>
        </Col>

        <Col span={24}>
          <Form.Item name="note" label="Ghi chú">
            <TextArea
              rows={2}
              placeholder="Nhập ghi chú cho đơn hàng (VD: Giao trong giờ hành chính)..."
            />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
};

export default POGeneralInfo;
