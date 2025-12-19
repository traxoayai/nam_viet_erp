// src/components/shared/listing/StatHeader.tsx
import { Card, Col, Row, Statistic } from "antd";
import React, { ReactNode } from "react";

interface StatItem {
  title: string;
  value: number | string;
  color?: string;
  icon?: ReactNode;
  suffix?: string;
}

interface Props {
  items: StatItem[];
  loading?: boolean;
}

// 1. Component Gốc
const StatHeaderBase = ({ items, loading = false }: Props) => {
  return (
    <div style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]}>
        {items.map((item, idx) => (
          <Col xs={12} sm={12} md={6} lg={24 / items.length} key={idx}>
            <Card
              bodyStyle={{ padding: "12px 24px" }}
              bordered={false}
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
            >
              <Statistic
                title={
                  <span style={{ fontSize: 13, color: "#888" }}>
                    {item.icon} {item.title}
                  </span>
                }
                value={item.value}
                loading={loading}
                valueStyle={{ color: item.color || "#333", fontWeight: 600 }}
                suffix={
                  <span style={{ fontSize: 12, color: "#999" }}>
                    {item.suffix}
                  </span>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

// 2. Bọc Memo với Logic So sánh An toàn (FIX LỖI CIRCULAR JSON)
export const StatHeader = React.memo(StatHeaderBase, (prevProps, nextProps) => {
  // 1. Nếu trạng thái loading thay đổi -> Render lại
  if (prevProps.loading !== nextProps.loading) return false;

  // 2. Nếu số lượng item thay đổi -> Render lại
  if (prevProps.items.length !== nextProps.items.length) return false;

  // 3. So sánh từng item (CHỈ SO SÁNH DỮ LIỆU, BỎ QUA ICON)
  for (let i = 0; i < prevProps.items.length; i++) {
    const prev = prevProps.items[i];
    const next = nextProps.items[i];

    // Chỉ so sánh các trường primitive (chuỗi, số)
    if (
      prev.title !== next.title ||
      prev.value !== next.value ||
      prev.color !== next.color ||
      prev.suffix !== next.suffix
    ) {
      return false; // Có thay đổi -> Render lại
    }
  }

  return true; // Dữ liệu giống nhau -> KHÔNG Render lại
});
