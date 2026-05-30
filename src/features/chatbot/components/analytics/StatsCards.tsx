// 4 KPI card đầu trang dashboard analytics (Plan 2 Task 12.2).
// - Skeleton khi đang loading hoặc data chưa có.
// - Card "Chi phí AI" luôn $0 vì stack FREE-only — note rõ cho user.

import { Card, Col, Row, Skeleton, Statistic } from "antd";

import type { ChatStatsOverview } from "../../api/analyticsApi";

export interface StatsCardsProps {
  data?: ChatStatsOverview;
  loading?: boolean;
}

export function StatsCards({ data, loading }: StatsCardsProps) {
  if (loading || !data) return <Skeleton active />;
  return (
    <Row gutter={16} style={{ marginBottom: 16 }}>
      <Col span={6}>
        <Card>
          <Statistic title="Tổng phiên chat" value={data.total_sessions} />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic title="Đơn từ bot" value={data.orders_via_bot} />
          {data.orders_note ? (
            <div style={{ fontSize: 11, color: "#888" }}>
              {data.orders_note}
            </div>
          ) : null}
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="% chuyển sales"
            value={data.handoff_rate}
            suffix="%"
            precision={1}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="Chi phí AI"
            value={data.ai_cost_usd}
            prefix="$"
            precision={2}
          />
          <div style={{ fontSize: 11, color: "#888" }}>
            FREE-only stack — luôn $0
          </div>
        </Card>
      </Col>
    </Row>
  );
}
