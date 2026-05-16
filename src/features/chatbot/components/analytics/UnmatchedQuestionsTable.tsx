// Bảng câu hỏi bot không hiểu — top 20 (Plan 2 Task 14.2).
// rowKey ghép session_id + occurred_at để tránh trùng khi 1 session hỏi nhiều câu.

import { Card, Table } from "antd";
import dayjs from "dayjs";

import type { UnmatchedQuestion } from "../../api/analyticsApi";

export interface UnmatchedQuestionsTableProps {
  data?: UnmatchedQuestion[];
}

export function UnmatchedQuestionsTable({
  data,
}: UnmatchedQuestionsTableProps) {
  return (
    <Card title="Câu bot không hiểu (top 20)" style={{ marginBottom: 16 }}>
      <Table<UnmatchedQuestion>
        rowKey={(r) => r.session_id + r.occurred_at}
        dataSource={data ?? []}
        size="small"
        pagination={false}
        columns={[
          { title: "Câu khách hỏi", dataIndex: "question", ellipsis: true },
          {
            title: "Lúc",
            dataIndex: "occurred_at",
            width: 140,
            render: (v: string) => dayjs(v).format("HH:mm DD/MM"),
          },
        ]}
      />
    </Card>
  );
}
