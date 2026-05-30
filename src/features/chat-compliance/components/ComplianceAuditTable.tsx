// Table audit rows: Time / Customer / Severity / Rule / Keywords / Excerpt / Action.
// - Click "Xem" → mở DetailDrawer (page-level controls auditId state).
// - Excerpt truncated 80 chars; full content nằm trong drawer.

import { Button, Space, Table, Tag, Tooltip, Typography } from "antd";

import type { ComplianceAuditRow, ComplianceSeverity } from "../types";
import type { ColumnsType } from "antd/es/table";

const { Text } = Typography;

const SEVERITY_COLOR: Record<ComplianceSeverity, string> = {
  low: "green",
  medium: "orange",
  high: "red",
};

const SEVERITY_LABEL: Record<ComplianceSeverity, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Nghiêm trọng",
};

const STATUS_LABEL: Record<string, { color: string; label: string }> = {
  open: { color: "blue", label: "Chờ review" },
  reviewed_ok: { color: "green", label: "OK" },
  reviewed_violation: { color: "red", label: "Vi phạm" },
};

function truncate(text: string | null, max: number): string {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return iso;
  }
}

export interface ComplianceAuditTableProps {
  data: ComplianceAuditRow[];
  loading?: boolean;
  onOpenDetail: (auditId: string) => void;
}

export function ComplianceAuditTable({
  data,
  loading,
  onOpenDetail,
}: ComplianceAuditTableProps) {
  const columns: ColumnsType<ComplianceAuditRow> = [
    {
      title: "Thời gian",
      dataIndex: "audit_created_at",
      width: 160,
      render: (v: string) => (
        <Text style={{ fontSize: 12 }}>{formatTime(v)}</Text>
      ),
    },
    {
      title: "Khách hàng",
      key: "customer",
      width: 220,
      render: (_: unknown, r: ComplianceAuditRow) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {r.customer_name ?? "(không tên)"}
          </div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.customer_email ?? "—"}
          </Text>
        </div>
      ),
    },
    {
      title: "Mức độ",
      dataIndex: "severity",
      width: 110,
      render: (s: ComplianceSeverity) => (
        <Tag color={SEVERITY_COLOR[s]}>{SEVERITY_LABEL[s]}</Tag>
      ),
    },
    {
      title: "Rule",
      dataIndex: "rule_code",
      width: 80,
    },
    {
      title: "Từ khoá",
      dataIndex: "matched_keywords",
      width: 220,
      render: (kw: string[] | null) =>
        kw && kw.length > 0 ? (
          <Space size={4} wrap>
            {kw.slice(0, 3).map((k) => (
              <Tag key={k} color="volcano">
                {k}
              </Tag>
            ))}
            {kw.length > 3 ? (
              <Text type="secondary" style={{ fontSize: 11 }}>
                +{kw.length - 3}
              </Text>
            ) : null}
          </Space>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "Trích đoạn",
      dataIndex: "excerpt",
      render: (e: string | null) => (
        <Tooltip title={e ?? ""}>
          <Text>{truncate(e, 80)}</Text>
        </Tooltip>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 110,
      render: (s: string) => {
        const cfg = STATUS_LABEL[s] ?? { color: "default", label: s };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: "",
      key: "actions",
      width: 80,
      render: (_: unknown, r: ComplianceAuditRow) => (
        <Button
          size="small"
          type="link"
          onClick={() => onOpenDetail(r.audit_id)}
        >
          Xem
        </Button>
      ),
    },
  ];

  return (
    <Table<ComplianceAuditRow>
      rowKey="audit_id"
      size="small"
      loading={loading}
      dataSource={data}
      columns={columns}
      pagination={{ pageSize: 25, showSizeChanger: false }}
      scroll={{ x: 1100 }}
    />
  );
}
