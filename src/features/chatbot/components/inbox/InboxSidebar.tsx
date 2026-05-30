// Sidebar Sales Inbox: 3 tabs (pending/active/closed), list session + preview
// tin cuối + cảnh báo handoff. Plan 2 Task 6.

import { UserOutlined } from "@ant-design/icons";
import { Tabs, List, Avatar, Badge, Typography, Empty, Spin } from "antd";
import dayjs from "dayjs";
import { useState } from "react";

import { useInboxSessions } from "../../hooks/useInboxSessions";

import type { InboxSessionRow } from "../../types/chat";

const { Text } = Typography;

type Tab = "pending" | "active" | "closed";

export interface InboxSidebarProps {
  selectedSessionId: string | null;
  onSelectSession: (s: InboxSessionRow) => void;
}

export function InboxSidebar({
  selectedSessionId,
  onSelectSession,
}: InboxSidebarProps) {
  const [tab, setTab] = useState<Tab>("pending");
  const { data, isLoading } = useInboxSessions(tab);

  const pendingCount = tab === "pending" ? (data?.length ?? 0) : 0;

  return (
    <div
      style={{
        width: 320,
        borderRight: "1px solid #f0f0f0",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as Tab)}
        items={[
          {
            key: "pending",
            label: (
              <Badge count={pendingCount} offset={[8, 0]}>
                Chờ xử lý
              </Badge>
            ),
          },
          { key: "active", label: "Đang xử lý" },
          { key: "closed", label: "Đã đóng" },
        ]}
        style={{ padding: "0 16px" }}
      />

      <div style={{ flex: 1, overflowY: "auto" }}>
        {isLoading ? <Spin style={{ width: "100%", marginTop: 32 }} /> : null}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <Empty description="Không có phiên nào" style={{ marginTop: 48 }} />
        )}

        <List
          dataSource={data ?? []}
          renderItem={(s) => (
            <List.Item
              onClick={() => onSelectSession(s)}
              style={{
                cursor: "pointer",
                padding: "12px 16px",
                background: s.id === selectedSessionId ? "#e6f4ff" : undefined,
              }}
            >
              <List.Item.Meta
                avatar={<Avatar icon={<UserOutlined />} />}
                title={
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text strong>{s.customer_name ?? "Khách lạ"}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {dayjs(s.last_message_at).format("HH:mm DD/MM")}
                    </Text>
                  </div>
                }
                description={
                  <>
                    <Text ellipsis style={{ display: "block", fontSize: 12 }}>
                      {s.last_message_preview ?? "(chưa có tin)"}
                    </Text>
                    {s.unresolved_handoff_reason ? (
                      <Text type="warning" style={{ fontSize: 11 }}>
                        ⚠ {s.unresolved_handoff_reason}
                      </Text>
                    ) : null}
                  </>
                }
              />
            </List.Item>
          )}
        />
      </div>
    </div>
  );
}
