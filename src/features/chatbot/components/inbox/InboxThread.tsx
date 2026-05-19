// Container cột giữa Sales Inbox (Plan 2 Task 7).
// - session null → <Empty />.
// - Header: tên + SĐT + nút action theo status:
//   handoff_pending → "Nhận phiên" (assignSelfToSession)
//   human           → "Chuyển bot" (Popconfirm → returnToBot)
//   closed          → không nút
//   Mọi status ≠ closed: thêm "Đóng phiên" (Popconfirm danger → closeSession)
// - Body: scroll list InboxMessageItem; auto-scroll bottom khi data length đổi.
// - Footer: InboxReplyBox; chỉ enable khi status='human'.

import {
  Button,
  Empty,
  Popconfirm,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useRef, useState } from "react";

import {
  assignSelfToSession,
  closeSession,
  returnToBot,
} from "../../api/inboxApi";
import { useSessionThread } from "../../hooks/useSessionThread";

import { InboxMessageItem } from "./InboxMessageItem";
import { InboxReplyBox } from "./InboxReplyBox";

import type { InboxSessionRow } from "../../types/chat";

const { Title, Text } = Typography;

export interface InboxThreadProps {
  session: InboxSessionRow | null;
}

function statusTag(status: InboxSessionRow["status"]) {
  switch (status) {
    case "bot":
      return <Tag color="purple">BOT</Tag>;
    case "handoff_pending":
      return <Tag color="orange">CHỜ XỬ LÝ</Tag>;
    case "human":
      return <Tag color="blue">ĐANG XỬ LÝ</Tag>;
    case "closed":
      return <Tag>ĐÃ ĐÓNG</Tag>;
    default:
      return null;
  }
}

export function InboxThread({ session }: InboxThreadProps) {
  const sessionId = session?.id ?? null;
  const { data, isLoading } = useSessionThread(sessionId);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  // Optimistic local status: parent's `selected` không tự refresh sau action,
  // nên track local để nút action + reply box ăn theo state thật ngay sau RPC.
  const [localStatus, setLocalStatus] = useState<
    InboxSessionRow["status"] | null
  >(session?.status ?? null);
  useEffect(() => {
    setLocalStatus(session?.status ?? null);
  }, [session?.id, session?.status]);

  const len = data?.length ?? 0;
  useEffect(() => {
    const el = bottomRef.current;
    // jsdom không implement scrollIntoView — guard để test không vỡ.
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "end" });
    }
  }, [len]);

  if (!session) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Empty description="Chọn 1 phiên bên trái" />
      </div>
    );
  }

  const runAction = async (
    fn: () => Promise<void>,
    okMsg: string,
    errFallback: string
  ) => {
    setBusy(true);
    try {
      await fn();
      message.success(okMsg);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : errFallback;
      message.error(errMsg);
    } finally {
      setBusy(false);
    }
  };

  const onAssign = () =>
    runAction(
      async () => {
        await assignSelfToSession(session.id);
        setLocalStatus("human");
      },
      "Đã nhận phiên",
      "Không nhận được phiên"
    );

  const onReturn = () =>
    runAction(
      async () => {
        await returnToBot(session.id);
        setLocalStatus("bot");
      },
      "Đã chuyển về bot",
      "Không chuyển được"
    );

  const onClose = () =>
    runAction(
      async () => {
        await closeSession(session.id);
        setLocalStatus("closed");
      },
      "Đã đóng phiên",
      "Không đóng được phiên"
    );

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minWidth: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Title level={5} style={{ margin: 0 }}>
            {session.customer_name ?? "Khách lạ"}{" "}
            {statusTag(localStatus ?? session.status)}
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {session.customer_phone ?? "Chưa có SĐT"}
          </Text>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(localStatus ?? session.status) === "handoff_pending" && (
            <Button
              type="primary"
              loading={busy}
              onClick={() => {
                void onAssign();
              }}
            >
              Nhận phiên
            </Button>
          )}
          {(localStatus ?? session.status) === "human" && (
            <Popconfirm
              title="Chuyển về bot?"
              description="Bot sẽ tiếp tục trả lời khách."
              onConfirm={() => {
                void onReturn();
              }}
              okText="Chuyển"
              cancelText="Hủy"
            >
              <Button loading={busy}>Chuyển bot</Button>
            </Popconfirm>
          )}
          {(localStatus ?? session.status) !== "closed" && (
            <Popconfirm
              title="Đóng phiên này?"
              description="Khách sẽ không thể gửi thêm tin vào phiên này."
              onConfirm={() => {
                void onClose();
              }}
              okText="Đóng"
              okButtonProps={{ danger: true }}
              cancelText="Hủy"
            >
              <Button danger loading={busy}>
                Đóng phiên
              </Button>
            </Popconfirm>
          )}
        </div>
      </div>

      {/* Body */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: "auto", background: "#fafafa" }}
      >
        {isLoading ? <Spin style={{ width: "100%", marginTop: 32 }} /> : null}
        {!isLoading && len === 0 && (
          <Empty description="Chưa có tin nào" style={{ marginTop: 48 }} />
        )}
        {(data ?? []).map((m) => (
          <InboxMessageItem key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <InboxReplyBox
        sessionId={session.id}
        disabled={(localStatus ?? session.status) !== "human"}
      />
    </div>
  );
}
