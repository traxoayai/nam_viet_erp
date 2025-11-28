// src/pages/purchasing/components/POPaymentSummary.tsx
import { TruckOutlined } from "@ant-design/icons";
import {
  Card,
  Form,
  InputNumber,
  Typography,
  Select,
  Divider,
  Empty,
} from "antd";
import React from "react";

const { Text } = Typography;
const { Option } = Select;

interface Props {
  financials: { subtotal: number; final: number; totalCartons: number };
  form: any;
  calculateTotals: (items: any[]) => void;
  shippingPartners: any[];
}

const POPaymentSummary: React.FC<Props> = ({
  financials,
  form,
  calculateTotals,
  shippingPartners,
}) => {
  return (
    <Card
      title={
        <span>
          <TruckOutlined /> Thanh Toán & Vận Chuyển
        </span>
      }
      style={{ marginBottom: 16 }}
      styles={{ body: { padding: 16 } }}
    >
      {/* --- PHẦN VẬN CHUYỂN --- */}
      <Form.Item
        name="delivery_method"
        label="Hình thức giao hàng"
        initialValue="internal"
      >
        <Select>
          {/* FIX: Value phải khớp với ENUM trong DB (app, coach, internal) */}
          <Option value="internal">Xe nội bộ / Tự lấy</Option>
          <Option value="app">Dịch vụ vận chuyển (App)</Option>
          <Option value="coach">Xe khách / Chành xe</Option>
          <Option value="supplier">Nhà cung cấp tự giao</Option>
        </Select>
      </Form.Item>

      <Form.Item
        shouldUpdate={(prev, curr) =>
          prev.delivery_method !== curr.delivery_method
        }
      >
        {({ getFieldValue }) => {
          const method = getFieldValue("delivery_method");

          // Logic lọc đối tác:
          // 1. Nếu là 'internal' hoặc 'supplier' -> Không cần chọn đối tác
          // 2. Nếu là 'app' hoặc 'coach' -> Lọc shippingPartners theo type tương ứng
          if (method === "internal" || method === "supplier") return null;

          const filteredPartners = shippingPartners.filter(
            (p) => p.type === method
          );

          return (
            <Form.Item name="shipping_partner_id" label="Chọn Đơn vị / Nhà xe">
              <Select
                placeholder="Chọn đối tác..."
                allowClear
                notFoundContent={<Empty description="Chưa có dữ liệu" />}
              >
                {filteredPartners.map((p) => (
                  <Option key={p.id} value={p.id}>
                    {p.name} {p.phone ? `- ${p.phone}` : ""}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          );
        }}
      </Form.Item>

      <Divider />

      {/* --- PHẦN TIỀN --- */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <Text type="secondary">Tiền hàng:</Text>
        <Text strong>{financials.subtotal.toLocaleString()} ₫</Text>
      </div>

      <Form.Item name="shipping_fee" label="Phí vận chuyển" initialValue={0}>
        <InputNumber
          style={{ width: "100%" }}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
          parser={(v) => v!.replace(/\$\s?|(,*)/g, "")}
          onChange={() => {
            const currentItems = form.getFieldValue("items") || [];
            calculateTotals(currentItems);
          }}
          addonAfter="₫"
        />
      </Form.Item>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 16,
          color: "#1677ff",
          marginTop: 12,
        }}
      >
        <strong>TỔNG CỘNG:</strong>
        <strong>{financials.final.toLocaleString()} ₫</strong>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: 8,
          background: "#f6ffed",
          border: "1px solid #b7eb8f",
          borderRadius: 4,
          textAlign: "center",
        }}
      >
        <span style={{ color: "#389e0d", fontWeight: "bold" }}>
          📦 Tổng kiện: {financials.totalCartons} thùng
        </span>
      </div>
    </Card>
  );
};

export default POPaymentSummary;
