// Trang chính Compliance Audit Dashboard (Agent G3).
// - Stats cards + chart by day (7 ngày default).
// - Filter bar: quick range + custom date range + severity select.
// - Table audits + DetailDrawer.
//
// Permission gate: parent route guard đã check `crm.chatbot.audit`.

import { Alert, Card, Typography, Space, Tag } from "antd";
import dayjs from "dayjs";
import { useMemo, useState } from "react";

import { ComplianceAuditTable } from "../components/ComplianceAuditTable";
import { ComplianceDetailDrawer } from "../components/ComplianceDetailDrawer";
import {
  ComplianceFilterBar,
  type ComplianceFilterValue,
} from "../components/ComplianceFilterBar";
import { ComplianceStatsCards } from "../components/ComplianceStatsCards";
import {
  useComplianceList,
  useComplianceStats,
} from "../hooks/useComplianceAudits";

const { Title, Paragraph } = Typography;

function defaultFilter(): ComplianceFilterValue {
  const to = dayjs();
  const from = to.subtract(6, "day");
  return {
    from: from.format("YYYY-MM-DD"),
    to: to.format("YYYY-MM-DD"),
    severity: null,
  };
}

export default function CompliancePage() {
  const [filter, setFilter] = useState<ComplianceFilterValue>(defaultFilter);
  const [activeAuditId, setActiveAuditId] = useState<string | null>(null);

  const dateRange = useMemo(
    () => ({ from: filter.from, to: filter.to }),
    [filter.from, filter.to]
  );

  const stats = useComplianceStats(dateRange);
  const list = useComplianceList({
    from: filter.from,
    to: filter.to,
    severity: filter.severity,
    limit: 200,
    offset: 0,
  });

  return (
    <div style={{ padding: 16 }}>
      <Space
        direction="vertical"
        size={4}
        style={{ marginBottom: 16, width: "100%" }}
      >
        <Title level={3} style={{ margin: 0 }}>
          Audit Compliance Chatbot
          <Tag color="red" style={{ marginLeft: 8 }}>
            R-04 Y khoa
          </Tag>
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Dashboard giám sát các phản hồi chatbot có dấu hiệu tư vấn thuốc /
          liều dùng / chống chỉ định. pg_cron audit 2h sáng mỗi ngày
          (`audit_chat_messages_daily`).
        </Paragraph>
      </Space>

      {stats.error ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="Lỗi tải KPI"
          description={(stats.error as Error).message ?? "Lỗi không xác định"}
        />
      ) : null}

      <ComplianceStatsCards data={stats.data} loading={stats.isLoading} />

      <Card size="small">
        <ComplianceFilterBar value={filter} onChange={setFilter} />
        {list.error ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="Lỗi tải danh sách"
            description={(list.error as Error).message ?? "Lỗi không xác định"}
          />
        ) : null}
        <ComplianceAuditTable
          data={list.data ?? []}
          loading={list.isLoading}
          onOpenDetail={(id) => setActiveAuditId(id)}
        />
      </Card>

      <ComplianceDetailDrawer
        auditId={activeAuditId}
        onClose={() => setActiveAuditId(null)}
      />
    </div>
  );
}
