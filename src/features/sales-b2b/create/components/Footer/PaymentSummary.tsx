// src/features/sales-b2b/create/components/Footer/PaymentSummary.tsx
import { Typography, InputNumber, Divider } from "antd";

const { Text, Title } = Typography;

interface Props {
  subTotal?: number;
  discount?: number;
  shippingFee?: number;
  setShippingFee: (val: number) => void;
  finalTotal?: number;
  oldDebt?: number;
  totalPayable?: number;
}

export const PaymentSummary = ({
  // FIX: Gán giá trị mặc định là 0 nếu props truyền vào bị undefined
  subTotal = 0,
  discount = 0,
  shippingFee = 0,
  setShippingFee,
  finalTotal = 0,
  oldDebt = 0,
  totalPayable = 0,
}: Props) => {
  const rowStyle = {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 8,
    alignItems: "center",
  };

  return (
    <div
      style={{
        background: "#f9faff",
        padding: 16,
        borderRadius: 8,
        border: "1px solid #d6e4ff",
      }}
    >
      <div style={rowStyle}>
        <Text type="secondary">Tổng tiền hàng:</Text>
        {/* FIX: Sử dụng (value || 0).toLocaleString() để an toàn tuyệt đối */}
        <Text strong>{(subTotal || 0).toLocaleString()} ₫</Text>
      </div>

      <div style={rowStyle}>
        <Text type="secondary">Giảm giá (Voucher):</Text>
        <Text type="success">-{(discount || 0).toLocaleString()} ₫</Text>
      </div>

      <div style={rowStyle}>
        <Text type="secondary">Phí vận chuyển:</Text>
        <InputNumber
          size="small"
          value={shippingFee}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
          onChange={(v) => setShippingFee(v || 0)}
          style={{ width: 120, textAlign: "right" }}
        />
      </div>

      <Divider style={{ margin: "12px 0" }} />

      <div style={rowStyle}>
        <Text strong>TỔNG CỘNG:</Text>
        <Text strong style={{ fontSize: 16 }}>
          {(finalTotal || 0).toLocaleString()} ₫
        </Text>
      </div>

      <div style={{ ...rowStyle, color: "#faad14" }}>
        <Text type="warning">Nợ cũ:</Text>
        <Text>{(oldDebt || 0).toLocaleString()} ₫</Text>
      </div>

      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: "2px dashed #d9d9d9",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Title level={5} style={{ margin: 0 }}>
          THANH TOÁN:
        </Title>
        <Title level={3} style={{ margin: 0, color: "#cf1322" }}>
          {/* ĐÂY LÀ CHỖ GÂY LỖI TRƯỚC ĐÓ -> ĐÃ FIX */}
          {(totalPayable || 0).toLocaleString()} ₫
        </Title>
      </div>
    </div>
  );
};
