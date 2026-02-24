// src/features/pos/components/layout/PosPaymentSection.tsx
import { Card, Row, Typography, Divider, InputNumber } from "antd";
import { useState, useEffect } from "react";

import { usePosCartStore } from "../../stores/usePosCartStore";

const { Text, Title } = Typography;

export const PosPaymentSection = () => {
  const { getTotals } = usePosCartStore();
  const totals = getTotals();

  // State tiền khách đưa (Local state vì chỉ dùng ở đây)
  const [amountGiven, setAmountGiven] = useState<number | null>(null);

  // Tự động set tiền khách đưa bằng tổng tiền khi mới load (Quick Pay)
  useEffect(() => {
    if (!amountGiven && totals.grandTotal > 0)
      setAmountGiven(totals.grandTotal);
  }, [totals.grandTotal]);

  const change = (amountGiven || 0) - totals.grandTotal;

  return (
    <Card size="small" title="Thanh Toán" style={{ flex: 1 }}>
      <Row justify="space-between" style={{ marginBottom: 8 }}>
        <Text>Tổng tiền hàng:</Text>
        <Text strong>{totals.subTotal.toLocaleString()}</Text>
      </Row>
      <Row justify="space-between" style={{ marginBottom: 8 }}>
        <Text>Giảm giá:</Text>
        <Text type="success">-{totals.discountVal.toLocaleString()}</Text>
      </Row>
      <Row justify="space-between" style={{ marginBottom: 8 }}>
        <Text>Nợ cũ:</Text>
        <Text type="danger">+{totals.debtAmount.toLocaleString()}</Text>
      </Row>

      <Divider style={{ margin: "12px 0" }} />

      <Row justify="space-between" align="middle">
        <Title level={4} style={{ margin: 0, color: "#0050b3" }}>
          KHÁCH TRẢ:
        </Title>
        <Title level={3} style={{ margin: 0, color: "#cf1322" }}>
          {totals.grandTotal.toLocaleString()}
        </Title>
      </Row>

      <div
        style={{
          marginTop: 16,
          background: "#f5f5f5",
          padding: 12,
          borderRadius: 8,
        }}
      >
        <div style={{ marginBottom: 8 }}>Khách đưa:</div>
        <InputNumber
          style={{ width: "100%", fontSize: 18, fontWeight: "bold" }}
          formatter={(value) =>
            `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
          }
          value={amountGiven}
          onChange={setAmountGiven}
          size="large"
        />
        <div
          style={{
            marginTop: 8,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <Text>Tiền thừa:</Text>
          <Text
            strong
            style={{ color: change < 0 ? "red" : "green", fontSize: 16 }}
          >
            {change > 0 ? change.toLocaleString() : 0}
          </Text>
        </div>
      </div>
    </Card>
  );
};
