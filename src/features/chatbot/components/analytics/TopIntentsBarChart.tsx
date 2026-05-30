// Bar chart top ý định khách hỏi (Plan 2 Task 13.2).
// - Layout vertical (horizontal bars) để dễ đọc tên intent.
// - Chiều cao co dãn theo số intent (min 200px, 32px/row).

import { Card } from "antd";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { IntentCount } from "../../api/analyticsApi";

const LABELS: Record<string, string> = {
  search_product: "Tìm sản phẩm",
  order_intent: "Đặt hàng",
  ask_debt: "Hỏi công nợ",
  ask_orders: "Hỏi đơn",
  greeting: "Chào hỏi",
  unknown: "Không hiểu",
};

export interface TopIntentsBarChartProps {
  data?: IntentCount[];
}

export function TopIntentsBarChart({ data }: TopIntentsBarChartProps) {
  const series = (data ?? []).map((d) => ({
    name: LABELS[d.intent] ?? d.intent,
    count: d.count,
  }));
  return (
    <Card title="Top ý định khách hỏi" style={{ marginBottom: 16 }}>
      <ResponsiveContainer
        width="100%"
        height={Math.max(200, series.length * 32)}
      >
        <BarChart data={series} layout="vertical" margin={{ left: 60 }}>
          <XAxis type="number" />
          <YAxis dataKey="name" type="category" width={140} />
          <Tooltip />
          <Bar dataKey="count" fill="#1677ff" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
