// Component hiển thị 1 tin trong thread Sales Inbox (Plan 2 Task 7).
// - user: bubble trái, nền xám
// - sales: bubble phải, nền xanh (primary)
// - bot: bubble phải, nền nhạt + nút "Đánh dấu sai" (Dropdown 5 lựa chọn)
// - system: dòng giữa, màu cam
// Khi report feedback: gọi reportFeedback(messageId, feedbackType) và show
// antd `message.success/error`.

import { FlagOutlined } from "@ant-design/icons";
import { Button, Dropdown, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { useState } from "react";

import { reportFeedback } from "../../api/inboxApi";

import type { ChatFeedbackType, ChatMessage } from "../../types/chat";
import type { MenuProps } from "antd";

const { Text } = Typography;

export interface InboxMessageItemProps {
  message: ChatMessage;
}

interface FeedbackOption {
  key: ChatFeedbackType;
  label: string;
}

const FEEDBACK_OPTIONS: FeedbackOption[] = [
  { key: "wrong_answer", label: "Trả lời sai" },
  { key: "fabricated_sku", label: "Bịa SKU" },
  { key: "wrong_price", label: "Sai giá" },
  { key: "medical_advice", label: "Lời khuyên y khoa" },
  { key: "other", label: "Khác" },
];

function roleTag(role: ChatMessage["role"]) {
  switch (role) {
    case "bot":
      return <Tag color="purple">BOT</Tag>;
    case "user":
      return <Tag color="default">USER</Tag>;
    case "sales":
      return <Tag color="blue">SALES</Tag>;
    case "system":
      return <Tag color="orange">SYSTEM</Tag>;
    default:
      return null;
  }
}

export function InboxMessageItem({ message: msg }: InboxMessageItemProps) {
  const [reporting, setReporting] = useState(false);

  const handleReport = async (feedbackType: ChatFeedbackType) => {
    setReporting(true);
    try {
      await reportFeedback({ messageId: msg.id, feedbackType });
      message.success("Đã ghi nhận phản hồi");
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Không gửi được phản hồi";
      message.error(errMsg);
    } finally {
      setReporting(false);
    }
  };

  const menuItems: MenuProps["items"] = FEEDBACK_OPTIONS.map((opt) => ({
    key: opt.key,
    label: opt.label,
    onClick: () => {
      void handleReport(opt.key);
    },
  }));

  const ts = dayjs(msg.created_at).format("HH:mm DD/MM");
  const content = msg.content ?? "";

  // System message: dòng giữa, nhỏ, màu cam
  if (msg.role === "system") {
    return (
      <div
        style={{
          textAlign: "center",
          margin: "8px 0",
          padding: "4px 8px",
        }}
      >
        <Text style={{ color: "#fa8c16", fontSize: 12 }}>
          {content} · {ts}
        </Text>
      </div>
    );
  }

  const isRight = msg.role === "sales" || msg.role === "bot";
  const bubbleBg =
    msg.role === "sales"
      ? "#1677ff"
      : msg.role === "bot"
        ? "#f6ffed"
        : "#f0f0f0";
  const bubbleColor = msg.role === "sales" ? "#fff" : "rgba(0,0,0,0.88)";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isRight ? "flex-end" : "flex-start",
        margin: "8px 12px",
      }}
    >
      <div
        style={{
          maxWidth: "70%",
          display: "flex",
          flexDirection: "column",
          alignItems: isRight ? "flex-end" : "flex-start",
        }}
      >
        <div style={{ marginBottom: 4 }}>
          {roleTag(msg.role)}
          <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
            {ts}
          </Text>
        </div>
        <div
          style={{
            background: bubbleBg,
            color: bubbleColor,
            padding: "8px 12px",
            borderRadius: 8,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {content}
        </div>
        {msg.role === "bot" && (
          <div style={{ marginTop: 4 }}>
            <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
              <Button
                size="small"
                type="text"
                icon={<FlagOutlined />}
                loading={reporting}
              >
                Đánh dấu sai
              </Button>
            </Dropdown>
          </div>
        )}
      </div>
    </div>
  );
}
