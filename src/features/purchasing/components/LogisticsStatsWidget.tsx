// src/features/purchasing/components/LogisticsStatsWidget.tsx
import {
  CarOutlined,
  RocketOutlined,
  HomeOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import { Card, Col, Row, Statistic } from "antd";
import React, { useMemo } from "react";

import { PoLogisticsStat } from "../types/purchase";

interface LogisticsStatsWidgetProps {
  stats: PoLogisticsStat[];
}

export const LogisticsStatsWidget: React.FC<LogisticsStatsWidgetProps> =
  React.memo(({ stats }) => {
    const statMap = useMemo(() => {
      const map: Record<string, number> = {};
      stats.forEach((s) => {
        map[s.method] = s.total_cartons;
      });
      return map;
    }, [stats]);

    const getValue = (key: string) => statMap[key] || 0;

    return (
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="Xe Khách / Chành"
              value={getValue("coach")}
              prefix={<CarOutlined style={{ color: "#fa8c16" }} />}
              suffix="thùng"
              valueStyle={{ color: "#fa8c16" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="Dịch Vụ (3PL)"
              value={getValue("3pl")}
              prefix={<RocketOutlined style={{ color: "#1890ff" }} />}
              suffix="thùng"
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="Xe Nội Bộ"
              value={getValue("internal")}
              prefix={<HomeOutlined style={{ color: "#52c41a" }} />}
              suffix="thùng"
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="NCC Giao"
              value={getValue("supplier")}
              prefix={<InboxOutlined style={{ color: "#13c2c2" }} />}
              suffix="thùng"
              valueStyle={{ color: "#13c2c2" }}
            />
          </Card>
        </Col>
      </Row>
    );
  });
