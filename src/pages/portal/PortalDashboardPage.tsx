// src/pages/portal/PortalDashboardPage.tsx
import {
  UserAddOutlined,
  ShoppingCartOutlined,
  CalendarOutlined,
  DollarCircleOutlined,
} from "@ant-design/icons";
import { Card, Col, Row, Spin, Statistic } from "antd";
import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { safeRpc } from "@/shared/lib/safeRpc";

interface DashboardStats {
  pending_registrations: number;
  orders_today: number;
  orders_this_week: number;
  revenue_this_month: number;
  daily_orders: { date: string; count: number }[];
}

const PortalDashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await safeRpc("get_portal_dashboard_stats");
        setStats(data as unknown as DashboardStats);
      } catch (err) {
        console.error("Failed to load portal dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  const statCards = [
    {
      title: "Đăng ký chờ duyệt",
      value: stats?.pending_registrations ?? 0,
      icon: <UserAddOutlined style={{ fontSize: 24, color: "#faad14" }} />,
      color: "#fffbe6",
    },
    {
      title: "Đơn hàng Portal hôm nay",
      value: stats?.orders_today ?? 0,
      icon: <ShoppingCartOutlined style={{ fontSize: 24, color: "#1890ff" }} />,
      color: "#e6f7ff",
    },
    {
      title: "Đơn hàng Portal tuần này",
      value: stats?.orders_this_week ?? 0,
      icon: <CalendarOutlined style={{ fontSize: 24, color: "#52c41a" }} />,
      color: "#f6ffed",
    },
    {
      title: "Doanh thu Portal tháng này",
      value: stats?.revenue_this_month ?? 0,
      suffix: "đ",
      icon: <DollarCircleOutlined style={{ fontSize: 24, color: "#eb2f96" }} />,
      color: "#fff0f6",
    },
  ];

  return (
    <div style={{ padding: 16, background: "#e1e1dfff", minHeight: "100vh" }}>
      <Row gutter={[16, 16]}>
        {statCards.map((card) => (
          <Col xs={24} sm={12} lg={6} key={card.title}>
            <Card
              style={{ borderRadius: 8, background: card.color }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {card.icon}
                <Statistic
                  title={card.title}
                  value={card.value}
                  suffix={card.suffix}
                />
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        title="Đơn hàng Portal — 30 ngày gần nhất"
        style={{ marginTop: 16, borderRadius: 8 }}
      >
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={stats?.daily_orders ?? []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => {
                const date = new Date(d);
                return `${date.getDate()}/${date.getMonth() + 1}`;
              }}
            />
            <YAxis allowDecimals={false} />
            <Tooltip
              labelFormatter={(d) => {
                const date = new Date(String(d));
                return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              name="Đơn hàng"
              stroke="#1890ff"
              fill="#1890ff"
              fillOpacity={0.2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

export default PortalDashboardPage;
