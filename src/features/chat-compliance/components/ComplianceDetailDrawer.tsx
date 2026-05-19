// Drawer hiển thị detail 1 audit: anchor + 3 msg trước/sau để hiểu context.
// - Anchor message hi-light đỏ vì đó là tin bị flag.
// - Lazy fetch qua useComplianceDetail (chỉ enabled khi auditId set).

import {
  Alert,
  Descriptions,
  Drawer,
  Empty,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";

import { useComplianceDetail } from "../hooks/useComplianceAudits";

import type {
  ComplianceAuditDetail,
  ComplianceMessage,
  ComplianceSeverity,
} from "../types";

const { Text, Paragraph } = Typography;

const SEVERITY_COLOR: Record<ComplianceSeverity, string> = {
  low: "green",
  medium: "orange",
  high: "red",
};

const ROLE_COLOR: Record<string, string> = {
  user: "blue",
  bot: "purple",
  sales: "geekblue",
  system: "default",
};

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return iso;
  }
}

function MessageBubble({
  msg,
  highlight,
}: {
  msg: ComplianceMessage;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: 8,
        marginBottom: 6,
        borderRadius: 6,
        border: highlight ? "2px solid #ff4d4f" : "1px solid #f0f0f0",
        background: highlight ? "#fff1f0" : "#fafafa",
      }}
    >
      <Space size={4} style={{ marginBottom: 4 }}>
        <Tag color={ROLE_COLOR[msg.role] ?? "default"}>{msg.role}</Tag>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {formatTime(msg.created_at)}
        </Text>
      </Space>
      <Paragraph
        style={{ marginBottom: 0, whiteSpace: "pre-wrap", fontSize: 13 }}
      >
        {msg.content ?? <Text type="secondary">(không có nội dung)</Text>}
      </Paragraph>
    </div>
  );
}

function DetailBody({ detail }: { detail: ComplianceAuditDetail }) {
  if (detail.not_found) {
    return <Empty description="Audit không tồn tại hoặc đã bị xoá" />;
  }
  const a = detail.audit;
  const before = detail.messages_before ?? [];
  const after = detail.messages_after ?? [];
  return (
    <>
      <Descriptions
        size="small"
        column={1}
        bordered
        style={{ marginBottom: 12 }}
      >
        <Descriptions.Item label="Rule">{a.rule_code}</Descriptions.Item>
        <Descriptions.Item label="Mức độ">
          <Tag color={SEVERITY_COLOR[a.severity]}>{a.severity}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Khách hàng">
          {detail.customer?.display_name ?? "(không tên)"}{" "}
          <Text type="secondary">
            {detail.customer?.email ? `· ${detail.customer.email}` : ""}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="Từ khoá match">
          {(a.matched_keywords ?? []).length > 0 ? (
            <Space size={4} wrap>
              {(a.matched_keywords ?? []).map((k) => (
                <Tag key={k} color="volcano">
                  {k}
                </Tag>
              ))}
            </Space>
          ) : (
            <Text type="secondary">—</Text>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Trạng thái">{a.status}</Descriptions.Item>
        <Descriptions.Item label="Audited at">
          {formatTime(a.audited_at)}
        </Descriptions.Item>
      </Descriptions>

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="Ngữ cảnh hội thoại"
        description="3 tin nhắn trước/sau anchor message — giúp reviewer xác định mức độ vi phạm."
      />

      <Text strong>Trước:</Text>
      {before.length === 0 ? (
        <div style={{ marginTop: 4, marginBottom: 8 }}>
          <Text type="secondary">Không có tin trước.</Text>
        </div>
      ) : (
        <div style={{ marginTop: 4 }}>
          {before.map((m) => (
            <MessageBubble key={m.id} msg={m} />
          ))}
        </div>
      )}

      <Text strong>Tin bị flag:</Text>
      <div style={{ marginTop: 4 }}>
        {detail.anchor_message ? (
          <MessageBubble msg={detail.anchor_message} highlight />
        ) : (
          <Text type="secondary">Anchor message không tồn tại.</Text>
        )}
      </div>

      <Text strong>Sau:</Text>
      {after.length === 0 ? (
        <div style={{ marginTop: 4 }}>
          <Text type="secondary">Không có tin sau.</Text>
        </div>
      ) : (
        <div style={{ marginTop: 4 }}>
          {after.map((m) => (
            <MessageBubble key={m.id} msg={m} />
          ))}
        </div>
      )}
    </>
  );
}

export interface ComplianceDetailDrawerProps {
  auditId: string | null;
  onClose: () => void;
}

export function ComplianceDetailDrawer({
  auditId,
  onClose,
}: ComplianceDetailDrawerProps) {
  const { data, isLoading, error } = useComplianceDetail(auditId);
  return (
    <Drawer
      open={!!auditId}
      onClose={onClose}
      width={640}
      title="Chi tiết audit"
      destroyOnHidden
    >
      {isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : null}
      {error ? (
        <Alert
          type="error"
          showIcon
          message="Không tải được chi tiết"
          description={(error as Error).message ?? "Lỗi không xác định"}
        />
      ) : null}
      {!isLoading && !error && data ? <DetailBody detail={data} /> : null}
    </Drawer>
  );
}
