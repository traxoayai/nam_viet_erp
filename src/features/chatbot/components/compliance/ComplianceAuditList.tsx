// Bảng audit tuân thủ chatbot + modal review (Plan 2 Task 18).
// - Filter: chỉ "open" (mặc định) hoặc "all".
// - Click Review → modal hiện full excerpt + keyword → reviewer gán
//   verdict (OK / Vi phạm) kèm note tuỳ chọn.
// - Mọi update đều invalidate query để refetch list.

import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  message as antdMessage,
} from "antd";
import { useState } from "react";

import { reviewAudit, type ComplianceAudit } from "../../api/complianceApi";
import { useComplianceAudits } from "../../hooks/useComplianceAudits";

const SEVERITY: Record<string, string> = {
  low: "green",
  medium: "orange",
  high: "red",
};

export function ComplianceAuditList() {
  const [statusFilter, setStatusFilter] = useState<"open" | "all">("open");
  const { data, isLoading } = useComplianceAudits(statusFilter);
  const [active, setActive] = useState<ComplianceAudit | null>(null);
  const [note, setNote] = useState("");
  const qc = useQueryClient();

  async function submitReview(verdict: "reviewed_ok" | "reviewed_violation") {
    if (!active) return;
    try {
      await reviewAudit({ id: active.id, verdict, note });
      antdMessage.success("Đã ghi nhận");
      setActive(null);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["chatbot", "audits"] });
    } catch {
      antdMessage.error("Lỗi lưu review");
    }
  }

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button
          type={statusFilter === "open" ? "primary" : "default"}
          onClick={() => setStatusFilter("open")}
        >
          Chờ review
        </Button>
        <Button
          type={statusFilter === "all" ? "primary" : "default"}
          onClick={() => setStatusFilter("all")}
        >
          Tất cả
        </Button>
      </Space>
      <Table<ComplianceAudit>
        rowKey="id"
        dataSource={data ?? []}
        loading={isLoading}
        size="small"
        columns={[
          {
            title: "Audit",
            dataIndex: "audited_at",
            width: 140,
            render: (v: string) => new Date(v).toLocaleString("vi-VN"),
          },
          { title: "Rule", dataIndex: "rule_code", width: 80 },
          {
            title: "Severity",
            dataIndex: "severity",
            width: 100,
            render: (s: string) => <Tag color={SEVERITY[s]}>{s}</Tag>,
          },
          {
            title: "Keywords",
            dataIndex: "matched_keywords",
            render: (kw: string[]) => kw?.join(", ") ?? "",
          },
          { title: "Excerpt", dataIndex: "excerpt", ellipsis: true },
          { title: "Status", dataIndex: "status", width: 120 },
          {
            title: "",
            width: 90,
            render: (_: unknown, r: ComplianceAudit) => (
              <Button size="small" onClick={() => setActive(r)}>
                Review
              </Button>
            ),
          },
        ]}
      />
      <Modal
        title={`Review audit ${active?.rule_code ?? ""}`}
        open={!!active}
        onCancel={() => setActive(null)}
        footer={[
          <Button key="ok" onClick={() => submitReview("reviewed_ok")}>
            OK (không vi phạm)
          </Button>,
          <Button
            key="bad"
            danger
            onClick={() => submitReview("reviewed_violation")}
          >
            Vi phạm
          </Button>,
        ]}
      >
        <p>
          <strong>Tin nhắn:</strong> {active?.excerpt}
        </p>
        <p>
          <strong>Từ khoá match:</strong> {active?.matched_keywords?.join(", ")}
        </p>
        <Input.TextArea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú reviewer"
          rows={3}
        />
      </Modal>
    </>
  );
}
