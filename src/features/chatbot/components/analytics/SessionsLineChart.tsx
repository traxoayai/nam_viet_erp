// Line chart phiên chat & đơn theo ngày (Plan 2 Task 13.1).
// Recharts 3.7 — ResponsiveContainer chiều cao cố định 260px.

import { Card } from "antd";
import dayjs from "dayjs";
import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { SessionPerDay } from "../../api/analyticsApi";

export interface SessionsLineChartProps {
  data?: SessionPerDay[];
}

export function SessionsLineChart({ data }: SessionsLineChartProps) {
  const series = (data ?? []).map((d) => ({
    ...d,
    label: dayjs(d.day).format("DD/MM"),
  }));
  return (
    <Card title="Phiên chat & đơn theo ngày" style={{ marginBottom: 16 }}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={series}>
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="sessions"
            name="Phiên"
            stroke="#1677ff"
          />
          <Line type="monotone" dataKey="orders" name="Đơn" stroke="#52c41a" />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
