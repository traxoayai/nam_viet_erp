// 4 KPI card + mini bar chart by day cho Compliance dashboard.
// - Total / High / Medium / Low severity.
// - Bar chart hiển thị count per day trong khoảng filter.

import { Card, Col, Row, Skeleton, Statistic, Tag, Empty } from "antd";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ComplianceStats } from "../types";

export interface ComplianceStatsCardsProps {
  data?: ComplianceStats;
  loading?: boolean;
}

const COLORS = {
  high: "#cf1322",
  medium: "#d48806",
  low: "#52c41a",
  bar: "#fa541c",
};

function formatDayLabel(iso: string): string {
  // YYYY-MM-DD → DD/MM
  if (!iso || iso.length < 10) return iso;
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export function ComplianceStatsCards({
  data,
  loading,
}: ComplianceStatsCardsProps) {
  if (loading || !data) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }

  const chartData = (data.by_day ?? []).map((d) => ({
    day: formatDayLabel(d.day),
    count: d.count,
  }));

  return (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Tổng audit" value={data.total} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title={<Tag color={COLORS.high}>Nghiêm trọng</Tag>}
              value={data.by_severity.high}
              valueStyle={{ color: COLORS.high }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title={<Tag color={COLORS.medium}>Trung bình</Tag>}
              value={data.by_severity.medium}
              valueStyle={{ color: COLORS.medium }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title={<Tag color={COLORS.low}>Thấp</Tag>}
              value={data.by_severity.low}
              valueStyle={{ color: COLORS.low }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title="Audit theo ngày"
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: 12 } }}
      >
        {chartData.length === 0 ? (
          <Empty description="Không có dữ liệu" />
        ) : (
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill={COLORS.bar} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </>
  );
}
