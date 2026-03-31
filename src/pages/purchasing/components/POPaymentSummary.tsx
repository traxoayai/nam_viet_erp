// src/pages/purchasing/components/POPaymentSummary.tsx
import { DollarOutlined, TruckOutlined } from "@ant-design/icons";
import { Card, Typography, Divider, Button } from "antd";

const { Text } = Typography;

interface Financials {
  subtotal: number;
  shippingFee: number;
  final: number;
  totalCartons: number;
  paid: number;
}

interface Props {
  financials: Financials;
  shippingPartnerName?: string;
  poStatus?: string;
  onRequestPayment?: () => void;
  onRequestShippingPayment?: () => void;
}

const Row = ({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
}) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 6,
      fontSize: bold ? 16 : 14,
      color: color || undefined,
    }}
  >
    {bold ? <strong>{label}</strong> : <Text type="secondary">{label}</Text>}
    {bold ? <strong>{value}</strong> : <Text strong>{value}</Text>}
  </div>
);

const POPaymentSummary = ({
  financials,
  shippingPartnerName,
  poStatus,
  onRequestPayment,
  onRequestShippingPayment,
}: Props) => {
  const showActions = poStatus === "PENDING" || poStatus === "SHIPPING";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Card 1: Thanh toán NCC */}
      <Card
        title={
          <span>
            <DollarOutlined /> Thanh Toán NCC
          </span>
        }
        size="small"
        styles={{ body: { padding: 12 } }}
      >
        <Row
          label="Tiền hàng:"
          value={`${financials.subtotal.toLocaleString()} ₫`}
        />
        <Divider style={{ margin: "8px 0" }} />
        <Row
          label="TỔNG TRẢ NCC:"
          value={`${financials.final.toLocaleString()} ₫`}
          bold
          color="#d9363e"
        />
        {showActions && onRequestPayment && (
          <Button
            type="primary"
            icon={<DollarOutlined />}
            onClick={onRequestPayment}
            style={{ width: "100%", marginTop: 8 }}
          >
            Tạo Thanh Toán NCC
          </Button>
        )}
      </Card>

      {/* Card 2: Vận chuyển */}
      <Card
        title={
          <span>
            <TruckOutlined /> Vận Chuyển
          </span>
        }
        size="small"
        styles={{ body: { padding: 12 } }}
      >
        <Row
          label="Phí vận chuyển:"
          value={`${financials.shippingFee.toLocaleString()} ₫`}
        />
        {shippingPartnerName && (
          <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
            Đối tác: {shippingPartnerName}
          </div>
        )}
        <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
          Tổng kiện: {financials.totalCartons} thùng
        </div>
        {showActions && onRequestShippingPayment && (
          <Button
            icon={<TruckOutlined />}
            onClick={onRequestShippingPayment}
            style={{ width: "100%", marginTop: 4 }}
          >
            Tạo Thanh Toán Phí Vận Chuyển
          </Button>
        )}
      </Card>
    </div>
  );
};

export default POPaymentSummary;
