// src/pages/purchasing/components/POPaymentSummary.tsx
import { TruckOutlined } from "@ant-design/icons";
import { Card, Typography, Divider } from "antd";
import React from "react";

const { Text } = Typography;

interface Props {
  financials: { subtotal: number; final: number; totalCartons: number };
}

// [FIX] Loại bỏ Form.Item nhập liệu, chỉ nhận props để hiển thị
const POPaymentSummary: React.FC<Props> = ({ financials }) => {
  return (
    <Card
      title={
        <span>
          <TruckOutlined /> Tổng Thanh Toán
        </span>
      }
      style={{ marginBottom: 16 }}
      styles={{ body: { padding: 16 } }}
    >
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

      {/* Chỉ hiển thị kết quả tính toán, KHÔNG nhập ở đây nữa (đã nhập bên POGeneralInfo) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <Text type="secondary">Phí vận chuyển (+):</Text>
        <Text>
          {(financials.final - financials.subtotal).toLocaleString()} ₫
        </Text>
      </div>

      <Divider style={{ margin: "12px 0" }} />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 18,
          color: "#d9363e",
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
