// src/features/pos/components/layout/PosPaymentSection.tsx
import { Card, Row, Typography, Divider, InputNumber, Space } from "antd";
import { useState, useEffect } from "react";

import { usePosCartStore } from "../../stores/usePosCartStore";

const { Text } = Typography;

export const PosPaymentSection = () => {
  const { getTotals } = usePosCartStore();
  const totals = getTotals();

  const [amountGiven, setAmountGiven] = useState<number | null>(null);

  useEffect(() => {
    if (!amountGiven && totals.grandTotal > 0)
      setAmountGiven(totals.grandTotal);
  }, [totals.grandTotal]);

  const change = (amountGiven || 0) - totals.grandTotal;

  return (
    <Card 
      size="small" 
      title={<div style={{ textAlign: 'center', width: '100%' }}><Text strong style={{ fontSize: 16 }}>Thanh Toán</Text></div>} 
      style={{ 
        flex: 1, 
        borderRadius: 12, 
        border: 'none', 
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)' 
      }}
    >
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <Row justify="space-between">
          <Text type="secondary">Tổng tiền hàng:</Text>
          <Text strong style={{ fontSize: 15 }}>{totals.subTotal.toLocaleString()}</Text>
        </Row>
        <Row justify="space-between">
          <Text type="secondary">Giảm giá:</Text>
          <Text type="success" strong>-{totals.discountVal.toLocaleString()}</Text>
        </Row>
        <Row justify="space-between">
          <Text type="secondary">Nợ cũ:</Text>
          <Text type="danger" strong>+{totals.debtAmount.toLocaleString()}</Text>
        </Row>

        <Divider style={{ margin: "4px 0" }} />

        <div style={{ 
          background: '#e6f7ff', 
          padding: '16px', 
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Text strong style={{ fontSize: 14, color: "#003a8c", marginBottom: 4 }}>TỔNG CỘNG KHÁCH TRẢ:</Text>
          <Text strong style={{ fontSize: 32, color: "#cf1322" }}>
            {totals.grandTotal.toLocaleString()}
          </Text>
        </div>

        <div
          style={{
            marginTop: 8,
            border: '2px solid #f0f0f0',
            padding: 16,
            borderRadius: 12,
            textAlign: 'center'
          }}
        >
          <div style={{ marginBottom: 12, fontSize: 15, fontWeight: 500, color: '#595959' }}>Khách đưa (F8):</div>
          <InputNumber
            style={{ width: "100%", fontSize: 28, fontWeight: 900, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            formatter={(value) =>
              `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
            }
            value={amountGiven}
            onChange={setAmountGiven}
            size="large"
            bordered={false}
            className="huge-input-number-centered"
          />
          
          <Divider style={{ margin: "16px 0" }} />
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 14, marginBottom: 4 }}>Tiền thừa trả khách:</Text>
            <Text
              strong
              style={{ 
                color: change < 0 ? "#ff4d4f" : "#52c41a", 
                fontSize: 24
              }}
            >
              {change > 0 ? change.toLocaleString() : 0}
            </Text>
          </div>
        </div>
      </Space>
    </Card>
  );
};

